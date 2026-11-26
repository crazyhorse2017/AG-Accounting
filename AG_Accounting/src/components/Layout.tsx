import { useEffect, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, ReactNode } from 'react';
import { business, draftItems } from '../content/site.ts';
import { activeLink, NAV_GROUPS } from '../content/navigation.ts';
import type { NavGroup } from '../content/navigation.ts';
import { Link } from '../lib/router.tsx';
import { Container } from './ui.tsx';
import { Wordmark } from './Logo.tsx';
import { formatAddress, telHref } from '../lib/format.ts';

function DraftBanner() {
  const items = draftItems();
  if (items.length === 0) return null;
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 print:hidden" role="note">
      Draft site: {items.length} detail{items.length === 1 ? '' : 's'} still need confirmation before launch.
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-4 w-4 transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One top-bar dropdown: opens on hover or click, closes on Escape, outside click, or navigation. */
function Dropdown({
  group,
  active,
  open,
  onOpen,
  onClose,
  onToggle,
}: {
  group: NavGroup;
  active: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
}) {
  const links = group.links ?? [];
  const groupActive = links.some((l) => l.to === active);
  const panelId = `nav-panel-${group.id}`;
  const buttonRef = useRef<HTMLButtonElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      onClose();
      buttonRef.current?.focus();
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    // Keyboard users tabbing out of the panel close it.
    if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
  };

  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        // A mouse click on a hover-opened menu keeps it open; Enter/Space (detail 0) toggles it.
        onClick={(event) => (event.detail > 0 ? onOpen() : onToggle())}
        className={`flex items-center gap-1 rounded-md px-3 py-2 font-medium hover:bg-brand-50 ${
          open ? 'bg-brand-50' : ''
        } ${groupActive ? 'text-brand-800 underline decoration-2 underline-offset-4' : 'text-ink'}`}
      >
        {group.label}
        <Chevron open={open} />
      </button>

      {/* pt-2 bridges the gap so moving the mouse from the button to the panel keeps it open. */}
      <div
        id={panelId}
        hidden={!open}
        className={`absolute top-full z-40 pt-2 ${group.alignRight ? 'right-0' : group.wide ? 'left-1/2 -translate-x-1/2' : 'left-0'}`}
      >
        <ul
          className={`grid gap-1 rounded-xl border border-line bg-white p-2 shadow-xl shadow-brand-900/10 ${
            group.wide ? 'w-[36rem] grid-cols-2' : 'w-72'
          }`}
        >
          {links.map((link) => {
            const current = link.to === active;
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  aria-current={current ? 'page' : undefined}
                  onClick={onClose}
                  className={`group block h-full select-none whitespace-normal rounded-lg border-l-4 px-3 py-2 no-underline hover:bg-brand-50 focus-visible:bg-brand-50 ${
                    current ? 'border-accent-500 bg-brand-50' : 'border-transparent'
                  }`}
                >
                  <span className="block font-semibold text-brand-900 group-hover:text-brand-700">{link.label}</span>
                  {link.description && <span className="mt-0.5 block text-sm leading-snug text-muted">{link.description}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function DesktopNav({ pathname }: { pathname: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const navRef = useRef<HTMLElement>(null);
  const active = activeLink(pathname);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const open = (id: string) => {
    cancelClose();
    setOpenId(id);
  };
  // A short delay so a mouse passing between the button and the panel doesn't flicker it shut.
  const close = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenId(null), 150);
  };
  const closeNow = () => {
    cancelClose();
    setOpenId(null);
  };

  useEffect(closeNow, [pathname]);
  useEffect(() => {
    if (openId === null) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) closeNow();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openId]);
  useEffect(() => cancelClose, []);

  return (
    <nav ref={navRef} aria-label="Main" className="hidden select-none items-center gap-1 whitespace-nowrap xl:flex">
      {NAV_GROUPS.map((group) =>
        group.links ? (
          <Dropdown
            key={group.id}
            group={group}
            active={active}
            open={openId === group.id}
            onOpen={() => open(group.id)}
            onClose={close}
            onToggle={() => (openId === group.id ? closeNow() : open(group.id))}
          />
        ) : (
          <Link
            key={group.id}
            to={group.to ?? '/'}
            aria-current={active === group.to ? 'page' : undefined}
            className={`block rounded-md px-3 py-2 font-medium no-underline hover:bg-brand-50 ${
              active === group.to ? 'text-brand-800 underline decoration-2 underline-offset-4' : 'text-ink'
            }`}
          >
            {group.label}
          </Link>
        ),
      )}
      <Link to="/contact" className="ml-2 rounded-md bg-brand-800 px-4 py-2 font-semibold text-white no-underline hover:bg-brand-700">
        Contact us
      </Link>
    </nav>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const active = activeLink(pathname);
  const linkClass = (to: string) =>
    `block select-none rounded-md px-3 py-2 no-underline hover:bg-brand-50 ${
      active === to ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink'
    }`;
  return (
    <nav id="mobile-nav" aria-label="Main" className="border-t border-line xl:hidden">
      <Container className="grid gap-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.id}>
            {group.links ? (
              <>
                <p className="px-3 text-xs font-semibold uppercase tracking-wider text-accent-600">{group.label}</p>
                <ul className="mt-1">
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className={linkClass(link.to)} aria-current={active === link.to ? 'page' : undefined}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Link to={group.to ?? '/'} className={`${linkClass(group.to ?? '/')} font-semibold`}>
                {group.label}
              </Link>
            )}
          </div>
        ))}
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
          <Link to="/contact" className="select-none rounded-md bg-brand-800 px-4 py-2 text-center font-semibold text-white no-underline hover:bg-brand-700">
            Contact us
          </Link>
          {business.phone && (
            <a href={telHref(business.phone)} className="block select-none rounded-md px-3 py-2 text-center font-semibold text-brand-800">
              Call {business.phone}
            </a>
          )}
        </div>
      </Container>
    </nav>
  );
}

function Header({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="relative z-30 border-b border-line bg-white print:hidden">
      <Container className="flex items-center justify-between gap-4 py-4">
        <Link to="/" className="shrink-0 no-underline" aria-label={`${business.name} home`}>
          <Wordmark name={business.name} />
        </Link>

        <DesktopNav pathname={pathname} />

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

      {open && <MobileNav pathname={pathname} />}
    </header>
  );
}

/** Footer columns: the dropdown groups, with plain top-bar links (Calculators) folded into Tax Center. */
const FOOTER_COLUMNS = NAV_GROUPS.filter((g) => g.links).map((g) => ({
  label: g.label,
  links: [...(g.links ?? []), ...(g.id === 'tax-center' ? NAV_GROUPS.filter((p) => !p.links && p.to).map((p) => ({ to: p.to ?? '/', label: p.label })) : [])],
}));

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-brand-900 text-brand-100 print:hidden">
      <Container className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
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

        {FOOTER_COLUMNS.map((col) => (
          <div key={col.label} className="text-sm">
            <p className="mb-2 font-semibold text-white">{col.label}</p>
            <ul className="space-y-1">
              {col.links.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-brand-100">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
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
