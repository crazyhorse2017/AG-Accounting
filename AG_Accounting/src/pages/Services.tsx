import { services } from '../content/site.ts';
import { ButtonLink, PageHeader, Section } from '../components/ui.tsx';

export function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="How we can help"
        intro="Every engagement starts with a conversation about your situation. Fees depend on the work involved, so we’ll talk them through with you before we start."
      />
      <Section>
        <div className="space-y-6">
          {services.map((s) => (
            <article key={s.id} id={s.id} className="scroll-mt-6 rounded-lg border border-line bg-white p-6 sm:p-8">
              <h2 className="text-2xl">{s.title}</h2>
              <p className="mt-1 text-sm font-medium text-accent-600">For {s.audience.toLowerCase()}</p>
              <p className="mt-3 text-muted">{s.summary}</p>
              <ul className="mt-4 list-disc space-y-1 pl-6">
                {s.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <ButtonLink to="/contact">Ask about a service</ButtonLink>
          <p className="text-muted">Not sure which one fits? Just describe what you need.</p>
        </div>
      </Section>
    </>
  );
}
