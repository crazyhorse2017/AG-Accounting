import { business, portal } from '../content/site.ts';
import { ExternalLink, Notice, PageHeader, Section } from '../components/ui.tsx';
import { Link } from '../lib/router.tsx';
import { telHref } from '../lib/format.ts';

/**
 * Client portal page. The portal itself is a third-party service; this site never
 * receives or stores client documents. The page only explains it and links to it.
 */
export function ClientPortalPage() {
  const live = portal.confirmed && portal.url;
  return (
    <>
      <PageHeader
        eyebrow="Client portal"
        title="Send and receive documents securely"
        intro="Tax returns, W-2s, statements and other documents with personal information should never be sent by regular email. Our secure client portal is the safe way to share them."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-6">
            {live ? (
              <>
                <p className="text-lg">
                  Our client portal is provided by <strong>{portal.name}</strong>. You’ll sign in on their secure website, not on this one.
                </p>
                <p>
                  <ExternalLink
                    href={portal.url!}
                    className="inline-flex select-none rounded-md bg-brand-800 px-6 py-3 font-semibold text-white no-underline hover:bg-brand-700"
                  >
                    Sign in to the client portal
                  </ExternalLink>
                </p>
                {portal.steps.length > 0 && (
                  <section aria-labelledby="portal-steps">
                    <h2 id="portal-steps" className="text-2xl">
                      How it works
                    </h2>
                    <ol className="mt-3 list-decimal space-y-2 pl-6">
                      {portal.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  </section>
                )}
                {portal.features.length > 0 && (
                  <section aria-labelledby="portal-security">
                    <h2 id="portal-security" className="text-2xl">
                      How your files are protected
                    </h2>
                    <ul className="mt-3 list-disc space-y-2 pl-6">
                      {portal.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-sm text-muted">As described by {portal.name}.</p>
                  </section>
                )}
              </>
            ) : (
              <Notice>
                Our secure client portal is being set up and will be available soon. Until then, please{' '}
                {business.phone ? (
                  <a href={telHref(business.phone)} className="font-semibold text-brand-800">
                    call us at {business.phone}
                  </a>
                ) : (
                  <Link to="/contact" className="font-semibold text-brand-800">
                    contact us
                  </Link>
                )}{' '}
                before sending any documents, and we’ll arrange a safe way to share them.
              </Notice>
            )}
          </div>

          <aside className="space-y-4 rounded-lg border border-line bg-white p-6">
            <h2 className="text-xl">Keep your information safe</h2>
            <ul className="list-disc space-y-2 pl-6 text-sm text-muted">
              <li>Never email tax documents, Social Security numbers, or bank or card numbers.</li>
              <li>We will never ask for that information by email or text.</li>
              <li>If a message claiming to be from us asks for sensitive information, call our office first.</li>
              <li>Use a strong, unique password for the portal, and turn on two-step sign-in if it’s offered.</li>
            </ul>
            <p className="text-sm">
              <Link to="/tax-center/appointment-checklist" className="font-semibold text-brand-800">
                See what documents to bring
              </Link>
            </p>
          </aside>
        </div>
      </Section>
    </>
  );
}
