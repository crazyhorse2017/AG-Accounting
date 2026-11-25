import type { ReactNode } from 'react';
import { glossary, officialLinks, pageFor, referenceItems, taxCenterPages } from '../content/taxCenter.ts';
import type { OfficialLink } from '../content/taxCenter.ts';
import { dueDates, FILING_STATUS_LABELS, federal, ohio } from '../content/taxYear.ts';
import type { FilingStatus } from '../content/taxYear.ts';
import { isVisible, visibleItems } from '../content/status.ts';
import { DraftBadge, ExternalLink, LinkCard, Notice, PageHeader, Section, SourceList } from '../components/ui.tsx';
import { Link } from '../lib/router.tsx';
import { longDate, money, percent } from '../lib/format.ts';

const STATUSES: FilingStatus[] = ['single', 'mfj', 'mfs', 'hoh'];

/** Wraps every Tax Center sub-page: hides it until its intro is approved, shows sources and review date. */
function TaxCenterShell({ path, children }: { path: string; children: ReactNode }) {
  const page = pageFor(path);
  if (!isVisible(page)) {
    return (
      <>
        <PageHeader eyebrow="Tax Center" title={page.title} />
        <Section>
          <Notice>This page is being reviewed and will be available soon.</Notice>
        </Section>
      </>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Tax Center"
        title={page.title}
        intro={
          <>
            {page.intro}
            <DraftBadge status={page.status} />
          </>
        }
      />
      <Section>
        <nav aria-label="Breadcrumb" className="mb-8 text-sm">
          <Link to="/tax-center" className="text-brand-800">
            Tax Center
          </Link>{' '}
          / <span className="text-muted">{page.title}</span>
        </nav>
        {children}
        <SourceList sources={page.sources} reviewedOn={page.reviewedOn} />
      </Section>
    </>
  );
}

function Empty() {
  return <Notice>This information is being reviewed and will be available soon.</Notice>;
}

export function TaxCenterHubPage() {
  const hub = pageFor('/tax-center');
  const pages = visibleItems(taxCenterPages.filter((p) => p.path !== '/tax-center'));
  return (
    <>
      <PageHeader eyebrow="Tax Center" title={hub.title} intro={isVisible(hub) ? hub.intro : undefined} />
      <Section>
        {pages.length === 0 ? (
          <Empty />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((p) => (
              <li key={p.id}>
                <LinkCard
                  to={p.path}
                  headingLevel={2}
                  title={
                    <>
                      {p.title}
                      <DraftBadge status={p.status} />
                    </>
                  }
                >
                  {p.intro}
                </LinkCard>
              </li>
            ))}
            <li>
              <LinkCard to="/calculators" headingLevel={2} title="Calculators">
                Tax, paycheck, retirement, loan, and savings estimates.
              </LinkCard>
            </li>
          </ul>
        )}
      </Section>
    </>
  );
}

function DataBlock({ item, children }: { item: { status: string; title: string; sources: { title: string; url: string }[]; reviewedOn: string | null }; children: ReactNode }) {
  if (!isVisible(item)) return null;
  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <h2 className="text-xl">
        {item.title}
        <DraftBadge status={item.status} />
      </h2>
      <div className="mt-4">{children}</div>
      <SourceList sources={item.sources} reviewedOn={item.reviewedOn} />
    </section>
  );
}

