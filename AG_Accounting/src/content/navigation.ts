/**
 * Site navigation: the top bar (dropdowns), the mobile menu and the footer all read
 * this list, so every page is reachable from every screen size.
 * Each group is a dropdown; a group with `to` and no `links` is a plain top-bar link.
 */

export type NavLink = { to: string; label: string; description?: string };

export type NavGroup = {
  id: string;
  label: string;
  /** Plain link (no dropdown). */
  to?: string;
  links?: NavLink[];
  /** Wider two-column panel for long lists. */
  wide?: boolean;
  /** Open the panel toward the left (for groups near the right edge). */
  alignRight?: boolean;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'services',
    label: 'Services',
    links: [
      { to: '/services', label: 'Our services', description: 'What we can help you with' },
      { to: '/payments', label: 'Pay an invoice', description: 'How to pay securely through PayPal' },
      { to: '/client-portal', label: 'Client portal', description: 'Send and receive documents safely' },
    ],
  },
  {
    id: 'tax-center',
    label: 'Tax Center',
    wide: true,
    links: [
      { to: '/tax-center', label: 'Tax Center home', description: 'Everything in one place' },
      { to: '/tax-center/rates', label: 'Tax rates and limits', description: 'Brackets, deductions, credits' },
      { to: '/tax-center/due-dates', label: 'Tax due dates', description: 'Federal and Ohio deadlines' },
      { to: '/tax-center/forms', label: 'Forms and publications', description: 'Official IRS and Ohio forms' },
      { to: '/tax-center/refunds', label: 'Refunds and payments', description: 'Track a refund or pay a balance' },
      { to: '/tax-center/withholding', label: 'Check your withholding', description: 'Avoid a surprise bill' },
      { to: '/tax-center/appointment-checklist', label: 'Appointment checklist', description: 'What to bring to your appointment' },
      { to: '/tax-center/record-retention', label: 'Keeping tax records', description: 'What to keep and for how long' },
      { to: '/tax-center/taxpayer-rights', label: 'Your taxpayer rights', description: 'Your rights when dealing with the IRS' },
      { to: '/tax-center/glossary', label: 'Tax glossary', description: 'Plain-English tax terms' },
    ],
  },
  { id: 'calculators', label: 'Calculators', to: '/calculators' },
  {
    id: 'learn',
    label: 'Learn',
    links: [
      { to: '/articles', label: 'Articles', description: 'Tax and money news, explained' },
      { to: '/resources/white-papers', label: 'White papers', description: 'In-depth guides you can download' },
      { to: '/resources/videos', label: 'Tax videos', description: 'Short official IRS videos' },
      { to: '/resources/facts', label: 'Tax facts', description: 'Quick facts and tax history' },
      { to: '/resources', label: 'Helpful links', description: 'Official sites we trust' },
      { to: '/newsletter', label: 'Newsletter', description: 'Monthly news and weekly tips' },
    ],
  },
  {
    id: 'about',
    label: 'About',
    alignRight: true,
    links: [
      { to: '/about', label: 'About us', description: 'Who we are' },
      { to: '/contact', label: 'Contact', description: 'Call, email or send a message' },
      { to: '/privacy', label: 'Privacy', description: 'How we handle your information' },
    ],
  },
];

/** True when `pathname` is `to` or a page under it (`/articles` matches `/articles/x`). */
export function isActivePath(pathname: string, to: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (to === '/') return path === '/';
  return path === to || path.startsWith(`${to}/`);
}

/** The single best-matching link for the current page (so `/resources` doesn't also light up on `/resources/videos`). */
export function activeLink(pathname: string): string | null {
  let best: string | null = null;
  for (const group of NAV_GROUPS) {
    for (const to of group.links ? group.links.map((l) => l.to) : [group.to ?? '']) {
      if (to && isActivePath(pathname, to) && (best === null || to.length > best.length)) best = to;
    }
  }
  return best;
}
