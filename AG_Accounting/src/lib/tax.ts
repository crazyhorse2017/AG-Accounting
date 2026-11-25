/**
 * Tax math used by the calculators. Pure functions; all year-specific numbers come
 * from src/content/taxYear.ts so a new tax year only changes data, not code.
 * Every result is an estimate: these functions skip many real-world rules.
 */
import { fed, ohio } from '../content/taxYear.ts';
import type { Bracket, FilingStatus } from '../content/taxYear.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Progressive tax over a bracket table. */
export function progressiveTax(taxableIncome: number, brackets: readonly Bracket[]): number {
  let tax = 0;
  let lower = 0;
  const income = Math.max(0, taxableIncome);
  for (const b of brackets) {
    const upper = b.upTo ?? Infinity;
    if (income > lower) tax += (Math.min(income, upper) - lower) * b.rate;
    if (income <= upper) break;
    lower = upper;
  }
  return round2(tax);
}

export function marginalRate(taxableIncome: number, brackets: readonly Bracket[]): number {
  const income = Math.max(0, taxableIncome);
  for (const b of brackets) {
    if (b.upTo === null || income <= b.upTo) return b.rate;
  }
  return brackets[brackets.length - 1].rate;
}

export function federalIncomeTax(taxableIncome: number, status: FilingStatus): number {
  return progressiveTax(taxableIncome, fed.brackets[status]);
}

export function standardDeduction(status: FilingStatus, agedOrBlindCount = 0): number {
  const base = fed.standardDeduction[status];
  const married = status === 'mfj' || status === 'mfs';
  const extra = married ? fed.standardDeduction.additionalAgedOrBlind.married : fed.standardDeduction.additionalAgedOrBlind.unmarried;
  return base + Math.max(0, Math.floor(agedOrBlindCount)) * extra;
}

/**
 * Tax on taxable income that includes long-term gains / qualified dividends,
 * using the 0/15/20% stacking method (simplified; ignores the 25%/28% rate groups).
 */
export function taxWithCapitalGains(taxableIncome: number, ltGains: number, status: FilingStatus) {
  const total = Math.max(0, taxableIncome);
  const gains = Math.min(Math.max(0, ltGains), total);
  const ordinary = total - gains;
  const ordinaryTax = federalIncomeTax(ordinary, status);
  const zeroMax = fed.capitalGains.zeroRateMax[status];
  const fifteenMax = fed.capitalGains.fifteenRateMax[status];
  const atZero = Math.max(0, Math.min(total, zeroMax) - ordinary);
  const atFifteen = Math.max(0, Math.min(total, fifteenMax) - Math.max(ordinary, zeroMax));
  const atTwenty = Math.max(0, gains - atZero - atFifteen);
  const gainsTax = round2(atFifteen * 0.15 + atTwenty * 0.2);
  return { ordinaryTax, gainsTax, total: round2(ordinaryTax + gainsTax), atZero, atFifteen, atTwenty };
}

export function selfEmploymentTax(netProfit: number, status: FilingStatus, w2Wages = 0) {
  const p = fed.payroll;
  const base = Math.max(0, netProfit) * p.selfEmploymentEarningsFactor;
  if (base < 400) return { socialSecurity: 0, medicare: 0, additionalMedicare: 0, total: 0, deductibleHalf: 0, base: round2(base) };
  const ssRoom = Math.max(0, p.socialSecurityWageBase - Math.max(0, w2Wages));
  const socialSecurity = Math.min(base, ssRoom) * p.socialSecurityRate * 2;
  const medicare = base * p.medicareRate * 2;
  const threshold = p.additionalMedicareThreshold[status];
  const additionalMedicare = Math.max(0, base + Math.max(0, w2Wages) - Math.max(threshold, Math.max(0, w2Wages))) * p.additionalMedicareRate;
  const seTax = socialSecurity + medicare;
  return {
    base: round2(base),
    socialSecurity: round2(socialSecurity),
    medicare: round2(medicare),
    additionalMedicare: round2(additionalMedicare),
    total: round2(seTax + additionalMedicare),
    deductibleHalf: round2(seTax / 2),
  };
}

