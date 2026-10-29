// Release notes live in docs/changelogs, one Markdown file per release named v<major>.<minor>.<patch>-<slug>.md.
// They are bundled at build time, so a new or edited file shows up with the next build or deploy.
const files = import.meta.glob('../../../../docs/changelogs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface Release {
  /** "v2.0.9" */
  version: string;
  /** The file name's slug made readable, e.g. "Delete one project generate reports and more". */
  title: string;
  /** The file's "# " line without its leading "MYPS ", e.g. "Changes since v2.0.8-…". */
  subtitle: string;
  unreleased: boolean;
  /** Everything after the "# " line. */
  body: string;
  /** Changes whenever the file's text changes; drives the unread dot. */
  key: string;
}

const FILE_NAME = /(v(\d+)\.(\d+)\.(\d+))(?:-([^/]+))?\.md$/;

const hash = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const parse = (path: string, text: string): { release: Release; order: number[] } | null => {
  const match = FILE_NAME.exec(path);
  if (!match) return null;
  const [, version, major, minor, patch, slug = ''] = match;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const headingIndex = lines.findIndex((line) => line.startsWith('# '));
  const heading = headingIndex >= 0 ? lines[headingIndex].slice(2).trim() : '';
  const readable = slug.replace(/-/g, ' ').trim();
  return {
    release: {
      version,
      title: readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : version,
      subtitle: heading.replace(/^MYPS\s+/i, '').replace(/\s*\(not yet released\)\s*$/i, '').replace(/^c/, 'C'),
      unreleased: /\(not yet released\)/i.test(heading),
      body: lines.slice(headingIndex + 1).join('\n').trim(),
      key: `${version}:${hash(text)}`,
    },
    order: [Number(major), Number(minor), Number(patch)],
  };
};

/** Newest release first, by version number (v2.0.10 sorts above v2.0.9). */
export const releases: Release[] = Object.entries(files)
  .map(([path, text]) => parse(path, text))
  .filter((parsed): parsed is { release: Release; order: number[] } => parsed !== null)
  .sort((a, b) => b.order[0] - a.order[0] || b.order[1] - a.order[1] || b.order[2] - a.order[2])
  .map(({ release }) => release);

const SEEN_KEY = 'myps.changelogs.lastSeen';

/** True when the newest release changed since this browser last opened the Changelogs. */
export const hasUnseenChanges = (): boolean => {
  if (releases.length === 0) return false;
  try {
    return window.localStorage.getItem(SEEN_KEY) !== releases[0].key;
  } catch {
    return false;
  }
};

export const markChangesSeen = () => {
  if (releases.length === 0) return;
  try {
    window.localStorage.setItem(SEEN_KEY, releases[0].key);
  } catch {
    // Storage blocked (private window, policy): the dot just keeps showing.
  }
};