function SimpleTable({ caption, head, rows }: { caption?: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {caption && <caption className="mb-2 text-left font-medium">{caption}</caption>}
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => (
                <td key={j} className="py-1.5 pr-4">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RatesPage() {
  const f = federal;
  const anyVisible = [...Object.values(f), ohio.incomeTax].some((i) => isVisible(i));
  return (
    <TaxCenterShell path="/tax-center/rates">
      {!anyVisible && <Empty />}
      <div className="space-y-6">
        <DataBlock item={f.brackets}>
          <div className="grid gap-6 md:grid-cols-2">
            {STATUSES.map((s) => {
              let lower = 0;
              const rows = f.brackets.data[s].map((b) => {
                const range =
                  b.upTo === null ? `Over ${money(lower, true)}` : lower === 0 ? `Up to ${money(b.upTo, true)}` : `Over ${money(lower, true)} up to ${money(b.upTo, true)}`;
                const row = [percent(b.rate, 0), range];
                lower = b.upTo ?? lower;
                return row;
              });
              return <SimpleTable key={s} caption={FILING_STATUS_LABELS[s]} head={['Rate', 'Taxable income']} rows={rows} />;
            })}
          </div>
        </DataBlock>
        <DataBlock item={f.standardDeduction}>
          <SimpleTable
            head={['Filing status', 'Standard deduction']}
            rows={STATUSES.map((s) => [FILING_STATUS_LABELS[s], money(f.standardDeduction.data[s], true)])}
          />
          <p className="mt-3 text-sm text-muted">
            Age 65 or older, or blind: add {money(f.standardDeduction.data.additionalAgedOrBlind.married, true)} per person if married, or{' '}
            {money(f.standardDeduction.data.additionalAgedOrBlind.unmarried, true)} if unmarried.
          </p>
        </DataBlock>
        <DataBlock item={f.capitalGains}>
          <SimpleTable
            head={['Filing status', '0% rate up to', '15% rate up to', '20% rate above']}
            rows={STATUSES.map((s) => [
              FILING_STATUS_LABELS[s],
              money(f.capitalGains.data.zeroRateMax[s], true),
              money(f.capitalGains.data.fifteenRateMax[s], true),
              money(f.capitalGains.data.fifteenRateMax[s], true),
            ])}
          />
          <p className="mt-3 text-sm text-muted">For long-term gains and qualified dividends, based on taxable income.</p>
        </DataBlock>
        <DataBlock item={f.payroll}>
          <ul className="list-disc space-y-1 pl-6 text-sm">
            <li>Social Security: {percent(f.payroll.data.socialSecurityRate)} each for employee and employer, on wages up to {money(f.payroll.data.socialSecurityWageBase, true)}.</li>
            <li>Medicare: {percent(f.payroll.data.medicareRate, 2)} each on all wages.</li>
            <li>
              Additional Medicare: {percent(f.payroll.data.additionalMedicareRate)} on wages over {money(f.payroll.data.additionalMedicareThreshold.single, true)} (single),{' '}
              {money(f.payroll.data.additionalMedicareThreshold.mfj, true)} (married filing jointly), or {money(f.payroll.data.additionalMedicareThreshold.mfs, true)} (married filing separately).
            </li>
          </ul>
        </DataBlock>
        <DataBlock item={f.childTaxCredit}>
          <p className="text-sm">
            Up to {money(f.childTaxCredit.data.perChild, true)} per qualifying child, with up to {money(f.childTaxCredit.data.refundableMaxPerChild, true)} refundable. It begins
            to phase out above {money(f.childTaxCredit.data.phaseoutStart.single, true)} of income ({money(f.childTaxCredit.data.phaseoutStart.mfj, true)} for joint filers).
          </p>
        </DataBlock>
        <DataBlock item={f.eitc}>
          <SimpleTable
            head={['Children', 'Maximum credit', 'Phases out completely at (joint)', '(other filers)']}
            rows={f.eitc.data.byChildren.map((r) => [r.children === 3 ? '3 or more' : String(r.children), money(r.maxCredit, true), money(r.phaseoutEndJoint, true), money(r.phaseoutEndOther, true)])}
          />
        </DataBlock>
        <DataBlock item={f.retirement}>
          <SimpleTable
            head={['Account', 'Limit', 'Catch-up (50+)']}
            rows={[
              ['401(k), 403(b), 457, TSP', money(f.retirement.data.employeeDeferral401k, true), `${money(f.retirement.data.catchUp401kAge50, true)} (${money(f.retirement.data.catchUp401kAge60to63, true)} at ages 60–63)`],
              ['IRA (traditional and Roth combined)', money(f.retirement.data.ira, true), money(f.retirement.data.iraCatchUpAge50, true)],
              ['SIMPLE IRA', money(f.retirement.data.simple, true), `${money(f.retirement.data.simpleCatchUpAge50, true)} (${money(f.retirement.data.simpleCatchUpAge60to63, true)} at ages 60–63)`],
            ]}
          />
        </DataBlock>
        <DataBlock item={f.mileage}>
          <ul className="list-disc space-y-1 pl-6 text-sm">
            {f.mileage.data.businessCentsPerMile.map((p) => (
              <li key={p.from}>
                {longDate(p.from)} to {longDate(p.to)}: {p.cents}¢ per business mile
              </li>
            ))}
          </ul>
        </DataBlock>
        <DataBlock item={ohio.incomeTax}>
          <p className="text-sm">{ohio.incomeTax.data.note}</p>
          <p className="mt-2 text-sm text-muted">Ohio business income is taxed separately at {percent(ohio.incomeTax.data.businessIncomeRate, 0)} after the business income deduction.</p>
        </DataBlock>
      </div>
    </TaxCenterShell>
  );
}

export function DueDatesPage() {
  const dates = visibleItems(dueDates);
  const approvedCount = dueDates.filter((d) => d.status === 'approved').length;
  return (
    <TaxCenterShell path="/tax-center/due-dates">
      <div className="mb-8">
        {approvedCount > 0 ? (
          <Notice>
            Add these dates to your phone or computer calendar:{' '}
            <a href="/tax-calendar.ics" className="font-semibold text-brand-800">
              subscribe to our tax calendar
            </a>
            . Most calendar apps let you subscribe to a link or import the file.
          </Notice>
        ) : (
          <Notice>A calendar you can subscribe to will be available once these dates are reviewed.</Notice>
        )}
      </div>
      {dates.length === 0 ? (
        <Empty />
      ) : (
        <ol className="space-y-4">
          {dates.map((d) => (
            <li key={d.id} className="rounded-lg border border-line bg-white p-5">
              <p className="text-sm font-semibold text-accent-600">{longDate(d.date)}</p>
              <h2 className="mt-1 text-lg">
                {d.title}
                <DraftBadge status={d.status} />
              </h2>
              <p className="mt-1 text-sm text-muted">{d.description}</p>
              <p className="mt-2 text-xs text-muted">For: {d.audience.join(', ')} · {d.agencies.join(', ')}</p>
            </li>
          ))}
        </ol>
      )}
    </TaxCenterShell>
  );
}

function LinkGrid({ links }: { links: OfficialLink[] }) {
  const visible = visibleItems(links);
  if (visible.length === 0) return <Empty />;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {visible.map((l) => (
        <li key={l.id}>
          <LinkCard
            href={l.url}
            title={
              <>
                {l.title}
                <DraftBadge status={l.status} />
              </>
            }
          >
            <p>{l.description}</p>
            {l.agency && <p className="mt-2 text-xs">{l.agency === 'Local' ? 'Local (city) tax agency' : l.agency}</p>}
          </LinkCard>
        </li>
      ))}
    </ul>
  );
}

export function FormsPage() {
  return (
    <TaxCenterShell path="/tax-center/forms">
      <h2 className="mb-4 text-2xl">Forms</h2>
      <LinkGrid links={officialLinks.filter((l) => l.group === 'forms')} />
      <h2 className="mt-12 mb-4 text-2xl">Publications</h2>
      <LinkGrid links={officialLinks.filter((l) => l.group === 'publications')} />
    </TaxCenterShell>
  );
}

export function RefundsPage() {
  return (
    <TaxCenterShell path="/tax-center/refunds">
      <h2 className="mb-4 text-2xl">Check a refund</h2>
      <LinkGrid links={officialLinks.filter((l) => l.group === 'refunds')} />
      <h2 className="mt-12 mb-4 text-2xl">Payments and accounts</h2>
      <LinkGrid links={officialLinks.filter((l) => l.group === 'payments')} />
      <div className="mt-8">
        <Notice tone="warning">Only enter your Social Security number on the official government sites linked here. We will never ask for it by email or text.</Notice>
      </div>
    </TaxCenterShell>
  );
}

export function GlossaryPage() {
  const terms = visibleItems(glossary);
  const letters = [...new Set(terms.map((t) => t.term[0].toUpperCase()))];
  return (
    <TaxCenterShell path="/tax-center/glossary">
      {terms.length === 0 ? (
        <Empty />
      ) : (
        <>
          <nav aria-label="Glossary letters" className="mb-8 flex flex-wrap gap-2">
            {letters.map((l) => (
              <a key={l} href={`#letter-${l}`} className="rounded border border-line bg-white px-2.5 py-1 text-sm font-semibold text-brand-800 no-underline">
                {l}
              </a>
            ))}
          </nav>
          {letters.map((l) => (
            <section key={l} id={`letter-${l}`} className="mb-8 scroll-mt-4">
              <h2 className="mb-3 text-2xl">{l}</h2>
              <dl className="space-y-4">
                {terms
                  .filter((t) => t.term[0].toUpperCase() === l)
                  .map((t) => (
                    <div key={t.id}>
                      <dt className="font-semibold">
                        {t.term}
                        <DraftBadge status={t.status} />
                      </dt>
                      <dd className="text-muted">{t.definition}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
        </>
      )}
    </TaxCenterShell>
  );
}

export function TaxpayerRightsPage() {
  const rights = visibleItems(referenceItems.filter((r) => r.kind === 'right'));
  return (
    <TaxCenterShell path="/tax-center/taxpayer-rights">
      {rights.length === 0 ? (
        <Empty />
      ) : (
        <ol className="space-y-4">
          {rights.map((r) => (
            <li key={r.id} className="rounded-lg border border-line bg-white p-5">
              <h2 className="text-lg">
                {r.order}. {r.title}
                <DraftBadge status={r.status} />
              </h2>
              <p className="mt-1 text-muted">{r.body}</p>
            </li>
          ))}
        </ol>
      )}
    </TaxCenterShell>
  );
}

export function RecordRetentionPage() {
  const rules = visibleItems(referenceItems.filter((r) => r.kind === 'retention'));
  return (
    <TaxCenterShell path="/tax-center/record-retention">
      {rules.length === 0 ? (
        <Empty />
      ) : (
        <SimpleTable
          head={['Situation', 'Keep records for', 'Details']}
          rows={rules.map((r) => [
            <>
              {r.situation}
              <DraftBadge status={r.status} />
            </>,
            <strong>{r.title}</strong>,
            r.body,
          ])}
        />
      )}
    </TaxCenterShell>
  );
}

export function WithholdingPage() {
  return (
    <TaxCenterShell path="/tax-center/withholding">
      <div className="max-w-2xl space-y-4">
        <p>Have your most recent pay stubs and last year’s tax return handy. The estimator takes about 15 minutes and suggests changes to your Form W-4.</p>
        <p>
          <ExternalLink
            href="https://www.irs.gov/individuals/tax-withholding-estimator"
            className="inline-flex rounded-md bg-brand-800 px-5 py-3 font-semibold text-white no-underline hover:bg-brand-700"
          >
            Open the IRS Tax Withholding Estimator
          </ExternalLink>
        </p>
        <p className="text-sm text-muted">The estimator runs on IRS.gov, and nothing you enter is shared with us. For a rough idea first, try our federal income tax calculator.</p>
        <p>
          <Link to="/calculators/federal-income-tax" className="font-semibold text-brand-800">
            Federal income tax estimate
          </Link>
        </p>
      </div>
    </TaxCenterShell>
  );
}

export function AppointmentChecklistPage() {
  const groups = visibleItems(referenceItems.filter((r) => r.kind === 'checklist'));
  return (
    <TaxCenterShell path="/tax-center/appointment-checklist">
      {groups.length === 0 ? (
        <Empty />
      ) : (
        <>
          <button
            type="button"
            onClick={() => window.print()}
            className="mb-8 rounded-md border border-brand-800 bg-white px-4 py-2 font-semibold text-brand-800 hover:bg-brand-50 print:hidden"
          >
            Print this checklist
          </button>
          <div className="grid gap-6 md:grid-cols-2 print:block">
            {groups.map((g) => (
              <section key={g.id} className="rounded-lg border border-line bg-white p-5 print:mb-4 print:border-0 print:p-0">
                <h2 className="text-xl">
                  {g.title}
                  <DraftBadge status={g.status} />
                </h2>
                <ul className="mt-3 space-y-2">
                  {g.list?.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span aria-hidden="true" className="mt-1 inline-block h-4 w-4 flex-none rounded-sm border-2 border-brand-800" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </TaxCenterShell>
  );
}
