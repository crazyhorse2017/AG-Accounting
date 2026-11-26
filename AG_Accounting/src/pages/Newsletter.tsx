import { NewsletterSignup } from '../components/NewsletterSignup.tsx';
import { ButtonLink, Notice, PageHeader, Section } from '../components/ui.tsx';
import { Link } from '../lib/router.tsx';

export function NewsletterPage() {
  return (
    <>
      <PageHeader
        eyebrow="Newsletter"
        title="Tax news and tips by email"
        intro="Choose what you’d like to receive. We’ll send a confirmation email first, and every email has a one-click unsubscribe link."
      />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
          <NewsletterSignup />
          <aside className="space-y-6">
            <div className="rounded-lg border border-line bg-white p-6">
              <h2 className="text-xl">What to expect</h2>
              <ul className="mt-3 list-disc space-y-2 pl-6 text-muted">
                <li>Plain-language tax information, reviewed by AG Accounting before it’s sent.</li>
                <li>No sales pressure and no sharing or selling of your email address.</li>
                <li>Easy to stop: unsubscribe from any email.</li>
              </ul>
            </div>
            <Notice>
              Missed an issue? Every newsletter article is also on our website in the{' '}
              <Link to="/articles" className="font-semibold text-brand-800">
                articles archive
              </Link>
              .
            </Notice>
          </aside>
        </div>
      </Section>
    </>
  );
}

export function NewsletterConfirmedPage() {
  return (
    <>
      <PageHeader eyebrow="Newsletter" title="You’re subscribed" intro="Thanks for confirming your email address. Your first email is on its way soon." />
      <Section>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/articles">Read our articles</ButtonLink>
          <ButtonLink to="/tax-center" variant="secondary">
            Visit the Tax Center
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
