import type { ReactNode } from 'react';
import type { Block, Inline } from '../lib/markdown.ts';
import { Link } from '../lib/router.tsx';
import { ExternalLink } from './ui.tsx';

function renderInline(nodes: Inline[], keyPrefix = ''): ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}${i}`;
    switch (n.type) {
      case 'text':
        return n.text;
      case 'strong':
        return <strong key={key}>{renderInline(n.children, `${key}-`)}</strong>;
      case 'em':
        return <em key={key}>{renderInline(n.children, `${key}-`)}</em>;
      case 'link':
        return n.href.startsWith('/') ? (
          <Link key={key} to={n.href} className="text-brand-800">
            {renderInline(n.children, `${key}-`)}
          </Link>
        ) : (
          <ExternalLink key={key} href={n.href} className="text-brand-800">
            {renderInline(n.children, `${key}-`)}
          </ExternalLink>
        );
    }
  });
}

/** Renders parsed Markdown blocks as React elements (no raw HTML is ever injected). */
export function MarkdownBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4 text-lg leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return b.level === 2 ? (
              <h2 key={i} className="pt-4 text-2xl">
                {renderInline(b.children)}
              </h2>
            ) : (
              <h3 key={i} className="pt-2 text-xl">
                {renderInline(b.children)}
              </h3>
            );
          case 'paragraph':
            return <p key={i}>{renderInline(b.children)}</p>;
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-6`}>
                {b.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </Tag>
            );
          }
          case 'callout':
            return (
              <p key={i} className="rounded-md border-l-4 border-accent-500 bg-brand-50 px-4 py-3 text-base">
                {renderInline(b.children)}
              </p>
            );
        }
      })}
    </div>
  );
}
