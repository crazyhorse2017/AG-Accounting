/**
 * Articles (= blog = newsletter archive) and white papers, loaded from Markdown at build time.
 * Add a file to src/content/articles/ or src/content/white-papers/ and it appears automatically
 * once its front matter says `status: approved`.
 */
import { toContentDoc } from '../lib/markdown.ts';
import type { ContentDoc } from '../lib/markdown.ts';

const articleFiles = import.meta.glob('./articles/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const paperFiles = import.meta.glob('./white-papers/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const slugOf = (path: string) => path.split('/').pop()!.replace(/\.md$/, '');

const byNewest = (a: ContentDoc, b: ContentDoc) => (b.published ?? '').localeCompare(a.published ?? '') || a.title.localeCompare(b.title);

export const articles: ContentDoc[] = Object.entries(articleFiles)
  .map(([path, raw]) => toContentDoc(raw, slugOf(path)))
  .sort(byNewest);

export const whitePapers: ContentDoc[] = Object.entries(paperFiles)
  .map(([path, raw]) => toContentDoc(raw, slugOf(path)))
  .sort((a, b) => a.title.localeCompare(b.title));

export const ARTICLE_CATEGORIES: { id: string; title: string }[] = [
  { id: 'personal-tax', title: 'Personal Tax' },
  { id: 'business-tax', title: 'Business Tax' },
  { id: 'personal-tax-planning', title: 'Personal Tax Planning' },
  { id: 'business-tax-planning', title: 'Business Tax Planning' },
  { id: 'niche', title: 'Niche' },
  { id: 'word-to-the-wise', title: 'Word to the Wise' },
];

export function categoryTitle(id: string): string {
  return ARTICLE_CATEGORIES.find((c) => c.id === id)?.title ?? id;
}
