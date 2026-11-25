import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

/** Every page path the site serves. Anything else renders the 404 page. */
export const ROUTES = ['/', '/services', '/about', '/resources', '/payments', '/contact', '/privacy'] as const;

export type RoutePath = (typeof ROUTES)[number];

export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed.toLowerCase();
}

export function matchRoute(pathname: string): RoutePath | null {
  const path = normalizePath(pathname);
  return ROUTES.find((r) => r === path) ?? null;
}

const NAVIGATE_EVENT = 'ag:navigate';

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener(NAVIGATE_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAVIGATE_EVENT, update);
    };
  }, []);
  return pathname;
}

type LinkProps = { to: RoutePath; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

/** In-site link: a real <a href> (works without JS, middle-click, etc.) that navigates client-side. */
export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
