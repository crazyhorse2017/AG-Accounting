import { business, founder, highlights } from '../content/site.ts';
import { ButtonLink, PageHeader, Section } from '../components/ui.tsx';

export function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title={`About ${business.name}`}
        intro="A small, local practice where clients deal directly with the person doing their work."
      />
      <Section>
        <div className="grid gap-10 md:grid-cols-[2fr_1fr]">
          <div className="space-y-4 text-lg">
            {founder.bio.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <aside className="rounded-lg border border-line bg-white p-6">
            <h2 className="text-xl">{founder.name ?? founder.role}</h2>
            {founder.name && <p className="text-sm text-muted">{founder.role}</p>}
            {founder.credentials.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {founder.credentials.map((c) => (
                  <li key={c} className="border-l-4 border-accent-500 pl-3">
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </Section>
      <Section title="What you can expect" className="bg-white">
        <ul className="grid gap-6 md:grid-cols-3">
          {highlights.map((h) => (
            <li key={h.title}>
              <h3 className="text-lg">{h.title}</h3>
              <p className="mt-2 text-muted">{h.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <ButtonLink to="/contact">Talk with us</ButtonLink>
        </div>
      </Section>
    </>
  );
}