/** Employee share of Social Security and Medicare on wages. */
export function employeeFica(wages: number, status: FilingStatus) {
  const p = fed.payroll;
  const w = Math.max(0, wages);
  const socialSecurity = Math.min(w, p.socialSecurityWageBase) * p.socialSecurityRate;
  const medicare = w * p.medicareRate;
  const additionalMedicare = Math.max(0, w - p.additionalMedicareThreshold[status]) * p.additionalMedicareRate;
  return {
    socialSecurity: round2(socialSecurity),
    medicare: round2(medicare),
    additionalMedicare: round2(additionalMedicare),
    total: round2(socialSecurity + medicare + additionalMedicare),
  };
}

export function childTaxCredit(children: number, magi: number, status: FilingStatus) {
  const c = fed.childTaxCredit;
  const kids = Math.max(0, Math.floor(children));
  const max = kids * c.perChild;
  const over = Math.max(0, magi - c.phaseoutStart[status]);
  const reduction = Math.ceil(over / 1000) * c.phaseoutPer1000;
  const credit = Math.max(0, max - reduction);
  return { maxCredit: max, reduction: Math.min(reduction, max), credit, refundableCap: Math.min(credit, kids * c.refundableMaxPerChild) };
}

export function earnedIncomeCredit(children: number, earnedIncome: number, agi: number, status: FilingStatus, investmentIncome = 0) {
  if (status === 'mfs') return { credit: 0, reason: 'Married filing separately usually can’t claim the EITC unless special separation rules apply.' };
  const e = fed.eitc;
  if (investmentIncome > e.investmentIncomeLimit) return { credit: 0, reason: `Investment income over $${e.investmentIncomeLimit.toLocaleString('en-US')} makes you ineligible.` };
  const row = e.byChildren[Math.min(3, Math.max(0, Math.floor(children)))];
  const joint = status === 'mfj';
  const start = joint ? row.phaseoutStartJoint : row.phaseoutStartOther;
  const end = joint ? row.phaseoutEndJoint : row.phaseoutEndOther;
  const earned = Math.max(0, earnedIncome);
  const phaseInRate = row.maxCredit / row.earnedIncomeAmount;
  const phaseOutRate = row.maxCredit / (end - start);
  const byIncome = (income: number) => {
    const phasedIn = Math.min(row.maxCredit, income * phaseInRate);
    const phasedOut = row.maxCredit - Math.max(0, income - start) * phaseOutRate;
    return Math.max(0, Math.min(phasedIn, phasedOut));
  };
  // The credit is figured on earned income, and on AGI if AGI is higher; the smaller amount applies.
  const credit = Math.round(Math.min(byIncome(earned), Math.max(0, agi) > earned ? byIncome(agi) : Infinity));
  return { credit: Math.max(0, credit), reason: null as string | null };
}

/** Taxable part of Social Security benefits (IRS Pub. 915 worksheet, simplified). */
export function taxableSocialSecurity(benefits: number, otherIncome: number, taxExemptInterest: number, status: FilingStatus): number {
  const o = fed.other;
  const b = Math.max(0, benefits);
  const provisional = Math.max(0, otherIncome) + Math.max(0, taxExemptInterest) + b / 2;
  const base = o.socialSecurityBenefitBase[status];
  const adjusted = o.socialSecurityBenefitAdjustedBase[status];
  if (status === 'mfs' && base === 0) return round2(Math.min(0.85 * b, 0.85 * provisional));
  if (provisional <= base) return 0;
  const firstTier = Math.min(0.5 * b, 0.5 * (Math.min(provisional, adjusted) - base));
  if (provisional <= adjusted) return round2(firstTier);
  const taxable = Math.min(0.85 * b, 0.85 * (provisional - adjusted) + Math.min(firstTier, 0.5 * (adjusted - base)));
  return round2(taxable);
}

export function ohioIncomeTax(ohioTaxableIncome: number): number {
  const d = ohio.incomeTax.data;
  const income = Math.max(0, ohioTaxableIncome);
  if (income <= d.zeroBracketMax) return 0;
  return round2(d.baseTaxAboveThreshold + (income - d.zeroBracketMax) * d.rateAboveThreshold);
}

/** Business standard mileage deduction, split by the two 2026 rate periods. */
export function mileageDeduction(milesByPeriod: readonly number[]): { total: number; parts: { cents: number; miles: number; amount: number }[] } {
  const periods = fed.mileage.businessCentsPerMile;
  const parts = periods.map((p, i) => {
    const miles = Math.max(0, milesByPeriod[i] ?? 0);
    return { cents: p.cents, miles, amount: round2((miles * p.cents) / 100) };
  });
  return { total: round2(parts.reduce((s, p) => s + p.amount, 0)), parts };
}
