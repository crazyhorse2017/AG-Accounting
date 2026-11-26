/**
 * Draft preview switch.
 *
 * While the site is being reviewed (before launch), this is `true`: every draft item
 * shows on the site with a yellow "Draft" label, so the firm can see everything.
 *
 * At launch, set it to `false`. Then only approved items show.
 * `tests/verify_repo.py --launch` fails while this is still `true`.
 *
 * (The Cloudflare build variable VITE_SHOW_DRAFTS=true also turns drafts on, but only
 * when it is set under Settings → Build → Variables and the site is rebuilt. This file
 * works without any dashboard setting.)
 */
export const PREVIEW_DRAFTS: boolean = true;
