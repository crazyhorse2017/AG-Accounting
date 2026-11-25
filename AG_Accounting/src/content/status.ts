/**
 * Review status for every piece of Phase 02 content.
 *
 * - `draft`: written but not yet approved by the firm. Hidden on the live site.
 * - `approved`: the firm reviewed it (see `reviewedOn`). Shown on the site.
 *
 * Before launch, the build can set VITE_SHOW_DRAFTS=true (Cloudflare build variable)
 * so drafts are visible for previewing. They then carry a visible "Draft" label.
 * At launch that variable must be removed.
 */

export type Status = 'draft' | 'approved';

export type Source = { title: string; url: string };

export type Reviewable = {
  id: string;
  status: Status;
  reviewedOn: string | null;
  sources: Source[];
};

export const SHOW_DRAFTS: boolean = import.meta.env?.VITE_SHOW_DRAFTS === 'true';

export function isVisible(item: { status: string }, showDrafts: boolean = SHOW_DRAFTS): boolean {
  return item.status === 'approved' || showDrafts;
}

export function visibleItems<T extends { status: string }>(items: readonly T[], showDrafts: boolean = SHOW_DRAFTS): T[] {
  return items.filter((item) => isVisible(item, showDrafts));
}

export function isDraft(item: { status: string }): boolean {
  return item.status !== 'approved';
}
