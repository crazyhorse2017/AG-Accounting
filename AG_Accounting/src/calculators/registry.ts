import calculatorsFile from '../content/data/calculators.json';
import type { Reviewable, Status } from '../content/status.ts';
import { federal, ohio } from '../content/taxYear.ts';
import type { CalculatorImpl } from './types.ts';
import { taxCalculators } from './impl/tax.ts';
import { businessCalculators } from './impl/business.ts';
import { personalCalculators } from './impl/personal.ts';
import { moreCalculators } from './impl/more.ts';

export type CalculatorMeta = Reviewable & {
  category: string;
  title: string;
  summary: string;
  dataIds: string[];
};

export type Calculator = CalculatorMeta & { impl: CalculatorImpl };

export const CALCULATOR_IMPLS: Record<string, CalculatorImpl> = {
  ...taxCalculators,
  ...businessCalculators,
  ...personalCalculators,
  ...moreCalculators,
};

export const CALCULATOR_CATEGORIES: { id: string; title: string }[] = calculatorsFile.categories;

const metas = calculatorsFile.items as unknown as (Omit<CalculatorMeta, 'status'> & { status: string })[];

export const CALCULATORS: Calculator[] = metas
  .filter((m) => CALCULATOR_IMPLS[m.id])
  .map((m) => ({ ...m, status: m.status as Status, impl: CALCULATOR_IMPLS[m.id] }));

/** Metadata entries without a formula, and formulas without metadata (both should be empty). */
export const registryProblems = {
  missingImpl: metas.filter((m) => !CALCULATOR_IMPLS[m.id]).map((m) => m.id),
  missingMeta: Object.keys(CALCULATOR_IMPLS).filter((id) => !metas.some((m) => m.id === id)),
};

const dataItems = [...Object.values(federal), ...Object.values(ohio)];

/** The tax-data items a calculator depends on (for showing their sources). */
export function calculatorData(calc: CalculatorMeta) {
  return calc.dataIds.map((id) => dataItems.find((d) => d.id === id)).filter((d): d is (typeof dataItems)[number] => Boolean(d));
}

export function findCalculator(slug: string): Calculator | undefined {
  return CALCULATORS.find((c) => c.id === slug);
}
