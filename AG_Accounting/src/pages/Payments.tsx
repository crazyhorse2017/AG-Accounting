import { business, payments } from '../content/site.ts';
import { ExternalLink, Notice, PageHeader, Section } from '../components/ui.tsx';
import { Link } from '../lib/router.tsx';
import { telHref } from '../lib/format.ts';

export function PaymentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Payments"
        title="Paying an invoice"
        intro={`We bill by invoice, and payments are handled securely by ${payments.provider}. Card details never pass through this website.`}
      />
      <Section>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl">How it works</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-6">
              <li>When your work is finished, we send your invoice by email through {payments.provider}.</li>
              <li>Open the email and select the link to view your invoice.</li>
              <li>Pay on {payments.provider}’s secure page. You’ll get a receipt by email.</li>
            </ol>
            {payments.paymentUrl && (
              <p className="mt-6">
                <ExternalLink
                  href={payments.paymentUrl}
                  className="inline-flex rounded-md bg-brand-800 px-5 py-3 font-semibold text-white no-underline hover:bg-brand-700"
                >
                  Pay with {payments.provider}
                </ExternalLink>
              </p>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl">Stay safe</h2>
            <Notice tone="warning">
              We will never ask for your card number, bank account number, or Social Security number by email, text, or
              through this website.
            </Notice>
            <p className="text-muted">
              If an invoice or payment request looks unusual, don’t pay it. Contact us first to confirm it came from us.
            </p>
            <p>
              {business.phone ? (
                <a href={telHref(business.phone)} className="font-semibold text-brand-800">
                  Call {business.phone}
                </a>
              ) : (
                <Link to="/contact" className="font-semibold text-brand-800">
                  Contact us
                </Link>
              )}
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
