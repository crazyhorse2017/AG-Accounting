import { business, highlights, services } from '../content/site.ts';
import { ButtonLink, Container, Section } from '../components/ui.tsx';
import { Link } from '../lib/router.tsx';

export function HomePage() {
  return (
    <>
      <section className="border-b border-line bg-white">
        <Container className="grid gap-10 py-16 sm:py-24 md:grid-cols-[3fr_2fr] md:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent-600">
              Tax and accounting{business.serviceArea ? ` · ${business.serviceArea}` : ''}
            </p>
            <h1 className="text-4xl leading-tight sm:text-5xl">Taxes done right, by someone you can call.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{business.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/contact">Get in touch</ButtonLink>
              <ButtonLink to="/services" variant="secondary">
                See our services
              </ButtonLink>
            </div>
          </div>

          <aside className="rounded-lg border border-line bg-brand-50 p-6" aria-labelledby="home-how-title">
            <h2 id="home-how-title" className="text-xl">
              How working with us goes
            </h2>
            <ol className="mt-4 space-y-3 text-muted">
              {[
                'Reach out by phone or with the contact form.',
                'We talk through what you need and what to bring.',
                'We prepare your return or books and walk you through them.',
                'You get an invoice by email and can pay online.',
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-800 text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </aside>
        </Container>
      </section>

      <Section title="What we do">
        <ul className="grid gap-5 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.id} className="rounded-lg border border-line bg-white p-6">
              <h3 className="text-xl">{s.title}</h3>
              <p className="mt-2 text-muted">{s.summary}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6">
          <Link to="/services" className="font-semibold text-brand-800">
            More about our services
          </Link>
        </p>
      </Section>

      <Section title="Why clients stay" className="bg-white">
        <ul className="grid gap-6 md:grid-cols-3">
          {highlights.map((h) => (
            <li key={h.title} className="border-l-4 border-accent-500 pl-4">
              <h3 className="text-lg">{h.title}</h3>
              <p className="mt-2 text-muted">{h.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className="rounded-lg bg-brand-800 px-6 py-10 text-center text-white sm:px-12">
          <h2 className="text-2xl text-white sm:text-3xl">Have a question about your taxes?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Tell us a little about what you need and we’ll get back to you.
          </p>
          <div className="mt-6">
            <Link to="/contact" className="inline-flex rounded-md bg-white px-5 py-3 font-semibold text-brand-800 no-underline hover:bg-brand-50">
              Contact us
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
