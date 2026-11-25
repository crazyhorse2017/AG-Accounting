import { useMemo, useState } from 'react';
import { CALCULATOR_CATEGORIES, CALCULATORS, calculatorData, findCalculator } from '../calculators/registry.ts';
import type { Calculator } from '../calculators/registry.ts';
import { defaultValues } from '../calculators/types.ts';
import type { CalcResult, InputDef, Values } from '../calculators/types.ts';
import { isVisible, visibleItems } from '../content/status.ts';
import { ButtonLink, DraftBadge, LinkCard, Notice, PageHeader, Section, SourceList } from '../components/ui.tsx';
import { formatValue } from '../lib/format.ts';
import { NotFoundPage } from './NotFound.tsx';

const DISCLAIMER = 'Estimate only. This isn’t tax, legal, or financial advice, and real results depend on your full situation.';

export function CalculatorsIndexPage() {
  const [query, setQuery] = useState('');
  const visible = visibleItems(CALCULATORS);
  const q = query.trim().toLowerCase();
  const matches = q ? visible.filter((c) => `${c.title} ${c.summary}`.toLowerCase().includes(q)) : visible;

  return (
    <>
      <PageHeader
        eyebrow="Calculators"
        title="Tax and financial calculators"
        intro="Quick estimates for taxes, savings, loans, paychecks, and more. Nothing you enter is saved or sent anywhere: it all stays in your browser."
      />
      <Section>
        {visible.length === 0 ? (
          <Notice>Our calculators are being reviewed and will be available soon.</Notice>
        ) : (
          <>
            <label htmlFor="calc-search" className="block font-medium">
              Find a calculator
            </label>
            <input
              id="calc-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="For example: mortgage, Ohio, 401(k)"
              className="mt-1 mb-8 block w-full max-w-md rounded-md border border-line bg-white px-3 py-2"
            />
            {matches.length === 0 && <p className="text-muted">No calculators match “{query}”.</p>}
            <div className="space-y-10">
              {CALCULATOR_CATEGORIES.map((cat) => {
                const list = matches.filter((c) => c.category === cat.id);
                if (list.length === 0) return null;
                return (
                  <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
                    <h2 id={`cat-${cat.id}`} className="mb-4 text-2xl">
                      {cat.title}
                    </h2>
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((c) => (
                        <li key={c.id}>
                          <LinkCard
                            to={`/calculators/${c.id}`}
                            title={
                              <>
                                {c.title}
                                <DraftBadge status={c.status} />
                              </>
                            }
                          >
                            {c.summary}
                          </LinkCard>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </Section>
    </>
  );
}

function inputId(calc: Calculator, input: InputDef) {
  return `calc-${calc.id}-${input.id}`;
}

function CalcInput({ calc, input, value, onChange }: { calc: Calculator; input: InputDef; value: string; onChange: (v: string) => void }) {
  const id = inputId(calc, input);
  const helpId = input.help ? `${id}-help` : undefined;
  const field =
    input.kind === 'select' ? (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-md border border-line bg-white px-3 py-2" aria-describedby={helpId}>
        {input.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ) : (
      <div className="relative mt-1">
        {input.kind === 'money' && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">$</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          min={input.min}
          max={input.max}
          step={input.step ?? (input.kind === 'integer' ? 1 : 'any')}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={helpId}
          className={`block w-full rounded-md border border-line bg-white py-2 ${input.kind === 'money' ? 'pl-7' : 'pl-3'} ${input.kind === 'percent' ? 'pr-8' : 'pr-3'}`}
        />
        {input.kind === 'percent' && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">%</span>}
      </div>
    );
  return (
    <div>
      <label htmlFor={id} className="block font-medium">
        {input.label}
      </label>
      {field}
      {input.help && (
        <p id={helpId} className="mt-1 text-sm text-muted">
          {input.help}
        </p>
      )}
    </div>
  );
}

function runCalc(calc: Calculator, values: Values): CalcResult | { error: string } {
  for (const input of calc.impl.inputs) {
    if (input.kind === 'select') continue;
    const raw = values[input.id];
    if (raw === '' || !Number.isFinite(Number(raw))) return { error: `Enter a number for “${input.label}”.` };
    const n = Number(raw);
    if (input.min !== undefined && n < input.min) return { error: `“${input.label}” can’t be less than ${input.min}.` };
    if (input.max !== undefined && n > input.max) return { error: `“${input.label}” can’t be more than ${input.max}.` };
  }
  try {
    return calc.impl.compute(values);
  } catch {
    return { error: 'Something went wrong with these numbers. Please check them and try again.' };
  }
}

function CalculatorView({ calc }: { calc: Calculator }) {
  const [values, setValues] = useState<Values>(() => {
    const d = defaultValues(calc.impl.inputs);
    return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)]));
  });
  const result = useMemo(() => runCalc(calc, values), [calc, values]);
  const data = calculatorData(calc);
  const sources = [...calc.sources, ...data.flatMap((d) => d.sources)];
  const uniqueSources = sources.filter((s, i) => sources.findIndex((x) => x.url === s.url) === i);

  return (
    <>
      <PageHeader eyebrow="Calculator" title={calc.title} intro={calc.summary} />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[2fr_3fr]">
          <form className="space-y-5" onSubmit={(e) => e.preventDefault()} aria-label={`${calc.title} inputs`}>
            {calc.impl.inputs.map((input) => (
              <CalcInput
                key={input.id}
                calc={calc}
                input={input}
                value={String(values[input.id] ?? '')}
                onChange={(v) => setValues((prev) => ({ ...prev, [input.id]: v }))}
              />
            ))}
          </form>

          <div aria-live="polite">
            <div className="rounded-lg border border-line bg-white p-6">
              <h2 className="text-xl">
                Results
                <DraftBadge status={calc.status} />
              </h2>
              {'error' in result ? (
                <p className="mt-4 text-red-700">{result.error}</p>
              ) : (
                <>
                  <dl className="mt-4 divide-y divide-line">
                    {result.outputs.map((o) => (
                      <div key={o.label} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                        <dt className={o.emphasis ? 'font-semibold' : 'text-muted'}>{o.label}</dt>
                        <dd className={o.emphasis ? 'font-serif text-2xl font-bold text-brand-900' : 'font-medium'}>{formatValue(o.value, o.format)}</dd>
                      </div>
                    ))}
                  </dl>
                  {result.notes && (
                    <ul className="mt-4 space-y-1 text-sm text-muted">
                      {result.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
            {!('error' in result) && result.table && result.table.rows.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
                <table className="w-full text-sm">
                  <caption className="px-4 pt-4 text-left font-semibold">{result.table.caption}</caption>
                  <thead>
                    <tr className="border-b border-line">
                      {result.table.columns.map((c) => (
                        <th key={c} scope="col" className="px-4 py-2 text-right first:text-left">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.table.rows.map((row, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-1.5 text-right first:text-left">
                            {formatValue(cell, result.table!.formats[j])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6">
              <Notice>{DISCLAIMER}</Notice>
              <SourceList sources={uniqueSources} reviewedOn={calc.reviewedOn} />
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <ButtonLink to="/calculators" variant="secondary">
            All calculators
          </ButtonLink>
          <ButtonLink to="/contact">Ask us about your numbers</ButtonLink>
        </div>
      </Section>
    </>
  );
}

export function CalculatorPage({ slug }: { slug: string }) {
  const calc = findCalculator(slug);
  if (!calc || !isVisible(calc)) return <NotFoundPage />;
  // Remount when switching calculators so inputs reset.
  return <CalculatorView key={calc.id} calc={calc} />;
}
