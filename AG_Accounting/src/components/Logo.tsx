/**
 * Placeholder logo: an open ledger with the AG monogram, drawn from the
 * logo idea the family supplied. Not a confirmed logo; replace when one is chosen.
 */
export function LogoMark({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        {/* Back pages */}
        <path d="M5 8v32h22l5 3 5-3h22V8" strokeWidth="1.5" />
        {/* Left and right page */}
        <path d="M9 4h20q3 0 3 3v34q0-2-3-2H9z" />
        <path d="M55 4H35q-3 0-3 3v34q0-2 3-2h20z" />
      </g>
      <text
        x="32"
        y="29"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="17"
        fontWeight="700"
        fill="currentColor"
      >
        AG
      </text>
    </svg>
  );
}

export function Wordmark({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-3 text-brand-800">
      <LogoMark className="h-9 w-auto sm:h-10" />
      <span className="font-serif text-xl font-bold uppercase tracking-wide text-brand-900 sm:text-2xl">{name}</span>
    </span>
  );
}
