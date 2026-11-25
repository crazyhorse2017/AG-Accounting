import { resourceGroups } from '../content/site.ts';
import { LinkCard, Notice, PageHeader, Section } from '../components/ui.tsx';

export function ResourcesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Helpful tax links"
        intro="Official tools from the IRS and the State of Ohio. These links go straight to the government websites, and nothing you enter there is shared with us."
      />
      <Section>
        <div className="space-y-12">
          {resourceGroups.map((group) => (
            <section key={group.id} aria-labelledby={`res-${group.id}`}>
              <h2 id={`res-${group.id}`} className="mb-4 text-2xl">
                {group.title}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {group.resources.map((r) => (
                  <li key={r.url}>
                    <LinkCard href={r.url} title={r.title}>
                      <p className="text-base">{r.description}</p>
                      <p className="mt-3 text-xs">
                        Source: {r.source} · Link checked {r.lastReviewed}
                      </p>
                    </LinkCard>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-12">
          <Notice>
            These links are general information, not advice for your situation. If you’re unsure what applies to you, ask us.
          </Notice>
        </div>
      </Section>
    </>
  );
}
