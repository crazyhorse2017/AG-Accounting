/**
 * Every page pattern the site serves. `:name` segments match one path segment.
 * Anything else renders the 404 page. (No React here so tests and tools can use it.)
 */
export const ROUTES = [
  '/',
  '/services',
  '/about',
  '/resources',
  '/payments',
  '/contact',
  '/privacy',
  '/tax-center',
  '/tax-center/rates',
  '/tax-center/due-dates',
  '/tax-center/forms',
  '/tax-center/refunds',
  '/tax-center/glossary',
  '/tax-center/taxpayer-rights',
  '/tax-center/record-retention',
  '/tax-center/withholding',
  '/tax-center/appointment-checklist',
  '/calculators',
  '/calculators/:slug',
  '/articles',
  '/articles/:slug',
  '/resources/white-papers',
  '/resources/videos',
  '/resources/facts',
] as const;

export type RoutePattern = (typeof ROUTES)[number];

export type RouteMatch = { pattern: RoutePattern; params: Record<string, string> };

export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed.toLowerCase();
}

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/');
  const s = path.split('/');
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) {
      if (!/^[a-z0-9-]+$/.test(s[i])) return null;
      params[p[i].slice(1)] = s[i];
    } else if (p[i] !== s[i]) {
      return null;
    }
  }
  return params;
}

export function matchRoute(pathname: string): RouteMatch | null {
  const path = normalizePath(pathname);
  // Static patterns win over parameter patterns.
  const ordered = [...ROUTES].sort((a, b) => Number(a.includes(':')) - Number(b.includes(':')));
  for (const pattern of ordered) {
    const params = matchPattern(pattern, path);
    if (params) return { pattern, params };
  }
  return null;
}
