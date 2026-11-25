import { fed } from '../../content/taxYear.ts';
import type { FilingStatus } from '../../content/taxYear.ts';
import {
  childTaxCredit,
  earnedIncomeCredit,
  federalIncomeTax,
  marginalRate,
  ohioIncomeTax,
  selfEmploymentTax,
  standardDeduction,
  taxableSocialSecurity,
  taxWithCapitalGains,
} from '../../lib/tax.ts';
import { FILING_STATUS_INPUT, num, str } from '../types.ts';
import type { CalculatorImpl } from '../types.ts';

const status = (v: Record<string, number | string>) => str(v, 'status') as FilingStatus;

export const taxCalculators: Record<string, CalculatorImpl> = {
  'federal-income-tax': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'income', label: 'Total income (wages, interest, etc.)', kind: 'money', default: 75000, min: 0 },
      { id: 'adjustments', label: 'Adjustments (IRA, student loan interest, etc.)', kind: 'money', default: 0, min: 0 },
      { id: 'itemized', label: 'Itemized deductions (0 to use the standard deduction)', kind: 'money', default: 0, min: 0 },
      { id: 'agedBlind', label: 'People 65+ or blind (0, 1 or 2)', kind: 'integer', default: 0, min: 0, max: 4 },
      { id: 'credits', label: 'Tax credits', kind: 'money', default: 0, min: 0 },
    ],
    compute(v) {
      const s = status(v);
      const agi = Math.max(0, num(v, 'income') - num(v, 'adjustments'));
      const std = standardDeduction(s, num(v, 'agedBlind'));
      const deduction = Math.max(std, num(v, 'itemized'));
      const taxable = Math.max(0, agi - deduction);
      const tax = federalIncomeTax(taxable, s);
      const afterCredits = Math.max(0, tax - num(v, 'credits'));
      return {
        outputs: [
          { label: 'Adjusted gross income', value: agi, format: 'money' },
          { label: deduction === std ? 'Standard deduction' : 'Itemized deductions', value: deduction, format: 'money' },
          { label: 'Taxable income', value: taxable, format: 'money' },
          { label: 'Federal income tax after credits', value: afterCredits, format: 'money', emphasis: true },
          { label: 'Top (marginal) rate', value: marginalRate(taxable, fed.brackets[s]), format: 'percent' },
          { label: 'Effective rate on total income', value: num(v, 'income') > 0 ? afterCredits / num(v, 'income') : 0, format: 'percent' },
        ],
        notes: ['Uses 2026 brackets and standard deductions. Doesn’t include self-employment tax, capital gains rates, or newer special deductions.'],
      };
    },
  },

  'marginal-vs-effective-rate': {
    inputs: [FILING_STATUS_INPUT, { id: 'taxable', label: 'Taxable income', kind: 'money', default: 60000, min: 0 }],
    compute(v) {
      const s = status(v);
      const taxable = num(v, 'taxable');
      const tax = federalIncomeTax(taxable, s);
      const brackets = fed.brackets[s];
      let lower = 0;
      const rows: (number | string)[][] = [];
      for (const b of brackets) {
        const upper = b.upTo ?? Infinity;
        const inBracket = Math.max(0, Math.min(taxable, upper) - lower);
        if (inBracket > 0) rows.push([b.rate, inBracket, inBracket * b.rate]);
        if (taxable <= upper) break;
        lower = upper;
      }
      return {
        outputs: [
          { label: 'Federal income tax', value: tax, format: 'money', emphasis: true },
          { label: 'Marginal rate (your top bracket)', value: marginalRate(taxable, brackets), format: 'percent' },
          { label: 'Effective rate (tax ÷ taxable income)', value: taxable > 0 ? tax / taxable : 0, format: 'percent' },
        ],
        table: { caption: 'How your income is taxed, bracket by bracket', columns: ['Rate', 'Income in bracket', 'Tax'], formats: ['percent', 'money', 'money'], rows },
      };
    },
  },

  'standard-vs-itemized': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'agedBlind', label: 'People 65+ or blind (0, 1 or 2)', kind: 'integer', default: 0, min: 0, max: 4 },
      { id: 'mortgageInterest', label: 'Mortgage interest', kind: 'money', default: 0, min: 0 },
      { id: 'salt', label: 'State, local and property taxes', kind: 'money', default: 0, min: 0, help: 'The deduction for these taxes is capped; the cap depends on income.' },
      { id: 'charity', label: 'Charitable gifts', kind: 'money', default: 0, min: 0 },
      { id: 'medical', label: 'Deductible medical expenses (amount over 7.5% of AGI)', kind: 'money', default: 0, min: 0 },
      { id: 'other', label: 'Other itemized deductions', kind: 'money', default: 0, min: 0 },
    ],
    compute(v) {
      const std = standardDeduction(status(v), num(v, 'agedBlind'));
      const itemized = ['mortgageInterest', 'salt', 'charity', 'medical', 'other'].reduce((s, k) => s + num(v, k), 0);
      const better = itemized > std ? 'Itemize' : 'Take the standard deduction';
      return {
        outputs: [
          { label: 'Your standard deduction', value: std, format: 'money' },
          { label: 'Your itemized total', value: itemized, format: 'money' },
          { label: 'Better choice', value: better, format: 'text', emphasis: true },
          { label: 'Difference', value: Math.abs(itemized - std), format: 'money' },
        ],
        notes: ['Enter state and local taxes after applying the yearly cap. We can help you work out your exact limit.'],
      };
    },
  },

  'self-employment-tax': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'profit', label: 'Net self-employment profit', kind: 'money', default: 50000, min: 0 },
      { id: 'wages', label: 'W-2 wages from a job (if any)', kind: 'money', default: 0, min: 0 },
    ],
    compute(v) {
      const r = selfEmploymentTax(num(v, 'profit'), status(v), num(v, 'wages'));
      return {
        outputs: [
          { label: 'Earnings subject to SE tax (92.35%)', value: r.base, format: 'money' },
          { label: 'Social Security part', value: r.socialSecurity, format: 'money' },
          { label: 'Medicare part', value: r.medicare, format: 'money' },
          { label: 'Additional Medicare tax', value: r.additionalMedicare, format: 'money' },
          { label: 'Total self-employment tax', value: r.total, format: 'money', emphasis: true },
          { label: 'Deductible half (reduces income tax)', value: r.deductibleHalf, format: 'money' },
        ],
        notes: ['No SE tax is due if 92.35% of profit is under $400.'],
      };
    },
  },

  'quarterly-estimated-tax': {
    inputs: [
      { id: 'expectedTax', label: 'Expected total tax this year', kind: 'money', default: 12000, min: 0 },
      { id: 'withholding', label: 'Expected withholding this year', kind: 'money', default: 4000, min: 0 },
      { id: 'priorYearTax', label: 'Total tax on last year’s return', kind: 'money', default: 10000, min: 0 },
      { id: 'highIncome', label: 'Last year’s AGI over $150,000 ($75,000 if married filing separately)?', kind: 'select', default: 'no', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    ],
    compute(v) {
      const expected = num(v, 'expectedTax');
      const prior = num(v, 'priorYearTax') * (str(v, 'highIncome') === 'yes' ? 1.1 : 1);
      const safeHarbor = Math.min(expected * 0.9, prior);
      const needed = Math.max(0, safeHarbor - num(v, 'withholding'));
      const owedAfter = Math.max(0, expected - num(v, 'withholding'));
      return {
        outputs: [
          { label: 'Safe-harbor amount to pay in during the year', value: safeHarbor, format: 'money' },
          { label: 'Estimated payments needed (total)', value: needed, format: 'money' },
          { label: 'Each quarterly payment', value: needed / 4, format: 'money', emphasis: true },
          { label: 'Tax still owed when you file (if you pay only the safe harbor)', value: Math.max(0, owedAfter - needed), format: 'money' },
        ],
        notes: [
          'Safe harbor: pay the smaller of 90% of this year’s tax or 100% of last year’s (110% for higher incomes) to generally avoid an underpayment penalty.',
          'Generally no estimated payments are needed if you’ll owe less than $1,000 after withholding.',
        ],
      };
    },
  },

  'capital-gains-tax': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'ordinary', label: 'Taxable income before the gain (after deductions)', kind: 'money', default: 60000, min: 0 },
      { id: 'ltGain', label: 'Long-term gain (held more than 1 year)', kind: 'money', default: 20000, min: 0 },
      { id: 'stGain', label: 'Short-term gain (held 1 year or less)', kind: 'money', default: 0, min: 0 },
    ],
    compute(v) {
      const s = status(v);
      const ordinary = num(v, 'ordinary') + num(v, 'stGain');
      const lt = num(v, 'ltGain');
      const withGains = taxWithCapitalGains(ordinary + lt, lt, s);
      const without = federalIncomeTax(num(v, 'ordinary'), s);
      return {
        outputs: [
          { label: 'Long-term gain taxed at 0%', value: withGains.atZero, format: 'money' },
          { label: 'Long-term gain taxed at 15%', value: withGains.atFifteen, format: 'money' },
          { label: 'Long-term gain taxed at 20%', value: withGains.atTwenty, format: 'money' },
          { label: 'Extra tax caused by the gains', value: withGains.total - without, format: 'money', emphasis: true },
        ],
        notes: ['Short-term gains are taxed like ordinary income. The 3.8% net investment income tax and special 25%/28% gains aren’t included.'],
      };
    },
  },

  'ohio-income-tax': {
    inputs: [{ id: 'taxable', label: 'Ohio taxable nonbusiness income', kind: 'money', default: 50000, min: 0, help: 'Ohio adjusted gross income minus your Ohio exemptions.' }],
    compute(v) {
      const tax = ohioIncomeTax(num(v, 'taxable'));
      return {
        outputs: [
          { label: 'Ohio income tax before credits', value: tax, format: 'money', emphasis: true },
          { label: 'Effective Ohio rate', value: num(v, 'taxable') > 0 ? tax / num(v, 'taxable') : 0, format: 'percent' },
        ],
        notes: ['Uses the 2026 Ohio schedule. Ohio credits, business income (taxed separately), school district tax and city tax are not included.'],
      };
    },
  },

  'taxable-social-security': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'benefits', label: 'Social Security benefits for the year', kind: 'money', default: 24000, min: 0 },
      { id: 'otherIncome', label: 'Other income (pensions, wages, IRA withdrawals, etc.)', kind: 'money', default: 30000, min: 0 },
      { id: 'taxExempt', label: 'Tax-exempt interest', kind: 'money', default: 0, min: 0 },
    ],
    compute(v) {
      const benefits = num(v, 'benefits');
      const taxable = taxableSocialSecurity(benefits, num(v, 'otherIncome'), num(v, 'taxExempt'), status(v));
      return {
        outputs: [
          { label: 'Taxable part of your benefits', value: taxable, format: 'money', emphasis: true },
          { label: 'Share of benefits that is taxable', value: benefits > 0 ? taxable / benefits : 0, format: 'percent' },
        ],
        notes: ['Up to 85% of benefits can be taxable. Married filing separately assumes you lived with your spouse at some point during the year.'],
      };
    },
  },

  'child-tax-credit': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'children', label: 'Qualifying children under 17', kind: 'integer', default: 2, min: 0, max: 15 },
      { id: 'magi', label: 'Modified adjusted gross income', kind: 'money', default: 90000, min: 0 },
    ],
    compute(v) {
      const r = childTaxCredit(num(v, 'children'), num(v, 'magi'), status(v));
      return {
        outputs: [
          { label: 'Maximum credit', value: r.maxCredit, format: 'money' },
          { label: 'Reduction for income', value: r.reduction, format: 'money' },
          { label: 'Estimated Child Tax Credit', value: r.credit, format: 'money', emphasis: true },
          { label: 'Most that could be refundable', value: r.refundableCap, format: 'money' },
        ],
        notes: ['Each child needs a valid Social Security number, and other rules apply. The refundable part also depends on your earned income.'],
      };
    },
  },

  'earned-income-credit': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'children', label: 'Qualifying children', kind: 'integer', default: 1, min: 0, max: 10 },
      { id: 'earned', label: 'Earned income (wages and self-employment)', kind: 'money', default: 25000, min: 0 },
      { id: 'agi', label: 'Adjusted gross income', kind: 'money', default: 25000, min: 0 },
      { id: 'investment', label: 'Investment income', kind: 'money', default: 0, min: 0 },
    ],
    compute(v) {
      const r = earnedIncomeCredit(num(v, 'children'), num(v, 'earned'), num(v, 'agi'), status(v), num(v, 'investment'));
      return {
        outputs: [{ label: 'Estimated Earned Income Tax Credit', value: r.credit, format: 'money', emphasis: true }],
        notes: [r.reason ?? 'The IRS figures the actual credit from tables, so your exact amount may differ by a few dollars. Age, residency and Social Security number rules also apply.'],
      };
    },
  },
};
