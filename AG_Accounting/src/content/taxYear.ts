/**
 * Typed access to the current tax-year data files.
 * To roll over to a new year: add src/content/data/tax-years/<year>/ and point these imports at it.
 */
import federalFile from './data/tax-years/2026/federal.json';
import ohioFile from './data/tax-years/2026/ohio.json';
import dueDatesFile from './data/tax-years/2026/due-dates.json';
import type { Reviewable, Status } from './status.ts';

export const CURRENT_TAX_YEAR = 2026;

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh';

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: 'Single',
  mfj: 'Married filing jointly',
  mfs: 'Married filing separately',
  hoh: 'Head of household',
};

export type Bracket = { upTo: number | null; rate: number };

export type DataItem<T> = Reviewable & { title: string; data: T };

type PerStatus<T> = Record<FilingStatus, T>;

type FederalData = {
  brackets: PerStatus<Bracket[]>;
  standardDeduction: PerStatus<number> & { additionalAgedOrBlind: { married: number; unmarried: number } };
  capitalGains: { zeroRateMax: PerStatus<number>; fifteenRateMax: PerStatus<number> };
  payroll: {
    socialSecurityRate: number;
    socialSecurityWageBase: number;
    medicareRate: number;
    additionalMedicareRate: number;
    additionalMedicareThreshold: PerStatus<number>;
    selfEmploymentEarningsFactor: number;
  };
  childTaxCredit: { perChild: number; refundableMaxPerChild: number; phaseoutStart: PerStatus<number>; phaseoutPer1000: number };
  eitc: {
    byChildren: {
      children: number;
      earnedIncomeAmount: number;
      maxCredit: number;
      phaseoutStartJoint: number;
      phaseoutEndJoint: number;
      phaseoutStartOther: number;
      phaseoutEndOther: number;
    }[];
    investmentIncomeLimit: number;
  };
  retirement: {
    employeeDeferral401k: number;
    catchUp401kAge50: number;
    catchUp401kAge60to63: number;
    totalAdditions415c: number;
    ira: number;
    iraCatchUpAge50: number;
    simple: number;
    simpleCatchUpAge50: number;
    simpleCatchUpAge60to63: number;
  };
  mileage: { businessCentsPerMile: { from: string; to: string; cents: number }[] };
  other: {
    annualGiftExclusion: number;
    estateBasicExclusion: number;
    kiddieTaxUnearnedIncomeAmount: number;
    homeOfficeSimplifiedRatePerSqFt: number;
    homeOfficeSimplifiedMaxSqFt: number;
    socialSecurityBenefitBase: PerStatus<number>;
    socialSecurityBenefitAdjustedBase: PerStatus<number>;
  };
  more: {
    supplementalWithholdingRate: number;
    supplementalWithholdingRateOver1M: number;
    homeSaleExclusion: PerStatus<number>;
    earlyDistributionAdditionalTaxRate: number;
    capitalLossLimit: PerStatus<number>;
  };
  rmd: {
    startAgeBornBefore1960: number;
    startAgeBorn1960OrLater: number;
    distributionPeriodByAge: Record<string, number>;
  };
  ssClaiming: {
    fullRetirementAgeBorn1960OrLater: number;
    earlyReductionPerMonthFirst36: number;
    earlyReductionPerMonthAfter36: number;
    delayedCreditPerYear: number;
    earliestClaimAge: number;
    latestCreditAge: number;
  };
};

const FEDERAL_IDS: Record<keyof FederalData, string> = {
  brackets: 'fed-2026-brackets',
  standardDeduction: 'fed-2026-standard-deduction',
  capitalGains: 'fed-2026-capital-gains',
  payroll: 'fed-2026-payroll-taxes',
  childTaxCredit: 'fed-2026-child-tax-credit',
  eitc: 'fed-2026-eitc',
  retirement: 'fed-2026-retirement-limits',
  mileage: 'fed-2026-mileage',
  other: 'fed-2026-other-figures',
  more: 'fed-2026-more-figures',
  rmd: 'fed-rmd-uniform-lifetime-table',
  ssClaiming: 'fed-social-security-claiming',
};

type RawItem = Omit<Reviewable, 'status'> & { status: string; title: string; data: unknown };

function findItem(items: readonly RawItem[], id: string): RawItem {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`Missing tax data item ${id}`);
  return item;
}

function asItem<T>(raw: RawItem): DataItem<T> {
  return { ...raw, status: raw.status as Status, data: raw.data as T };
}

const federalItems = federalFile.items as unknown as RawItem[];

export const federal = Object.fromEntries(
  (Object.keys(FEDERAL_IDS) as (keyof FederalData)[]).map((key) => [key, asItem(findItem(federalItems, FEDERAL_IDS[key]))]),
) as { [K in keyof FederalData]: DataItem<FederalData[K]> };

/** The data alone, for calculators. */
export const fed: FederalData = Object.fromEntries(
  Object.entries(federal).map(([key, item]) => [key, item.data]),
) as unknown as FederalData;

export const federalBracketChecks = (findItem(federalItems, 'fed-2026-brackets') as RawItem & { checks: PerStatus<number[]> }).checks;

export type OhioData = {
  zeroBracketMax: number;
  baseTaxAboveThreshold: number;
  rateAboveThreshold: number;
  businessIncomeRate: number;
  note: string;
};

export const ohio = {
  incomeTax: asItem<OhioData>(findItem(ohioFile.items as unknown as RawItem[], 'oh-2026-income-tax')),
};

export type DueDate = Reviewable & {
  date: string;
  title: string;
  description: string;
  audience: string[];
  agencies: string[];
};

export const dueDates: DueDate[] = (dueDatesFile.items as unknown as DueDate[]).slice().sort((a, b) => a.date.localeCompare(b.date));

/** IDs of all tax-year data items (used to check calculator dependencies). */
export const TAX_DATA_IDS: string[] = [
  ...federalItems.map((i) => i.id),
  ...(ohioFile.items as unknown as RawItem[]).map((i) => i.id),
];

export function taxDataStatus(id: string): Status | null {
  const all = [...federalItems, ...(ohioFile.items as unknown as RawItem[])];
  const item = all.find((i) => i.id === id);
  return item ? (item.status as Status) : null;
}
