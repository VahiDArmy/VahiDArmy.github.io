/**
 * A small, safe Markdown renderer built for streamed model output.
 *
 * It renders React nodes rather than HTML strings, tolerates half-written
 * fences while a reply streams, and supports the subset models actually use:
 * headings, lists, tables, blockquotes, fenced code, inline code, emphasis and
 * links.
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { CopyButton } from './ui';

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'quote'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'hr' }
  | { kind: 'json'; text: string };

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = text.split(INLINE);
  parts.forEach((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return;
    if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(<code key={key}>{part.slice(1, -1)}</code>);
      return;
    }
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>);
      return;
    }
    if ((part.startsWith('*') && part.endsWith('*') && part.length > 2) || (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>);
      return;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      nodes.push(
        <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener">
          {link[1]}
        </a>,
      );
      return;
    }
    if (/^https?:\/\//.test(part)) {
      nodes.push(
        <a key={key} href={part} target="_blank" rel="noreferrer noopener">
          {part}
        </a>,
      );
      return;
    }
    nodes.push(<span key={key}>{part}</span>);
  });
  return nodes;
}

function parse(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```(\w+)?/);
    if (fence) {
      const lang = (fence[1] || '').toLowerCase();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      const code = body.join('\n');
      blocks.push({ kind: 'code', lang, code });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'hr' });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ kind: 'quote', text: quote.join(' ') });
      continue;
    }

    if (trimmed.startsWith('|') && lines[index + 1]?.includes('---')) {
      const splitRow = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());
      const head = splitRow(trimmed);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }

    const bullet = trimmed.match(/^([-*+])\s+(.*)$/);
    if (bullet) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].trim().match(/^([-*+])\s+(.*)$/);
        if (!match) break;
        items.push(match[2]);
        index += 1;
      }
      blocks.push({ kind: 'list', ordered: false, items });
      continue;
    }

    const ordered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].trim().match(/^(\d+)[.)]\s+(.*)$/);
        if (!match) break;
        items.push(match[2]);
        index += 1;
      }
      blocks.push({ kind: 'list', ordered: true, items });
      continue;
    }

    const paragraph: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (
        !next ||
        next.startsWith('#') ||
        next.startsWith('```') ||
        next.startsWith('>') ||
        next.startsWith('|') ||
        /^([-*+]|\d+[.)])\s+/.test(next)
      ) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    const joined = paragraph.join(' ');
    const looksJson = (joined.startsWith('{') && joined.endsWith('}')) || (joined.startsWith('[') && joined.endsWith(']'));
    if (looksJson && joined.length > 80) {
      try {
        blocks.push({ kind: 'json', text: JSON.stringify(JSON.parse(joined), null, 2) });
        continue;
      } catch {
        /* keep as prose */
      }
    }
    blocks.push({ kind: 'paragraph', text: joined });
  }

  return blocks;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parse(text), [text]);
  let key = 0;
  return (
    <div className={`md ${className || ''}`}>
      {blocks.map((block) => {
        key += 1;
        const id = `md-${key}`;
        switch (block.kind) {
          case 'heading': {
            const content = renderInline(block.text, id);
            if (block.level === 1) return <h1 key={id}>{content}</h1>;
            if (block.level === 2) return <h2 key={id}>{content}</h2>;
            if (block.level === 3) return <h3 key={id}>{content}</h3>;
            return <h4 key={id}>{content}</h4>;
          }
          case 'paragraph':
            return <p key={id}>{renderInline(block.text, id)}</p>;
          case 'list':
            return block.ordered ? (
              <ol key={id}>
                {block.items.map((item, position) => (
                  <li key={`${id}-${position}`}>{renderInline(item, `${id}-${position}`)}</li>
                ))}
              </ol>
            ) : (
              <ul key={id}>
                {block.items.map((item, position) => (
                  <li key={`${id}-${position}`}>{renderInline(item, `${id}-${position}`)}</li>
                ))}
              </ul>
            );
          case 'quote':
            return <blockquote key={id}>{renderInline(block.text, id)}</blockquote>;
          case 'hr':
            return <hr key={id} />;
          case 'table':
            return (
              <table key={id}>
                <thead>
                  <tr>
                    {block.head.map((cell, position) => (
                      <th key={`${id}-h-${position}`}>{renderInline(cell, `${id}-h-${position}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${id}-r-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${id}-r-${rowIndex}-${cellIndex}`}>{renderInline(cell, `${id}-r-${rowIndex}-${cellIndex}`)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case 'json':
            return (
              <div key={id} style={{ position: 'relative' }}>
                <pre className="codeblock codeblock--wrap json-block">{block.text}</pre>
                <div style={{ position: 'absolute', top: 6, right: 6 }}>
                  <CopyButton text={block.text} label="JSON" />
                </div>
              </div>
            );
          case 'code':
          default:
            return (
              <div key={id} style={{ position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 8.5,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-4)',
                    padding: '5px 2px 0',
                  }}
                >
                  <span>{block.lang || 'text'}</span>
                  <CopyButton text={block.code} label="Copy" />
                </div>
                <pre className="codeblock">{block.code}</pre>
              </div>
            );
        }
      })}
    </div>
  );
}
