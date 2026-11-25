import { business } from '../content/site.ts';
import { Notice, PageHeader, Section } from '../components/ui.tsx';
import { CONTACT_RETENTION_DAYS } from '../shared/policy.ts';

export function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Privacy" title="Privacy" intro={`How ${business.name}’s website handles your information.`} />
      <Section>
        <div className="max-w-3xl space-y-8">
          <Notice tone="warning">Draft: this page needs review and approval before the site launches.</Notice>

          <section>
            <h2 className="text-2xl">What this website collects</h2>
            <p className="mt-3">
              When you use the contact form, we receive the name, email address, optional phone number, topic, and message you
              enter. We use this only to respond to you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl">What this website never collects</h2>
            <p className="mt-3">
              This website does not accept or store Social Security numbers, tax returns, bank account numbers, or payment card
              numbers. Invoices are paid on PayPal’s own secure site, and tax documents are exchanged through a separate secure
              portal, never through this website or ordinary email.
            </p>
          </section>

          <section>
            <h2 className="text-2xl">How long messages are kept</h2>
            <p className="mt-3">
              Contact form messages are deleted from the website automatically after {CONTACT_RETENTION_DAYS} days. To limit
              spam, the site keeps a scrambled, one-way code derived from your network address for the same period. It cannot
              be turned back into your address.
            </p>
          </section>

          <section>
            <h2 className="text-2xl">Cookies and tracking</h2>
            <p className="mt-3">This website does not use advertising cookies or third-party tracking.</p>
          </section>

          <section>
            <h2 className="text-2xl">Links to other websites</h2>
            <p className="mt-3">
              Our resources page links to government websites such as the IRS. Those sites have their own privacy policies, and
              information you enter there is not shared with us.
            </p>
          </section>
        </div>
      </Section>
    </>
  );
}
