import pagesFile from './data/tax-center/pages.json';
import linksFile from './data/tax-center/links.json';
import referenceFile from './data/tax-center/reference.json';
import glossaryFile from './data/tax-center/glossary.json';
import type { Reviewable } from './status.ts';

export type TaxCenterPage = Reviewable & { path: string; title: string; intro: string };
export type OfficialLink = Reviewable & { group: string; agency?: string; title: string; description: string; url: string };
export type ReferenceItem = Reviewable & {
  kind: 'right' | 'retention' | 'checklist';
  order: number;
  title: string;
  body?: string;
  situation?: string;
  list?: string[];
};
export type GlossaryTerm = Reviewable & { term: string; definition: string };

export const taxCenterPages = pagesFile.items as unknown as TaxCenterPage[];
export const officialLinks = linksFile.items as unknown as OfficialLink[];
export const referenceItems = (referenceFile.items as unknown as ReferenceItem[]).slice().sort((a, b) => a.order - b.order);
export const glossary = glossaryFile.items as unknown as GlossaryTerm[];

export function pageFor(path: string): TaxCenterPage {
  const page = taxCenterPages.find((p) => p.path === path);
  if (!page) throw new Error(`No Tax Center page entry for ${path}`);
  return page;
}
