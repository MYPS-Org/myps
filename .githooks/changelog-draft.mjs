// Git pre-commit hook: a commit that changes app code gets a release note.
//
// When the staged changes touch app code but no file under docs/changelogs/, Claude Code (headless,
// no tools) drafts the section from the staged diff in the style of
// .claude/skills/update-changelogs/SKILL.md. The hook adds it at the top of the newest
// docs/changelogs/v*.md marked "(not yet released)", or starts the next version file, and stages
// it, so the note is part of this commit. Fix it before pushing: edit, `git add`, `git commit --amend --no-edit`.
//
// It never blocks a commit: when Claude Code is missing or fails, it says so and the commit goes on
// (the deploy workflow still warns about a push without a note).
// Skip once: MYPS_SKIP_CHANGELOG=1 git commit ...   Use another binary: MYPS_CLAUDE_BIN=<path>.
// Enable per clone: git config core.hooksPath .githooks
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const say = (text) => process.stderr.write(`${text}\n`);
const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const giveUp = (reason) => {
  say(`changelog: no release note was drafted (${reason}).`);
  say('changelog: add one to docs/changelogs by hand (.claude/skills/update-changelogs/SKILL.md) before you push.');
  process.exit(0);
};

if (process.env.MYPS_SKIP_CHANGELOG === '1') process.exit(0);

// A merge, rebase or cherry-pick replays changes that already carry their notes.
for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
  const markerPath = git('rev-parse', '--git-path', marker);
  if (markerPath && fs.existsSync(markerPath)) process.exit(0);
}

const root = git('rev-parse', '--show-toplevel');
if (!root) process.exit(0);

// The same app-code rule as the Claude Code Stop hook (.claude/hooks/changelog-reminder.mjs).
const APP_CODE = /^(FE\/src|WebAPI|Helpers|DBHelper|Hangfire|Main|CrystalReportService|ReportGeneration)\//;
const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMRD').split('\n').filter(Boolean);
const appChanges = staged.filter(
  (file) =>
    APP_CODE.test(file) &&
    !/\.md$/i.test(file) &&
    !/^Main\/appsettings[^/]*\.json$/i.test(file) &&
    !/^Main\/Resources\/UploadedFiles\//.test(file),
);
const hasReleaseNote = staged.some((file) => /^docs\/changelogs\/[^/]+\.md$/.test(file));
if (appChanges.length === 0 || hasReleaseNote) process.exit(0);

// --- the release file the section goes into -------------------------------------------------
const changelogDir = path.join(root, 'docs', 'changelogs');
const FILE_NAME = /^v(\d+)\.(\d+)\.(\d+)(?:-[^/]+)?\.md$/;
const releases = (fs.existsSync(changelogDir) ? fs.readdirSync(changelogDir) : [])
  .map((name) => ({ name, match: FILE_NAME.exec(name) }))
  .filter((entry) => entry.match)
  .map(({ name, match }) => ({ name, order: match.slice(1, 4).map(Number) }))
  .sort((a, b) => b.order[0] - a.order[0] || b.order[1] - a.order[1] || b.order[2] - a.order[2]);
if (releases.length === 0) giveUp('docs/changelogs has no v*.md file to add to');

const newest = releases[0];
const newestPath = path.join(changelogDir, newest.name);
const newestText = fs.readFileSync(newestPath, 'utf8');
const newestOpen = /\(not yet released\)\s*$/i.test(newestText.replace(/\r\n/g, '\n').split('\n')[0] ?? '');

// --- the prompt -----------------------------------------------------------------------------
const skillPath = path.join(root, '.claude', 'skills', 'update-changelogs', 'SKILL.md');
const skill = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8').replace(/\r\n/g, '\n') : '';
const rulesStart = skill.indexOf('## Write the section');
const rulesEnd = skill.indexOf('## Test cases by module');
const rules = rulesStart >= 0 ? skill.slice(rulesStart, rulesEnd > rulesStart ? rulesEnd : undefined).trim() : skill.trim();

const DIFF_LIMIT = 120_000;
const stat = git('diff', '--cached', '--stat', '--', ...appChanges);
let diff = git('diff', '--cached', '--unified=2', '--', ...appChanges);
if (diff.length > DIFF_LIMIT) diff = `${diff.slice(0, DIFF_LIMIT)}\n\n[diff cut at ${DIFF_LIMIT} characters; the file list above is complete]`;

