import React from 'react';

// Renders the small Markdown subset the docs/changelogs files use: "## " and "### " headings,
// "- " bullets, "|" tables, plain paragraphs, and **bold** / `code` inline. Built as React
// elements (no HTML string), so the text is always escaped.

const inline = (text: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em]">{part.slice(1, -1)}</code>;
    }
    return part;
  });

const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

type Block =
  | { kind: 'h2' | 'h3' | 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

const toBlocks = (markdown: string): Block[] => {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith('### ')) {
      blocks.push({ kind: 'h3', text: line.slice(4) });
    } else if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3) });
    } else if (line.startsWith('- ')) {
      const items = [line.slice(2)];
      while (i + 1 < lines.length && lines[i + 1].startsWith('- ')) items.push(lines[(i += 1)].slice(2));
      blocks.push({ kind: 'list', items });
    } else if (line.startsWith('|')) {
      const rows = [line];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) rows.push(lines[(i += 1)]);
      const [header, ...rest] = rows.map(cells);
      blocks.push({ kind: 'table', header, rows: rest.filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell))) });
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }
  return blocks;
};

const ChangelogMarkdown: React.FC<{ markdown: string }> = ({ markdown }) => (
  <div className="space-y-3 text-sm leading-6 text-gray-700">
    {toBlocks(markdown).map((block, i) => {
      switch (block.kind) {
        case 'h2':
          return <h3 key={i} className="pt-3 text-sm font-semibold text-gray-900 first:pt-0">{inline(block.text)}</h3>;
        case 'h3':
          return <h4 key={i} className="pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{inline(block.text)}</h4>;
        case 'list':
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-gray-400">
              {block.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
            </ul>
          );
        case 'table':
          return (
            <div key={i} className="overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>{block.header.map((cell, j) => <th key={j} className="px-3 py-2 font-medium">{inline(cell)}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {block.rows.map((row, j) => (
                    <tr key={j}>{row.map((cell, k) => <td key={k} className="whitespace-nowrap px-3 py-1.5">{inline(cell)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        default:
          return <p key={i}>{inline(block.text)}</p>;
      }
    })}
  </div>
);

export default ChangelogMarkdown;
