import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { business, draftItems } from '../content/site.ts';
import { Link } from '../lib/router.tsx';

type RoutePath = string;
import { Container } from './ui.tsx';
import { Wordmark } from './Logo.tsx';
import { formatAddress, telHref } from '../lib/format.ts';

const NAV: { to: RoutePath; label: string }[] = [
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/tax-center', label: 'Tax Center' },
  { to: '/calculators', label: 'Calculators' },
  { to: '/articles', label: 'Articles' },
  { to: '/payments', label: 'Pay an invoice' },
];

const FOOTER_EXTRA: { to: RoutePath; label: string }[] = [
  { to: '/resources/white-papers', label: 'White papers' },
  { to: '/resources/videos', label: 'Tax videos' },
  { to: '/resources/facts', label: 'Tax facts' },
  { to: '/resources', label: 'Helpful links' },
  { to: '/privacy', label: 'Privacy' },
];

function DraftBanner() {
  const items = draftItems();
  if (items.length === 0) return null;
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 print:hidden" role="note">
      Draft site: {items.length} detail{items.length === 1 ? '' : 's'} still need confirmation before launch.
    </div>
  );
}

function Header({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (to: RoutePath) => pathname === to || pathname.startsWith(`${to}/`);
  const linkClass = (to: RoutePath) =>
    `block rounded-md px-3 py-2 font-medium no-underline hover:bg-brand-50 ${
      isActive(to) ? 'text-brand-800 underline decoration-2' : 'text-ink'
    }`;

  return (
    <header className="border-b border-line bg-white print:hidden">
      <Container className="flex items-center justify-between gap-4 py-4">
        <Link to="/" className="shrink-0 no-underline" aria-label={`${business.name} home`}>
          <Wordmark name={business.name} />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 whitespace-nowrap xl:flex">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} className={linkClass(item.to)} aria-current={isActive(item.to) ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
          <Link to="/contact" className="ml-2 rounded-md bg-brand-800 px-4 py-2 font-semibold text-white no-underline hover:bg-brand-700">
            Contact us
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-md border border-line px-3 py-2 font-medium xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </Container>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line xl:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className={linkClass(item.to)} aria-current={isActive(item.to) ? 'page' : undefined}>
                {item.label}
              </Link>
            ))}
            <Link to="/contact" className={linkClass('/contact')}>
              Contact us
            </Link>
            {business.phone && (
              <a href={telHref(business.phone)} className="block rounded-md px-3 py-2 font-semibold text-brand-800">
                Call {business.phone}
              </a>
            )}
          </Container>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-brand-900 text-brand-100 print:hidden">
      <Container className="grid gap-8 py-10 sm:grid-cols-3">
        <div>
          <p className="font-serif text-xl font-bold text-white">{business.name}</p>
          {business.serviceArea && <p className="mt-2 text-sm">Serving {business.serviceArea}</p>}
        </div>

        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">Get in touch</p>
          <ul className="space-y-1">
            {business.phone && (
              <li>
                <a href={telHref(business.phone)} className="text-brand-100">
                  {business.phone}
                </a>
              </li>
            )}
            {business.email && (
              <li>
                <a href={`mailto:${business.email}`} className="text-brand-100">
                  {business.email}
                </a>
              </li>
            )}
            {business.address && <li>{formatAddress(business.address)}</li>}
            <li>
              <Link to="/contact" className="text-brand-100">
                Send us a message
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">Site</p>
          <ul className="space-y-1">
            {[...NAV, ...FOOTER_EXTRA].map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-brand-100">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <Container className="border-t border-brand-700 py-4 text-xs text-brand-200">
        <p>
          © {year} {business.legalName ?? business.name}. Information on this site is general and is not tax advice for your
          specific situation.
        </p>
      </Container>
    </footer>
  );
}

export function Layout({ pathname, children }: { pathname: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2">
        Skip to main content
      </a>
      <DraftBanner />
      <Header pathname={pathname} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
