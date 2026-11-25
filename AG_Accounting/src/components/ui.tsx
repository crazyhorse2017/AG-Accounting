import type { ReactNode } from 'react';
import { Link } from '../lib/router.tsx';
import type { Source } from '../content/status.ts';

const buttonBase =
  'inline-flex select-none items-center justify-center rounded-md px-5 py-3 text-base font-semibold no-underline transition-colors';

const buttonVariants = {
  primary: 'bg-brand-800 text-white hover:bg-brand-700',
  secondary: 'border border-brand-800 bg-white text-brand-800 hover:bg-brand-50',
} as const;

type ButtonLinkProps = {
  to: string;
  variant?: keyof typeof buttonVariants;
  children: ReactNode;
};

export function ButtonLink({ to, variant = 'primary', children }: ButtonLinkProps) {
  return (
    <Link to={to} className={`${buttonBase} ${buttonVariants[variant]}`}>
      {children}
    </Link>
  );
}

type ExternalLinkProps = { href: string; children: ReactNode; className?: string };

/** Links that leave the site always open in a new tab with safe rel attributes. */
export function ExternalLink({ href, children, className }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

type PageHeaderProps = { eyebrow?: string; title: string; intro?: ReactNode };

export function PageHeader({ eyebrow, title, intro }: PageHeaderProps) {
  return (
    <header className="border-b border-line bg-brand-50">
      <Container className="py-12 sm:py-16">
        {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent-600">{eyebrow}</p>}
        <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
        {intro && <div className="mt-4 max-w-2xl text-lg text-muted">{intro}</div>}
      </Container>
    </header>
  );
}

export function Section({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`py-12 sm:py-16 ${className}`}>
      <Container>
        {title && <h2 className="mb-6 text-2xl sm:text-3xl">{title}</h2>}
        {children}
      </Container>
    </section>
  );
}

const linkCardClass =
  'group block h-full select-none rounded-lg border border-line bg-white p-5 text-ink no-underline shadow-sm transition ' +
  'hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-md focus-visible:border-brand-600 active:translate-y-0 active:shadow-sm ' +
  'motion-reduce:transform-none';

type LinkCardProps = {
  /** In-site path (client-side navigation). */
  to?: string;
  /** External URL (opens in a new tab). Use either `to` or `href`. */
  href?: string;
  title: ReactNode;
  headingLevel?: 2 | 3;
  children?: ReactNode;
};

/**
 * A card that is one big link: the whole box is clickable, shows hover and focus
 * states, and its text can't be selected (it behaves like a button).
 */
export function LinkCard({ to, href, title, headingLevel = 3, children }: LinkCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const body = (
    <>
      <Heading className="flex items-start justify-between gap-3 text-lg text-brand-800">
        <span className="group-hover:underline group-focus-visible:underline">{title}</span>
        <span aria-hidden="true" className="mt-0.5 font-sans text-brand-600 transition group-hover:translate-x-0.5 motion-reduce:transform-none">
          {href ? '↗' : '→'}
        </span>
      </Heading>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkCardClass}>
        {body}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link to={to ?? '/'} className={linkCardClass}>
      {body}
    </Link>
  );
}

/** Label shown on content that hasn't been approved yet (only visible in draft-preview builds). */
export function DraftBadge({ status }: { status: string }) {
  if (status === 'approved') return null;
  return (
    <span className="ml-2 inline-block rounded bg-amber-100 px-2 py-0.5 align-middle font-sans text-xs font-semibold uppercase tracking-wide text-amber-900">
      Draft
    </span>
  );
}

/** Sources and review date shown under reviewed content. */
export function SourceList({ sources, reviewedOn }: { sources: readonly Source[]; reviewedOn: string | null }) {
  if (sources.length === 0 && !reviewedOn) return null;
  return (
    <div className="mt-4 text-xs text-muted">
      {sources.length > 0 && (
        <p>
          Source{sources.length === 1 ? '' : 's'}:{' '}
          {sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <ExternalLink href={s.url} className="text-muted">
                {s.title}
              </ExternalLink>
            </span>
          ))}
        </p>
      )}
      <p className="mt-1">{reviewedOn ? `Last reviewed ${reviewedOn}` : 'Not yet reviewed by AG Accounting'}</p>
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  const styles =
    tone === 'warning'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-brand-200 bg-brand-50 text-brand-900';
  return <div className={`rounded-md border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
