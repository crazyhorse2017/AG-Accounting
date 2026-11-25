import type { ReactNode } from 'react';
import { Link } from '../lib/router.tsx';
import type { RoutePath } from '../lib/router.tsx';

const buttonBase =
  'inline-flex items-center justify-center rounded-md px-5 py-3 text-base font-semibold no-underline transition-colors';

const buttonVariants = {
  primary: 'bg-brand-800 text-white hover:bg-brand-700',
  secondary: 'border border-brand-800 bg-white text-brand-800 hover:bg-brand-50',
} as const;

type ButtonLinkProps = {
  to: RoutePath;
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

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  const styles =
    tone === 'warning'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-brand-200 bg-brand-50 text-brand-900';
  return <div className={`rounded-md border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
