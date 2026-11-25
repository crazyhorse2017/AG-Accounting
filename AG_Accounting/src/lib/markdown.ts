/**
 * Minimal Markdown for articles and white papers. Pure functions (no React), so tests
 * and the PDF tool share the same rules.
 *
 * Supported: front matter, ## and ### headings, paragraphs, "- " and "1. " lists,
 * "> " callouts, **bold**, *italic*, [links](https://... or /path).
 * Everything else is plain text. Raw HTML is never interpreted.
 */

import type { Source, Status } from '../content/status.ts';

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'callout'; children: Inline[] };

export type Document = {
  meta: Record<string, string>;
  sources: Source[];
  blocks: Block[];
};

export type ContentDoc = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  published: string | null;
  status: Status;
  reviewedOn: string | null;
  sources: Source[];
  blocks: Block[];
  wordCount: number;
};

/** Split "---\nkey: value\n---\nbody". Repeated "source: Title | URL" lines become sources. */
export function parseFrontMatter(raw: string): { meta: Record<string, string>; sources: Source[]; body: string } {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const meta: Record<string, string> = {};
  const sources: Source[] = [];
  if (!text.startsWith('---\n')) return { meta, sources, body: text };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { meta, sources, body: text };
  for (const line of text.slice(4, end).split('\n')) {
    const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'source') {
      const [title, url] = value.split('|').map((s) => s.trim());
      if (title && url) sources.push({ title, url });
    } else {
      meta[key] = value.trim();
    }
  }
  return { meta, sources, body: text.slice(end + 4).replace(/^\n/, '') };
}

const SAFE_HREF = /^(https:\/\/[^\s]+|\/[a-z0-9/#-]*)$/i;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) out.push({ type: 'text', text: buf });
    buf = '';
  };
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const close = text.indexOf('**', i + 2);
      if (close > i + 2) {
        flush();
        out.push({ type: 'strong', children: parseInline(text.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }
    if (text[i] === '*' && text[i + 1] !== ' ') {
      const close = text.indexOf('*', i + 1);
      if (close > i + 1) {
        flush();
        out.push({ type: 'em', children: parseInline(text.slice(i + 1, close)) });
        i = close + 1;
        continue;
      }
    }
    if (text[i] === '[') {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
      if (m && SAFE_HREF.test(m[2])) {
        flush();
        out.push({ type: 'link', href: m[2], children: parseInline(m[1]) });
        i += m[0].length;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return out;
}

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.split('\n');
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    const h = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    const ul = /^[-*]\s+(.*)$/.exec(trimmed);
    const ol = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (!trimmed) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      blocks.push({ type: 'heading', level: h[1].length === 2 ? 2 : 3, children: parseInline(h[2]) });
    } else if (ul || ol) {
      flushPara();
      const ordered = Boolean(ol);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else if (trimmed.startsWith('>')) {
      flushPara();
      flushList();
      blocks.push({ type: 'callout', children: parseInline(trimmed.replace(/^>\s?/, '')) });
    } else if (list && /^\s{2,}/.test(rawLine)) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
    } else {
      flushList();
      para.push(trimmed);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export function parseDocument(raw: string): Document {
  const { meta, sources, body } = parseFrontMatter(raw);
  return { meta, sources, blocks: parseBlocks(body) };
}

export function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => (n.type === 'text' ? n.text : inlineText(n.children))).join('');
}

/** Turn a raw Markdown file into a typed content document. */
export function toContentDoc(raw: string, fallbackSlug: string): ContentDoc {
  const doc = parseDocument(raw);
  const m = doc.meta;
  const words = doc.blocks
    .map((b) => (b.type === 'list' ? b.items.map(inlineText).join(' ') : inlineText(b.children)))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return {
    id: m.id ?? fallbackSlug,
    slug: m.slug ?? fallbackSlug,
    title: m.title ?? fallbackSlug,
    summary: m.summary ?? '',
    category: m.category ?? 'general',
    published: m.published || null,
    status: m.status === 'approved' ? 'approved' : 'draft',
    reviewedOn: m.reviewedOn || null,
    sources: doc.sources,
    blocks: doc.blocks,
    wordCount: words,
  };
}
