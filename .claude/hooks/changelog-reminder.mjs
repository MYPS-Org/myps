// Claude Code Stop hook: every change to the app gets a release note.
//
// When this branch changes app code (compared with origin/main: committed, staged, unstaged and
// untracked files) but no file under docs/changelogs/, the session is not allowed to finish
// until an entry is written. See .claude/skills/update-changelogs/SKILL.md for the format.
import { execFileSync } from 'node:child_process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let input = {};
try {
  input = JSON.parse(raw || '{}');
} catch {
  // No usable input: still check, the payload only matters for stop_hook_active.
}

// Already reminded once in this turn: let it stop rather than loop.
if (input.stop_hook_active) process.exit(0);

const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const base = git('merge-base', 'HEAD', 'origin/main') || 'HEAD';
const changed = [
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter(Boolean);

const APP_CODE = /^(FE\/src|WebAPI|Helpers|DBHelper|Hangfire|Main|CrystalReportService|ReportGeneration)\//;
const appChanges = changed.filter(
  (path) =>
    APP_CODE.test(path) &&
    !/\.md$/i.test(path) &&
    !/^Main\/appsettings[^/]*\.json$/i.test(path) &&
    !/^Main\/Resources\/UploadedFiles\//.test(path),
);
const hasReleaseNote = changed.some((path) => /^docs\/changelogs\/[^/]+\.md$/.test(path));

if (appChanges.length === 0 || hasReleaseNote) process.exit(0);

const sample = appChanges.slice(0, 5).join(', ') + (appChanges.length > 5 ? `, +${appChanges.length - 5} more` : '');
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason:
      `App code changed on this branch (${sample}) but docs/changelogs has no release note for it. ` +
      'Add an entry to the newest docs/changelogs/v*.md whose heading says "(not yet released)", or start the next ' +
      'version file if the newest one is released, following .claude/skills/update-changelogs/SKILL.md. ' +
      'Internal-only work gets a one-line "Nothing visible changed." entry. Then finish.',
  }),
);