const prompt = `You write ONE release-note section for MYPS, a web application of the Philippine DPWH.
The section is shown under the app's Changelogs button to every user: DPC, RPC, PS Admin and ATA testers.

Follow these rules from the project's changelog guide exactly:
<guide>
${rules}
</guide>

${newestOpen ? 'The release file the section is added to, as it is now (match its style, and do not repeat a change it already describes):' : 'The latest released file, for style only:'}
<release_file>
${newestText.slice(0, 20_000)}
</release_file>

The change to describe: the app code staged for this commit.
<files>
${stat}
</files>
<diff>
${diff}
</diff>

Output ONLY the section, in Markdown: the first line is "## <heading>", then the bullets.
- Write it as a user reads it: what they now see or can do, on which screen (named as the app shows it), and how it was before.
- Plain words such as deleted, restored, permanently deleted, updated. Never developer words such as revision, recompute, hard-delete, query, schema, index, endpoint.
- No bullet about what did not change inside the code.
- An "Internal:" bullet only when there is something to do, such as a new database script to run once per environment (name that script file; it is the only file name allowed).
- No class, table or column names, hostnames, passwords or e-mail addresses.
- No PR number: this commit has none. Add a test case ID in parentheses only when the diff names one (for example S01-TC004-P002).
- No code fences, no preamble, nothing after the bullets.
- If the change has no visible effect, the heading and the single bullet "- Internal <what> only. Nothing visible changed."
- If a section of the release file already describes exactly this change, output only the word NONE.`;

// --- Claude Code, headless ------------------------------------------------------------------
const findClaude = () => {
  if (process.env.MYPS_CLAUDE_BIN) return process.env.MYPS_CLAUDE_BIN;
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    const candidates =
      process.platform === 'win32'
        // The npm "claude" shim runs this native binary; started directly, no cmd.exe quoting.
        ? [path.join(dir, 'claude.exe'), path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')]
        : [path.join(dir, 'claude')];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (found) return found;
  }
  return null;
};
const claude = findClaude();
if (!claude) giveUp('Claude Code was not found on PATH');

say(`changelog: ${appChanges.length} app file(s) staged and no release note; drafting one with Claude Code (usually under 15 s)...`);
// Run outside the repo with hooks off: the project's own Stop hook (and any user hooks) must not
// fire inside this one-shot draft. No tools, no MCP servers, no saved session.
const result = spawnSync(
  claude,
  [
    '-p',
    '--model', 'sonnet',
    '--tools', '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--setting-sources', '',
    '--settings', JSON.stringify({ disableAllHooks: true }),
  ],
  { cwd: os.tmpdir(), input: prompt, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
);
if (result.error) giveUp(`Claude Code did not run: ${result.error.message}`);
if (result.status !== 0) giveUp(`Claude Code exited with ${result.status}: ${(result.stderr || result.stdout || '').trim().slice(0, 300)}`);

let section = (result.stdout || '').replace(/\r\n/g, '\n').trim();
section = section.replace(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/i, '$1').trim();
if (section === 'NONE') {
  say('changelog: Claude Code found this change already described in the release notes; nothing added.');
  process.exit(0);
}
if (!/^## \S/.test(section) || !/\n- \S/.test(section)) giveUp(`the draft was not a "## " section with bullets: ${section.slice(0, 200)}`);

// --- write it -------------------------------------------------------------------------------
let target = newestPath;
if (newestOpen) {
  const eol = newestText.includes('\r\n') ? '\r\n' : '\n';
  // Newest first: right below the "# MYPS changes since ..." line, as the panel shows file order.
  const lines = newestText.replace(/\r\n/g, '\n').split('\n');
  const heading = lines.findIndex((line) => line.startsWith('# '));
  const before = lines.slice(0, heading + 1).join('\n').trimEnd();
  const after = lines.slice(heading + 1).join('\n').trim();
  const updated = `${before}\n\n${section}\n${after ? `\n${after}\n` : ''}`;
  fs.writeFileSync(newestPath, updated.replace(/\n/g, eol));
} else {
  const [major, minor, patch] = newest.order;
  const slug = section.split('\n')[0].slice(3).toLowerCase().replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 6).join('-') || 'changes';
  target = path.join(changelogDir, `v${major}.${minor}.${patch + 1}-${slug}.md`);
  fs.writeFileSync(target, `# MYPS changes since ${newest.name.replace(/\.md$/, '')} (not yet released)\n\n${section}\n`);
}

const relative = path.relative(root, target).split(path.sep).join('/');
try {
  execFileSync('git', ['add', '--', relative], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
} catch (error) {
  giveUp(`the draft was written to ${relative} but could not be staged: ${String(error.stderr || error.message).trim()}`);
}

say(`changelog: drafted in ${relative} and added to this commit:\n`);
say(section.split('\n').map((line) => `    ${line}`).join('\n'));
say('\nchangelog: to change it before you push: edit the file, git add it, git commit --amend --no-edit');
process.exit(0);
