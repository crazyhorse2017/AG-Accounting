/** Phase 02 M2 calculators: completes the ~106-calculator catalog. */
import { fed } from '../../content/taxYear.ts';
import type { FilingStatus } from '../../content/taxYear.ts';
import { amortize, futureValue, loanPayment, paymentForGoal, periodsToGoal, yearlySummary } from '../../lib/finance.ts';
import { childTaxCredit, employeeFica, federalIncomeTax, marginalRate, ohioIncomeTax, standardDeduction, taxWithCapitalGains } from '../../lib/tax.ts';
import { FILING_STATUS_INPUT, num, pct, str } from '../types.ts';
import type { CalcResult, CalculatorImpl, InputDef, Values } from '../types.ts';

const status = (v: Values) => str(v, 'status') as FilingStatus;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const interestOf = (rows: ReturnType<typeof amortize>) => sum(rows.map((r) => r.interest));
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
const PAY_PERIODS: InputDef = {
  id: 'periods',
  label: 'Pay schedule',
  kind: 'select',
  default: '26',
  options: [
    { value: '52', label: 'Weekly' },
    { value: '26', label: 'Every two weeks' },
    { value: '24', label: 'Twice a month' },
    { value: '12', label: 'Monthly' },
  ],
};

/** Present value: the loan a payment supports. */
function loanForPayment(payment: number, ratePerPeriod: number, periods: number): number {
  if (payment <= 0 || periods <= 0) return 0;
  if (ratePerPeriod === 0) return payment * periods;
  return (payment * (1 - Math.pow(1 + ratePerPeriod, -periods))) / ratePerPeriod;
}

/** Monthly balance after k payments on an amortizing loan. */
function balanceAfter(principal: number, ratePerPeriod: number, periods: number, k: number): number {
  const rows = amortize(principal, ratePerPeriod, periods);
  return k <= 0 ? principal : k >= rows.length ? 0 : rows[k - 1].balance;
}

/** Simulate paying several debts with a fixed total budget; `order` picks which debt gets extra money first. */
function payDebts(debts: { balance: number; apr: number; min: number }[], extra: number, order: 'avalanche' | 'snowball') {
  const ds = debts.filter((d) => d.balance > 0).map((d) => ({ ...d }));
  const budget = sum(ds.map((d) => d.min)) + extra;
  let months = 0;
  let interest = 0;
  while (ds.some((d) => d.balance > 0.005) && months < 1200) {
    months++;
    for (const d of ds) {
      const i = (d.balance * d.apr) / 12;
      d.balance += i;
      interest += i;
    }
    let left = budget;
    for (const d of ds) {
      const pay = Math.min(d.balance, d.min, left);
      d.balance -= pay;
      left -= pay;
    }
    const targets = ds
      .filter((d) => d.balance > 0.005)
      .sort((a, b) => (order === 'avalanche' ? b.apr - a.apr : a.balance - b.balance));
    for (const d of targets) {
      const pay = Math.min(d.balance, left);
      d.balance -= pay;
      left -= pay;
    }
    if (left >= budget - 0.005 && ds.some((d) => d.balance > 0.005)) return null; // budget can't keep up
  }
  return months >= 1200 ? null : { months, interest };
}

/** Effective annual rate of a loan once an upfront fee is included (bisection). */
function aprWithFee(amount: number, fee: number, payment: number, n: number): number {
  const net = amount - fee;
  if (net <= 0 || payment * n <= net) return 0;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (loanForPayment(payment, mid / 12, n) > net) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const money = (label: string, value: number, emphasis = false) => ({ label, value, format: 'money' as const, emphasis });
const percentOut = (label: string, value: number, emphasis = false) => ({ label, value, format: 'percent' as const, emphasis });
const text = (label: string, value: string, emphasis = true) => ({ label, value, format: 'text' as const, emphasis });

export const moreCalculators: Record<string, CalculatorImpl> = {
  /* ================= Tax ================= */
  'refund-or-balance-due': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'income', label: 'Total income', kind: 'money', default: 70000, min: 0 },
      { id: 'adjustments', label: 'Adjustments to income', kind: 'money', default: 0, min: 0 },
      { id: 'itemized', label: 'Itemized deductions (0 for standard)', kind: 'money', default: 0, min: 0 },
      { id: 'children', label: 'Children qualifying for the Child Tax Credit', kind: 'integer', default: 0, min: 0, max: 15 },
      { id: 'otherCredits', label: 'Other credits', kind: 'money', default: 0, min: 0 },
      { id: 'withheld', label: 'Federal tax withheld (W-2 box 2, etc.)', kind: 'money', default: 7000, min: 0 },
      { id: 'estimates', label: 'Estimated tax payments made', kind: 'money', default: 0, min: 0 },
    ],
    compute(v) {
      const s = status(v);
      const agi = Math.max(0, num(v, 'income') - num(v, 'adjustments'));
      const taxable = Math.max(0, agi - Math.max(standardDeduction(s), num(v, 'itemized')));
      const tax = federalIncomeTax(taxable, s);
      const ctc = childTaxCredit(num(v, 'children'), agi, s);
      const nonrefundable = Math.min(tax, ctc.credit + num(v, 'otherCredits'));
      const leftoverCtc = Math.max(0, ctc.credit - Math.max(0, tax - num(v, 'otherCredits')));
      const refundableCtc = Math.min(leftoverCtc, ctc.refundableCap);
      const owed = tax - nonrefundable - refundableCtc;
      const paid = num(v, 'withheld') + num(v, 'estimates');
      const diff = paid - owed;
      return {
        outputs: [
          money('Tax before credits', tax),
          money('Credits', nonrefundable + refundableCtc),
          money('Total tax after credits', Math.max(0, owed)),
          money('Already paid', paid),
          diff >= 0 ? money('Estimated refund', diff, true) : money('Estimated amount you’ll owe', -diff, true),
        ],
        notes: ['The refundable part of the Child Tax Credit also depends on earned income; this estimate assumes you qualify for it.'],
      };
    },
  },

  'ohio-municipal-income-tax': {
    inputs: [
      { id: 'wages', label: 'Wages (usually W-2 box 18)', kind: 'money', default: 60000, min: 0 },
      { id: 'workRate', label: 'Tax rate where you work', kind: 'percent', default: 2.5, min: 0, max: 5, step: 0.05 },
      { id: 'homeRate', label: 'Tax rate where you live', kind: 'percent', default: 2.5, min: 0, max: 5, step: 0.05 },
      { id: 'creditPct', label: 'Credit your home city gives for work-city tax', kind: 'percent', default: 100, min: 0, max: 100, help: 'Many cities give 50% to 100% credit; check RITA or CCA for your city.' },
      { id: 'creditCap', label: 'Highest rate your home city credits', kind: 'percent', default: 2.5, min: 0, max: 5, step: 0.05 },
    ],
    compute(v) {
      const wages = num(v, 'wages');
      const workTax = wages * pct(v, 'workRate');
      const homeTax = wages * pct(v, 'homeRate');
      const credit = Math.min(homeTax, wages * Math.min(pct(v, 'workRate'), pct(v, 'creditCap')) * pct(v, 'creditPct'));
      const homeOwed = Math.max(0, homeTax - credit);
      return {
        outputs: [
          money('Tax to your work city', workTax),
          money('Home city tax before credit', homeTax),
          money('Credit for work-city tax', credit),
          money('Still owed to your home city', homeOwed),
          money('Total city income tax', workTax + homeOwed, true),
        ],
        notes: ['City rates and credit rules differ across Ohio and change over time. Your W-2 boxes 18–20 show local wages and tax withheld.'],
      };
    },
  },

  /* ================= Savings ================= */
  'time-to-savings-goal': {
    inputs: [
      { id: 'goal', label: 'Savings goal', kind: 'money', default: 15000, min: 0 },
      { id: 'start', label: 'Already saved', kind: 'money', default: 1000, min: 0 },
      { id: 'monthly', label: 'Save each month', kind: 'money', default: 400, min: 0 },
      { id: 'rate', label: 'Annual interest rate', kind: 'percent', default: 4, min: 0, max: 20, step: 0.1 },
    ],
    compute(v) {
      const months = periodsToGoal(num(v, 'goal'), num(v, 'start'), num(v, 'monthly'), pct(v, 'rate') / 12);
      if (months === null) return { outputs: [text('Time to reach your goal', 'Add a monthly amount to reach this goal.')] };
      return {
        outputs: [
          { label: 'Months to reach your goal', value: months, format: 'months', emphasis: true },
          { label: 'That’s about', value: months / 12, format: 'years' },
          money('You’ll put in', num(v, 'start') + num(v, 'monthly') * months),
        ],
      };
    },
  },

  'savings-account-comparison': {
    inputs: [
      { id: 'amount', label: 'Starting balance', kind: 'money', default: 10000, min: 0 },
      { id: 'monthly', label: 'Monthly deposit', kind: 'money', default: 200, min: 0 },
      { id: 'rateA', label: 'Account A APY', kind: 'percent', default: 0.5, min: 0, max: 15, step: 0.01 },
      { id: 'rateB', label: 'Account B APY', kind: 'percent', default: 4, min: 0, max: 15, step: 0.01 },
      { id: 'years', label: 'Years', kind: 'integer', default: 5, min: 1, max: 40 },
    ],
    compute(v) {
      const n = num(v, 'years') * 12;
      const monthlyRate = (apy: number) => Math.pow(1 + apy, 1 / 12) - 1;
      const a = futureValue(num(v, 'amount'), num(v, 'monthly'), monthlyRate(pct(v, 'rateA')), n);
      const b = futureValue(num(v, 'amount'), num(v, 'monthly'), monthlyRate(pct(v, 'rateB')), n);
      return { outputs: [money('Account A balance', a), money('Account B balance', b), money('Difference', Math.abs(b - a), true)] };
    },
  },

  'recurring-deposit': {
    inputs: [
      { id: 'monthly', label: 'Monthly deposit', kind: 'money', default: 250, min: 0 },
      { id: 'rate', label: 'Annual interest rate', kind: 'percent', default: 4, min: 0, max: 20, step: 0.1 },
      { id: 'years', label: 'Years', kind: 'number', default: 5, min: 0.5, max: 50 },
    ],
    compute(v) {
      const n = Math.round(num(v, 'years') * 12);
      const end = futureValue(0, num(v, 'monthly'), pct(v, 'rate') / 12, n);
      return { outputs: [money('Balance at the end', end, true), money('Total deposited', num(v, 'monthly') * n), money('Interest earned', end - num(v, 'monthly') * n)] };
    },
  },

  /* ================= Real estate ================= */
  'rent-vs-buy': {
    inputs: [
      { id: 'price', label: 'Home price', kind: 'money', default: 280000, min: 0 },
      { id: 'down', label: 'Down payment', kind: 'money', default: 40000, min: 0 },
      { id: 'rate', label: 'Mortgage rate', kind: 'percent', default: 6.5, min: 0, max: 20, step: 0.01 },
      { id: 'closing', label: 'Closing costs (% of price)', kind: 'percent', default: 3, min: 0, max: 10, step: 0.1 },
      { id: 'taxIns', label: 'Property tax and insurance per year', kind: 'money', default: 6000, min: 0 },
      { id: 'maintenance', label: 'Maintenance per year (% of price)', kind: 'percent', default: 1, min: 0, max: 5, step: 0.1 },
      { id: 'appreciation', label: 'Home value growth per year', kind: 'percent', default: 3, min: -10, max: 15, step: 0.1 },
      { id: 'rent', label: 'Rent per month', kind: 'money', default: 1700, min: 0 },
      { id: 'rentGrowth', label: 'Rent increase per year', kind: 'percent', default: 3, min: 0, max: 15, step: 0.1 },
      { id: 'invest', label: 'Return if you invested the down payment instead', kind: 'percent', default: 5, min: 0, max: 15, step: 0.1 },
      { id: 'stay', label: 'Years you’ll stay', kind: 'integer', default: 7, min: 1, max: 30 },
    ],
    compute(v) {
      const years = num(v, 'stay');
      const loan = Math.max(0, num(v, 'price') - num(v, 'down'));
      const r = pct(v, 'rate') / 12;
      const pay = loanPayment(loan, r, 360);
      const months = years * 12;
      const balance = balanceAfter(loan, r, 360, months);
      const value = num(v, 'price') * Math.pow(1 + pct(v, 'appreciation'), years);
      const upfront = num(v, 'down') + num(v, 'price') * pct(v, 'closing');
      const ongoing = pay * months + (num(v, 'taxIns') + num(v, 'price') * pct(v, 'maintenance')) * years;
      const saleProceeds = value * (1 - 0.06) - balance;
      const buyCost = upfront + ongoing - saleProceeds;
      let rentTotal = 0;
      for (let y = 0; y < years; y++) rentTotal += num(v, 'rent') * 12 * Math.pow(1 + pct(v, 'rentGrowth'), y);
      const missedGrowth = upfront * (Math.pow(1 + pct(v, 'invest'), years) - 1);
      const rentCost = rentTotal - missedGrowth;
      return {
        outputs: [
          money(`Net cost of buying over ${years} years`, buyCost),
          money(`Net cost of renting over ${years} years`, rentCost),
          text('Cheaper over that time', buyCost < rentCost ? 'Buying' : 'Renting'),
          money('Difference', Math.abs(buyCost - rentCost)),
        ],
        notes: ['Buying assumes a 30-year loan and 6% selling costs. Tax effects (like the mortgage interest deduction) aren’t included.'],
      };
    },
  },

  'rental-cash-flow': {
    inputs: [
      { id: 'rent', label: 'Monthly rent', kind: 'money', default: 1500, min: 0 },
      { id: 'vacancy', label: 'Vacancy allowance', kind: 'percent', default: 5, min: 0, max: 50 },
      { id: 'mortgage', label: 'Mortgage payment (principal and interest)', kind: 'money', default: 800, min: 0 },
      { id: 'taxIns', label: 'Property tax and insurance per month', kind: 'money', default: 300, min: 0 },
      { id: 'maintenance', label: 'Repairs and maintenance per month', kind: 'money', default: 125, min: 0 },
      { id: 'management', label: 'Property management fee (% of rent)', kind: 'percent', default: 8, min: 0, max: 30 },
      { id: 'other', label: 'Other monthly costs (HOA, utilities)', kind: 'money', default: 0, min: 0 },
    ],
    compute(v) {
      const income = num(v, 'rent') * (1 - pct(v, 'vacancy'));
      const expenses = num(v, 'taxIns') + num(v, 'maintenance') + num(v, 'rent') * pct(v, 'management') + num(v, 'other');
      const flow = income - expenses - num(v, 'mortgage');
      return {
        outputs: [money('Effective rent after vacancy', income), money('Operating expenses', expenses), money('Monthly cash flow', flow, true), money('Yearly cash flow', flow * 12)],
        notes: ['Cash flow isn’t taxable profit: depreciation and the interest/principal split change your taxes.'],
      };
    },
  },

  'cap-rate': {
    inputs: [
      { id: 'price', label: 'Property price', kind: 'money', default: 250000, min: 0 },
      { id: 'rent', label: 'Yearly rent collected', kind: 'money', default: 24000, min: 0 },
      { id: 'expenses', label: 'Yearly operating expenses (not the mortgage)', kind: 'money', default: 8000, min: 0 },
    ],
    compute(v) {
      const noi = num(v, 'rent') - num(v, 'expenses');
      return { outputs: [money('Net operating income', noi), percentOut('Cap rate', num(v, 'price') > 0 ? noi / num(v, 'price') : 0, true)] };
    },
  },

  'cash-on-cash-return': {
    inputs: [
      { id: 'cashIn', label: 'Total cash invested (down payment, closing, repairs)', kind: 'money', default: 60000, min: 0 },
      { id: 'cashFlow', label: 'Yearly cash flow after the mortgage', kind: 'money', default: 4200, min: -1000000 },
    ],
    compute(v) {
      return { outputs: [percentOut('Cash-on-cash return', num(v, 'cashIn') > 0 ? num(v, 'cashFlow') / num(v, 'cashIn') : 0, true)] };
    },
  },

  'property-tax-estimate': {
    inputs: [
      { id: 'value', label: 'Market value', kind: 'money', default: 250000, min: 0 },
      { id: 'assessed', label: 'Assessed share of value', kind: 'percent', default: 35, min: 1, max: 100, help: 'Ohio taxes 35% of market value.' },
      { id: 'mills', label: 'Effective tax rate (mills)', kind: 'number', default: 70, min: 0, max: 300, help: 'Your county auditor lists the effective rate for your district.' },
      { id: 'credits', label: 'Credits and reductions (% of tax)', kind: 'percent', default: 0, min: 0, max: 100, help: 'For example, owner-occupancy or homestead reductions.' },
    ],
    compute(v) {
      const taxable = num(v, 'value') * pct(v, 'assessed');
      const gross = (taxable * num(v, 'mills')) / 1000;
      const net = gross * (1 - pct(v, 'credits'));
      return { outputs: [money('Taxable (assessed) value', taxable), money('Yearly property tax', net, true), money('Per month', net / 12)] };
    },
  },

  'home-sale-gain-exclusion': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'sale', label: 'Sale price', kind: 'money', default: 400000, min: 0 },
      { id: 'sellingCosts', label: 'Selling costs (commissions, fees)', kind: 'money', default: 24000, min: 0 },
      { id: 'basis', label: 'What you paid (including purchase costs)', kind: 'money', default: 180000, min: 0 },
      { id: 'improvements', label: 'Improvements over the years', kind: 'money', default: 30000, min: 0 },
      { id: 'qualifies', label: 'Owned and lived there 2 of the last 5 years?', kind: 'select', default: 'yes', options: YES_NO },
    ],
    compute(v) {
      const gain = num(v, 'sale') - num(v, 'sellingCosts') - num(v, 'basis') - num(v, 'improvements');
      const exclusion = str(v, 'qualifies') === 'yes' ? fed.more.homeSaleExclusion[status(v)] : 0;
      const taxable = Math.max(0, gain - exclusion);
      return {
        outputs: [money('Gain on the sale', gain), money('Exclusion', Math.min(Math.max(0, gain), exclusion)), money('Taxable gain', taxable, true)],
        notes: ['A loss on a personal home isn’t deductible. Partial exclusions may apply if you moved for work, health or other unforeseen reasons.'],
      };
    },
  },

  'closing-cost-estimate': {
    inputs: [
      { id: 'price', label: 'Home price', kind: 'money', default: 250000, min: 0 },
      { id: 'down', label: 'Down payment', kind: 'money', default: 25000, min: 0 },
      { id: 'closingPct', label: 'Closing costs (% of loan)', kind: 'percent', default: 3, min: 0, max: 10, step: 0.1, help: 'Lender fees, title, recording; your Loan Estimate shows the real number.' },
      { id: 'prepaids', label: 'Prepaid taxes, insurance and escrow', kind: 'money', default: 3000, min: 0 },
    ],
    compute(v) {
      const loan = Math.max(0, num(v, 'price') - num(v, 'down'));
      const closing = loan * pct(v, 'closingPct');
      return {
        outputs: [money('Loan amount', loan), money('Estimated closing costs', closing), money('Prepaids', num(v, 'prepaids')), money('Estimated cash to close', num(v, 'down') + closing + num(v, 'prepaids'), true)],
      };
    },
  },

  'home-equity': {
    inputs: [
      { id: 'value', label: 'Home value', kind: 'money', default: 320000, min: 0 },
      { id: 'balance', label: 'Mortgage balance', kind: 'money', default: 180000, min: 0 },
      { id: 'otherLiens', label: 'Other loans against the home', kind: 'money', default: 0, min: 0 },
      { id: 'maxLtv', label: 'Lender’s maximum loan-to-value', kind: 'percent', default: 80, min: 0, max: 100 },
    ],
    compute(v) {
      const owed = num(v, 'balance') + num(v, 'otherLiens');
      const equity = num(v, 'value') - owed;
      const borrowable = Math.max(0, num(v, 'value') * pct(v, 'maxLtv') - owed);
      return { outputs: [money('Your equity', equity, true), percentOut('Equity share', num(v, 'value') > 0 ? equity / num(v, 'value') : 0), money('Possible home equity loan or line', borrowable)] };
    },
  },

  /* ================= Mortgage ================= */
  'home-affordability': {
    inputs: [
      { id: 'income', label: 'Household income per year (before tax)', kind: 'money', default: 90000, min: 0 },
      { id: 'debts', label: 'Other monthly debt payments', kind: 'money', default: 500, min: 0 },
      { id: 'down', label: 'Down payment', kind: 'money', default: 40000, min: 0 },
      { id: 'rate', label: 'Mortgage rate', kind: 'percent', default: 6.5, min: 0, max: 20, step: 0.01 },
      { id: 'escrow', label: 'Property tax and insurance per month', kind: 'money', default: 450, min: 0 },
      { id: 'front', label: 'Housing cost limit (% of income)', kind: 'percent', default: 28, min: 10, max: 50 },
      { id: 'back', label: 'Total debt limit (% of income)', kind: 'percent', default: 36, min: 10, max: 60 },
    ],
    compute(v) {
      const monthlyIncome = num(v, 'income') / 12;
      const maxHousing = Math.min(monthlyIncome * pct(v, 'front'), monthlyIncome * pct(v, 'back') - num(v, 'debts'));
      const maxPI = Math.max(0, maxHousing - num(v, 'escrow'));
      const loan = loanForPayment(maxPI, pct(v, 'rate') / 12, 360);
      return {
        outputs: [money('Most you might spend on housing per month', Math.max(0, maxHousing)), money('Loan amount that supports', loan), money('Estimated home price you can afford', loan + num(v, 'down'), true)],
        notes: ['Based on common 28%/36% guidelines and a 30-year loan. Lenders use their own rules.'],
      };
    },
  },

  'amortization-schedule': {
    inputs: [
      { id: 'amount', label: 'Loan amount', kind: 'money', default: 200000, min: 0 },
      { id: 'rate', label: 'Interest rate', kind: 'percent', default: 6.5, min: 0, max: 20, step: 0.01 },
      { id: 'years', label: 'Term (years)', kind: 'integer', default: 30, min: 1, max: 40 },
    ],
    compute(v) {
      const n = num(v, 'years') * 12;
      const rows = amortize(num(v, 'amount'), pct(v, 'rate') / 12, n);
      return {
        outputs: [money('Monthly payment', loanPayment(num(v, 'amount'), pct(v, 'rate') / 12, n), true), money('Total interest', interestOf(rows))],
        table: {
          caption: 'Payment by payment (first 360 shown)',
          columns: ['Payment #', 'Interest', 'Principal', 'Balance'],
          formats: ['number', 'money', 'money', 'money'],
          rows: rows.slice(0, 360).map((r) => [r.period, r.interest, r.principal, r.balance]),
        },
      };
    },
  },

  'pmi-estimate': {
    inputs: [
      { id: 'price', label: 'Home price', kind: 'money', default: 250000, min: 0 },
      { id: 'down', label: 'Down payment', kind: 'money', default: 12500, min: 0 },
      { id: 'rate', label: 'Mortgage rate', kind: 'percent', default: 6.5, min: 0, max: 20, step: 0.01 },
      { id: 'pmiRate', label: 'PMI rate per year (% of loan)', kind: 'percent', default: 0.6, min: 0, max: 3, step: 0.05 },
    ],
    compute(v) {
      const price = num(v, 'price');
      const loan = Math.max(0, price - num(v, 'down'));
      const ltv = price > 0 ? loan / price : 0;
      if (ltv <= 0.8) return { outputs: [percentOut('Loan-to-value', ltv), text('PMI', 'Not usually required with 20% or more down.')] };
      const rows = amortize(loan, pct(v, 'rate') / 12, 360);
      const dropMonth = rows.findIndex((r) => r.balance <= price * 0.78) + 1;
      return {
        outputs: [percentOut('Loan-to-value', ltv), money('Estimated PMI per month', (loan * pct(v, 'pmiRate')) / 12, true), { label: 'PMI ends automatically after about', value: dropMonth / 12, format: 'years' }],
        notes: ['PMI generally ends automatically when the balance reaches 78% of the original value; you can ask to cancel at 80%.'],
      };
    },
  },

  'points-break-even': {
    inputs: [
      { id: 'loan', label: 'Loan amount', kind: 'money', default: 300000, min: 0 },
      { id: 'rateNoPoints', label: 'Rate without points', kind: 'percent', default: 6.75, min: 0, max: 20, step: 0.01 },
      { id: 'rateWithPoints', label: 'Rate with points', kind: 'percent', default: 6.25, min: 0, max: 20, step: 0.01 },
      { id: 'points', label: 'Points (1 point = 1% of the loan)', kind: 'number', default: 2, min: 0, max: 5, step: 0.125 },
    ],
    compute(v) {
      const a = loanPayment(num(v, 'loan'), pct(v, 'rateNoPoints') / 12, 360);
      const b = loanPayment(num(v, 'loan'), pct(v, 'rateWithPoints') / 12, 360);
      const cost = (num(v, 'loan') * num(v, 'points')) / 100;
      const save = a - b;
      return {
        outputs: [money('Cost of the points', cost), money('Monthly savings', save), save > 0 ? { label: 'Break-even', value: Math.ceil(cost / save), format: 'months', emphasis: true } : text('Break-even', 'No monthly savings')],
      };
    },
  },

  'fixed-vs-adjustable': {
    inputs: [
      { id: 'loan', label: 'Loan amount', kind: 'money', default: 300000, min: 0 },
      { id: 'fixedRate', label: '30-year fixed rate', kind: 'percent', default: 6.5, min: 0, max: 20, step: 0.01 },
      { id: 'armRate', label: 'Adjustable starting rate', kind: 'percent', default: 5.75, min: 0, max: 20, step: 0.01 },
      { id: 'fixedYears', label: 'Years before it adjusts', kind: 'integer', default: 5, min: 1, max: 10 },
      { id: 'laterRate', label: 'Rate you expect after it adjusts', kind: 'percent', default: 7.5, min: 0, max: 20, step: 0.01 },
      { id: 'stay', label: 'Years you’ll keep the loan', kind: 'integer', default: 10, min: 1, max: 30 },
    ],
    compute(v) {
      const loan = num(v, 'loan');
      const fixedPay = loanPayment(loan, pct(v, 'fixedRate') / 12, 360);
      const k = num(v, 'fixedYears') * 12;
      const armPay1 = loanPayment(loan, pct(v, 'armRate') / 12, 360);
      const balAtReset = balanceAfter(loan, pct(v, 'armRate') / 12, 360, k);
      const armPay2 = loanPayment(balAtReset, pct(v, 'laterRate') / 12, 360 - k);
      const months = num(v, 'stay') * 12;
      const fixedTotal = fixedPay * months;
      const armTotal = armPay1 * Math.min(months, k) + armPay2 * Math.max(0, months - k);
      return {
        outputs: [
          money('Fixed payment', fixedPay),
          money('Adjustable payment at first', armPay1),
          money('Adjustable payment after it adjusts', armPay2),
          money(`Fixed payments over ${num(v, 'stay')} years`, fixedTotal),
          money(`Adjustable payments over ${num(v, 'stay')} years`, armTotal),
          text('Lower total payments', armTotal < fixedTotal ? 'Adjustable' : 'Fixed'),
        ],
        notes: ['Real adjustable loans change with an index and have caps; this assumes one adjustment to the rate you enter.'],
      };
    },
  },

  /* ================= Credit cards ================= */
  'balance-transfer': {
    inputs: [
      { id: 'balance', label: 'Balance to transfer', kind: 'money', default: 6000, min: 0 },
      { id: 'apr', label: 'Current APR', kind: 'percent', default: 24, min: 0, max: 40, step: 0.01 },
      { id: 'promoApr', label: 'Promotional APR', kind: 'percent', default: 0, min: 0, max: 40, step: 0.01 },
      { id: 'promoMonths', label: 'Promotional months', kind: 'integer', default: 15, min: 1, max: 24 },
      { id: 'fee', label: 'Transfer fee', kind: 'percent', default: 3, min: 0, max: 10, step: 0.1 },
      { id: 'payment', label: 'Monthly payment', kind: 'money', default: 400, min: 0 },
    ],
    compute(v) {
      const months = num(v, 'promoMonths');
      const sim = (start: number, apr: number) => {
        let bal = start;
        let interest = 0;
        for (let i = 0; i < months && bal > 0; i++) {
          const int = (bal * apr) / 12;
          interest += int;
          bal = Math.max(0, bal + int - num(v, 'payment'));
        }
        return { bal, interest };
      };
      const stay = sim(num(v, 'balance'), pct(v, 'apr'));
      const fee = num(v, 'balance') * pct(v, 'fee');
      const move = sim(num(v, 'balance') + fee, pct(v, 'promoApr'));
      const savings = stay.interest - (move.interest + fee);
      return {
        outputs: [
          money(`Interest if you stay (${months} months)`, stay.interest),
          money('Transfer fee', fee),
          money('Interest after transferring', move.interest),
          money('Estimated savings', savings, true),
          money('Balance left when the promo ends', move.bal),
        ],
      };
    },
  },

  'snowball-vs-avalanche': {
    inputs: [
      { id: 'b1', label: 'Debt 1 balance', kind: 'money', default: 2500, min: 0 },
      { id: 'r1', label: 'Debt 1 APR', kind: 'percent', default: 22, min: 0, max: 40, step: 0.01 },
      { id: 'm1', label: 'Debt 1 minimum payment', kind: 'money', default: 75, min: 0 },
      { id: 'b2', label: 'Debt 2 balance', kind: 'money', default: 6000, min: 0 },
      { id: 'r2', label: 'Debt 2 APR', kind: 'percent', default: 18, min: 0, max: 40, step: 0.01 },
      { id: 'm2', label: 'Debt 2 minimum payment', kind: 'money', default: 150, min: 0 },
      { id: 'b3', label: 'Debt 3 balance', kind: 'money', default: 9000, min: 0 },
      { id: 'r3', label: 'Debt 3 APR', kind: 'percent', default: 7, min: 0, max: 40, step: 0.01 },
      { id: 'm3', label: 'Debt 3 minimum payment', kind: 'money', default: 200, min: 0 },
      { id: 'extra', label: 'Extra you can pay each month', kind: 'money', default: 200, min: 0 },
    ],
    compute(v) {
      const debts = [1, 2, 3].map((i) => ({ balance: num(v, `b${i}`), apr: pct(v, `r${i}`), min: num(v, `m${i}`) }));
      const av = payDebts(debts, num(v, 'extra'), 'avalanche');
      const sn = payDebts(debts, num(v, 'extra'), 'snowball');
      if (!av || !sn) return { outputs: [text('Result', 'These payments don’t keep up with the interest. Increase the payments to see a payoff plan.')] };
      return {
        outputs: [
          { label: 'Avalanche (highest rate first): months', value: av.months, format: 'months' },
          money('Avalanche total interest', av.interest),
          { label: 'Snowball (smallest balance first): months', value: sn.months, format: 'months' },
          money('Snowball total interest', sn.interest),
          money('Interest saved by avalanche', sn.interest - av.interest, true),
        ],
        notes: ['Snowball can cost a little more but gives quick wins; the best plan is the one you’ll stick with.'],
      };
    },
  },

  'credit-card-interest-cost': {
    inputs: [
      { id: 'balance', label: 'Average balance carried', kind: 'money', default: 4000, min: 0 },
      { id: 'apr', label: 'APR', kind: 'percent', default: 22, min: 0, max: 40, step: 0.01 },
    ],
    compute(v) {
      const yearly = num(v, 'balance') * pct(v, 'apr');
      return { outputs: [money('Interest per month', yearly / 12), money('Interest per year', yearly, true), percentOut('Daily periodic rate', pct(v, 'apr') / 365)] };
    },
  },

  'credit-utilization': {
    inputs: [
      { id: 'balances', label: 'Total card balances', kind: 'money', default: 3000, min: 0 },
      { id: 'limits', label: 'Total credit limits', kind: 'money', default: 10000, min: 0 },
    ],
    compute(v) {
      const u = num(v, 'limits') > 0 ? num(v, 'balances') / num(v, 'limits') : 0;
      return {
        outputs: [percentOut('Credit utilization', u, true), money('Balance to get under 30%', Math.max(0, num(v, 'balances') - num(v, 'limits') * 0.3)), money('Balance to get under 10%', Math.max(0, num(v, 'balances') - num(v, 'limits') * 0.1))],
        notes: ['Lower utilization generally helps credit scores; scoring models differ.'],
      };
    },
  },

  /* ================= Paycheck ================= */
  'take-home-pay': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'salary', label: 'Yearly salary', kind: 'money', default: 60000, min: 0 },
      PAY_PERIODS,
      { id: 'k401', label: '401(k) contribution', kind: 'percent', default: 5, min: 0, max: 100, step: 0.5 },
      { id: 'health', label: 'Pre-tax health insurance per paycheck', kind: 'money', default: 75, min: 0 },
      { id: 'cityRate', label: 'City income tax rate', kind: 'percent', default: 2.5, min: 0, max: 5, step: 0.05 },
    ],
    compute(v) {
      const s = status(v);
      const periods = Number(str(v, 'periods'));
      const salary = num(v, 'salary');
      const k = Math.min(salary * pct(v, 'k401'), fed.retirement.employeeDeferral401k);
      const health = num(v, 'health') * periods;
      const fedTaxable = Math.max(0, salary - k - health - standardDeduction(s));
      const fedTax = federalIncomeTax(fedTaxable, s);
      const fica = employeeFica(salary - health, s).total;
      const ohioTax = ohioIncomeTax(Math.max(0, salary - k - health));
      const city = (salary - health) * pct(v, 'cityRate');
      const net = salary - k - health - fedTax - fica - ohioTax - city;
      return {
        outputs: [
          money('Federal income tax (per paycheck)', fedTax / periods),
          money('Social Security and Medicare', fica / periods),
          money('Ohio income tax', ohioTax / periods),
          money('City income tax', city / periods),
          money('401(k) and health insurance', (k + health) / periods),
          money('Estimated take-home pay per paycheck', net / periods, true),
          money('Take-home pay per year', net),
        ],
        notes: ['A planning estimate. Actual withholding follows your W-4 and payroll tables, and Ohio exemptions and school district tax aren’t included.'],
      };
    },
  },

  'bonus-withholding': {
    inputs: [
      { id: 'bonus', label: 'Bonus amount', kind: 'money', default: 5000, min: 0 },
      { id: 'stateRate', label: 'State withholding rate on bonuses', kind: 'percent', default: 3.5, min: 0, max: 10, step: 0.05, help: 'Ask your payroll provider which rate they use.' },
      { id: 'cityRate', label: 'City income tax rate', kind: 'percent', default: 2.5, min: 0, max: 5, step: 0.05 },
      { id: 'ytdWages', label: 'Wages paid so far this year', kind: 'money', default: 50000, min: 0 },
    ],
    compute(v) {
      const bonus = num(v, 'bonus');
      const m = fed.more;
      const overMillion = Math.max(0, num(v, 'ytdWages') + bonus - 1_000_000) - Math.max(0, num(v, 'ytdWages') - 1_000_000);
      const fedW = (bonus - overMillion) * m.supplementalWithholdingRate + overMillion * m.supplementalWithholdingRateOver1M;
      const p = fed.payroll;
      const ssRoom = Math.max(0, p.socialSecurityWageBase - num(v, 'ytdWages'));
      const fica = Math.min(bonus, ssRoom) * p.socialSecurityRate + bonus * p.medicareRate;
      const state = bonus * pct(v, 'stateRate');
      const city = bonus * pct(v, 'cityRate');
      return {
        outputs: [money('Federal withholding (flat rate)', fedW), money('Social Security and Medicare', fica), money('State and city withholding', state + city), money('Bonus after withholding', bonus - fedW - fica - state - city, true)],
        notes: ['Withholding isn’t your final tax. The bonus is taxed with your other income when you file.'],
      };
    },
  },

  'raise-impact': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'salary', label: 'Current salary', kind: 'money', default: 55000, min: 0 },
      { id: 'raise', label: 'Raise', kind: 'percent', default: 4, min: 0, max: 100, step: 0.1 },
      PAY_PERIODS,
      { id: 'cityRate', label: 'City income tax rate', kind: 'percent', default: 2.5, min: 0, max: 5, step: 0.05 },
    ],
    compute(v) {
      const s = status(v);
      const before = num(v, 'salary');
      const after = before * (1 + pct(v, 'raise'));
      const net = (w: number) =>
        w - federalIncomeTax(Math.max(0, w - standardDeduction(s)), s) - employeeFica(w, s).total - ohioIncomeTax(w) - w * pct(v, 'cityRate');
      const gain = net(after) - net(before);
      const periods = Number(str(v, 'periods'));
      return { outputs: [money('New salary', after), money('Raise before taxes', after - before), money('Raise after taxes, per year', gain), money('More per paycheck', gain / periods, true)] };
    },
  },

  'pretax-401k-impact': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'salary', label: 'Yearly salary', kind: 'money', default: 65000, min: 0 },
      { id: 'contribution', label: '401(k) contribution', kind: 'percent', default: 6, min: 0, max: 100, step: 0.5 },
      PAY_PERIODS,
    ],
    compute(v) {
      const s = status(v);
      const salary = num(v, 'salary');
      const c = Math.min(salary * pct(v, 'contribution'), fed.retirement.employeeDeferral401k);
      const taxNo = federalIncomeTax(Math.max(0, salary - standardDeduction(s)), s) + ohioIncomeTax(salary);
      const taxYes = federalIncomeTax(Math.max(0, salary - c - standardDeduction(s)), s) + ohioIncomeTax(salary - c);
      const saved = taxNo - taxYes;
      const periods = Number(str(v, 'periods'));
      return {
        outputs: [money('Yearly contribution', c), money('Income tax saved (federal and Ohio)', saved), money('Real cost to your take-home pay', c - saved, true), money('Per paycheck', (c - saved) / periods)],
        notes: ['Traditional 401(k) contributions still pay Social Security and Medicare tax, and city tax rules vary.'],
      };
    },
  },

  'w4-extra-withholding': {
    inputs: [
      { id: 'shortfall', label: 'Expected amount you’ll owe at tax time', kind: 'money', default: 1200, min: 0 },
      { id: 'paychecksLeft', label: 'Paychecks left this year', kind: 'integer', default: 12, min: 1, max: 52 },
    ],
    compute(v) {
      return {
        outputs: [money('Extra withholding per paycheck', num(v, 'shortfall') / num(v, 'paychecksLeft'), true)],
        notes: ['Enter this on Form W-4, Step 4(c), and give it to your employer. The IRS Tax Withholding Estimator gives a more precise number.'],
      };
    },
  },

  /* ================= Retirement ================= */
  'roth-vs-traditional': {
    inputs: [
      { id: 'contribution', label: 'Yearly contribution (before tax)', kind: 'money', default: 6000, min: 0 },
      { id: 'years', label: 'Years until retirement', kind: 'integer', default: 25, min: 1, max: 50 },
      { id: 'return', label: 'Expected annual return', kind: 'percent', default: 6, min: 0, max: 15, step: 0.1 },
      { id: 'rateNow', label: 'Your tax rate now (federal + state)', kind: 'percent', default: 25, min: 0, max: 50 },
      { id: 'rateLater', label: 'Your tax rate in retirement', kind: 'percent', default: 20, min: 0, max: 50 },
    ],
    compute(v) {
      const fv = futureValue(0, num(v, 'contribution'), pct(v, 'return'), num(v, 'years'));
      const traditional = fv * (1 - pct(v, 'rateLater'));
      const roth = fv * (1 - pct(v, 'rateNow'));
      return {
        outputs: [money('Traditional, after tax at withdrawal', traditional), money('Roth, after paying tax up front', roth), text('Comes out ahead', traditional > roth ? 'Traditional' : roth > traditional ? 'Roth' : 'Even')],
        notes: ['Compares the same pre-tax dollars. If your tax rate will be lower in retirement, traditional tends to win; if higher, Roth tends to win.'],
      };
    },
  },

  'required-minimum-distribution': {
    inputs: [
      { id: 'balance', label: 'Account balance on December 31 of last year', kind: 'money', default: 500000, min: 0 },
      { id: 'age', label: 'Your age at the end of this year', kind: 'integer', default: 75, min: 70, max: 120 },
      { id: 'born1960', label: 'Born in 1960 or later?', kind: 'select', default: 'no', options: YES_NO },
    ],
    compute(v) {
      const r = fed.rmd;
      const age = Math.min(120, Math.floor(num(v, 'age')));
      const start = str(v, 'born1960') === 'yes' ? r.startAgeBorn1960OrLater : r.startAgeBornBefore1960;
      if (age < start) return { outputs: [text('Required minimum distribution', `Not required yet. RMDs start at age ${start} for you.`)] };
      const period = r.distributionPeriodByAge[String(age)];
      return {
        outputs: [{ label: 'Distribution period', value: period, format: 'number' }, money('Required minimum distribution', num(v, 'balance') / period, true)],
        notes: ['Uses the IRS Uniform Lifetime Table. A different table applies if your spouse is the sole beneficiary and more than 10 years younger. Roth IRAs have no RMDs for the original owner.'],
      };
    },
  },

  'retirement-income-withdrawal': {
    inputs: [
      { id: 'savings', label: 'Retirement savings', kind: 'money', default: 600000, min: 0 },
      { id: 'withdrawal', label: 'First-year withdrawal rate', kind: 'percent', default: 4, min: 0.5, max: 15, step: 0.1 },
      { id: 'return', label: 'Expected annual return', kind: 'percent', default: 5, min: 0, max: 15, step: 0.1 },
      { id: 'inflation', label: 'Inflation (raises each year’s withdrawal)', kind: 'percent', default: 3, min: 0, max: 10, step: 0.1 },
    ],
    compute(v) {
      let bal = num(v, 'savings');
      let draw = bal * pct(v, 'withdrawal');
      const first = draw;
      let years = 0;
      while (bal > 0 && years < 60) {
        bal = (bal - draw) * (1 + pct(v, 'return'));
        draw *= 1 + pct(v, 'inflation');
        if (bal > 0) years++;
      }
      return {
        outputs: [money('First-year income', first), money('Per month', first / 12), years >= 60 ? text('Money lasts', '60+ years at these assumptions') : { label: 'Money lasts about', value: years + 1, format: 'years', emphasis: true }],
        notes: ['Real returns vary year to year; a bad early stretch can shorten how long savings last.'],
      };
    },
  },

  'social-security-claiming-age': {
    inputs: [
      { id: 'pia', label: 'Monthly benefit at full retirement age (from your SSA statement)', kind: 'money', default: 2000, min: 0 },
      { id: 'lifeExpectancy', label: 'Age you plan for', kind: 'integer', default: 88, min: 63, max: 105 },
    ],
    compute(v) {
      const c = fed.ssClaiming;
      const fra = c.fullRetirementAgeBorn1960OrLater;
      const rows: (number | string)[][] = [];
      let best = { age: 0, total: 0 };
      for (let age = c.earliestClaimAge; age <= c.latestCreditAge; age++) {
        let factor = 1;
        if (age < fra) {
          const m = (fra - age) * 12;
          factor = 1 - Math.min(m, 36) * c.earlyReductionPerMonthFirst36 - Math.max(0, m - 36) * c.earlyReductionPerMonthAfter36;
        } else if (age > fra) {
          factor = 1 + (age - fra) * c.delayedCreditPerYear;
        }
        const monthly = num(v, 'pia') * factor;
        const total = monthly * 12 * Math.max(0, num(v, 'lifeExpectancy') - age);
        if (total > best.total) best = { age, total };
        rows.push([age, monthly, total]);
      }
      return {
        outputs: [{ label: 'Claiming age with the most total benefits', value: best.age, format: 'number', emphasis: true }, money('Lifetime benefits at that age', best.total)],
        table: { caption: `Benefits by claiming age (planning to age ${num(v, 'lifeExpectancy')})`, columns: ['Claim at age', 'Monthly benefit', 'Total to that age'], formats: ['number', 'money', 'money'], rows },
        notes: ['For people born in 1960 or later (full retirement age 67). Doesn’t include cost-of-living increases, spousal benefits or taxes.'],
      };
    },
  },

  'catch-up-contributions': {
    inputs: [
      { id: 'age', label: 'Your age', kind: 'integer', default: 52, min: 50, max: 75 },
      { id: 'retireAge', label: 'Age you’ll stop contributing', kind: 'integer', default: 65, min: 51, max: 80 },
      { id: 'return', label: 'Expected annual return', kind: 'percent', default: 6, min: 0, max: 15, step: 0.1 },
    ],
    compute(v) {
      const r = fed.retirement;
      let bal = 0;
      for (let age = num(v, 'age'); age < num(v, 'retireAge'); age++) {
        const catchUp = age >= 60 && age <= 63 ? r.catchUp401kAge60to63 : r.catchUp401kAge50;
        bal = bal * (1 + pct(v, 'return')) + catchUp;
      }
      return {
        outputs: [money('2026 401(k) catch-up (age 50+)', r.catchUp401kAge50), money('2026 catch-up at ages 60–63', r.catchUp401kAge60to63), money('Extra savings from catch-ups by retirement', bal, true)],
        notes: ['Assumes catch-up limits stay at 2026 levels. Starting in 2026, higher earners may have to make catch-ups as Roth contributions.'],
      };
    },
  },

  'early-withdrawal-cost': {
    inputs: [
      { id: 'amount', label: 'Amount to withdraw', kind: 'money', default: 10000, min: 0 },
      { id: 'fedRate', label: 'Your federal tax bracket', kind: 'percent', default: 22, min: 0, max: 37 },
      { id: 'stateRate', label: 'State and city tax rate', kind: 'percent', default: 5, min: 0, max: 15, step: 0.1 },
      { id: 'under59', label: 'Under age 59½?', kind: 'select', default: 'yes', options: YES_NO },
    ],
    compute(v) {
      const amount = num(v, 'amount');
      const penalty = str(v, 'under59') === 'yes' ? amount * fed.more.earlyDistributionAdditionalTaxRate : 0;
      const taxes = amount * (pct(v, 'fedRate') + pct(v, 'stateRate'));
      return {
        outputs: [money('Income taxes', taxes), money('10% additional tax', penalty), money('What you actually keep', amount - taxes - penalty, true), percentOut('Share lost to taxes', amount > 0 ? (taxes + penalty) / amount : 0)],
        notes: ['Some exceptions to the 10% additional tax apply (for example disability or certain medical costs). Ohio and many cities may not tax some retirement income the same way.'],
      };
    },
  },

  /* ================= Kids and young adults ================= */
  'college-savings-529': {
    inputs: [
      { id: 'age', label: 'Child’s age now', kind: 'integer', default: 5, min: 0, max: 17 },
      { id: 'cost', label: 'One year of college today', kind: 'money', default: 25000, min: 0 },
      { id: 'years', label: 'Years of college', kind: 'integer', default: 4, min: 1, max: 6 },
      { id: 'costGrowth', label: 'College cost increase per year', kind: 'percent', default: 4, min: 0, max: 10, step: 0.1 },
      { id: 'saved', label: 'Already saved', kind: 'money', default: 5000, min: 0 },
      { id: 'return', label: 'Expected annual return', kind: 'percent', default: 5, min: 0, max: 12, step: 0.1 },
    ],
    compute(v) {
      const yearsUntil = 18 - num(v, 'age');
      let total = 0;
      for (let y = 0; y < num(v, 'years'); y++) total += num(v, 'cost') * Math.pow(1 + pct(v, 'costGrowth'), yearsUntil + y);
      const monthly = paymentForGoal(total, num(v, 'saved'), pct(v, 'return') / 12, yearsUntil * 12);
      return {
        outputs: [money('Estimated total college cost', total), money('Save each month to cover it', monthly, true)],
        notes: ['529 plan earnings grow tax-free when used for qualified education costs, and Ohio allows a state deduction for contributions to Ohio’s 529 plan.'],
      };
    },
  },

  'allowance-planner': {
    inputs: [
      { id: 'weekly', label: 'Weekly allowance', kind: 'money', default: 15, min: 0 },
      { id: 'save', label: 'Save', kind: 'percent', default: 40, min: 0, max: 100 },
      { id: 'give', label: 'Give', kind: 'percent', default: 10, min: 0, max: 100 },
    ],
    compute(v) {
      const w = num(v, 'weekly');
      const spendPct = Math.max(0, 1 - pct(v, 'save') - pct(v, 'give'));
      return {
        outputs: [money('Save each week', w * pct(v, 'save')), money('Give each week', w * pct(v, 'give')), money('Spend each week', w * spendPct), money('Saved after one year', w * pct(v, 'save') * 52, true)],
        notes: pct(v, 'save') + pct(v, 'give') > 1 ? ['Save and give add up to more than 100%.'] : undefined,
      };
    },
  },

  'first-car-cost': {
    inputs: [
      { id: 'price', label: 'Car price', kind: 'money', default: 12000, min: 0 },
      { id: 'down', label: 'Down payment', kind: 'money', default: 2000, min: 0 },
      { id: 'rate', label: 'Loan rate', kind: 'percent', default: 9, min: 0, max: 30, step: 0.1 },
      { id: 'years', label: 'Loan years', kind: 'integer', default: 4, min: 1, max: 7 },
      { id: 'insurance', label: 'Insurance per month', kind: 'money', default: 180, min: 0 },
      { id: 'gas', label: 'Gas per month', kind: 'money', default: 120, min: 0 },
      { id: 'upkeep', label: 'Maintenance per month', kind: 'money', default: 60, min: 0 },
    ],
    compute(v) {
      const pay = loanPayment(Math.max(0, num(v, 'price') - num(v, 'down')), pct(v, 'rate') / 12, num(v, 'years') * 12);
      const total = pay + num(v, 'insurance') + num(v, 'gas') + num(v, 'upkeep');
      return { outputs: [money('Car payment', pay), money('Total cost per month', total, true), money('Total cost per year', total * 12)] };
    },
  },

  'summer-job-take-home': {
    inputs: [
      { id: 'hourly', label: 'Hourly pay', kind: 'money', default: 15, min: 0, step: 0.01 },
      { id: 'hours', label: 'Hours per week', kind: 'number', default: 30, min: 0, max: 80 },
      { id: 'weeks', label: 'Weeks', kind: 'integer', default: 10, min: 1, max: 52 },
      { id: 'cityRate', label: 'City income tax rate', kind: 'percent', default: 2.5, min: 0, max: 5, step: 0.05 },
    ],
    compute(v) {
      const gross = num(v, 'hourly') * num(v, 'hours') * num(v, 'weeks');
      const fedTax = federalIncomeTax(Math.max(0, gross - standardDeduction('single')), 'single');
      const fica = employeeFica(gross, 'single').total;
      const ohioTax = ohioIncomeTax(gross);
      const city = gross * pct(v, 'cityRate');
      return {
        outputs: [money('Total pay', gross), money('Federal income tax for the year', fedTax), money('Social Security and Medicare', fica), money('Ohio and city tax', ohioTax + city), money('Take-home pay', gross - fedTax - fica - ohioTax - city, true)],
        notes: ['If this is your only income, little or no federal income tax may be owed; you may get withholding back by filing a return.'],
      };
    },
  },

  /* ================= Investment ================= */
  'dividend-yield': {
    inputs: [
      { id: 'price', label: 'Share price', kind: 'money', default: 50, min: 0, step: 0.01 },
      { id: 'dividend', label: 'Yearly dividend per share', kind: 'money', default: 1.6, min: 0, step: 0.01 },
      { id: 'shares', label: 'Shares owned', kind: 'number', default: 200, min: 0 },
    ],
    compute(v) {
      return { outputs: [percentOut('Dividend yield', num(v, 'price') > 0 ? num(v, 'dividend') / num(v, 'price') : 0, true), money('Yearly dividend income', num(v, 'dividend') * num(v, 'shares')), money('Per quarter', (num(v, 'dividend') * num(v, 'shares')) / 4)] };
    },
  },

  'dollar-cost-averaging': {
    inputs: [
      { id: 'amount', label: 'Amount invested each time', kind: 'money', default: 500, min: 0 },
      ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: `p${i}`, label: `Price at purchase ${i}`, kind: 'money' as const, default: [50, 42, 38, 45, 55, 60][i - 1], min: 0.01, step: 0.01 })),
    ],
    compute(v) {
      const prices = [1, 2, 3, 4, 5, 6].map((i) => num(v, `p${i}`)).filter((p) => p > 0);
      const shares = sum(prices.map((p) => num(v, 'amount') / p));
      const invested = num(v, 'amount') * prices.length;
      const avgPrice = sum(prices) / prices.length;
      return {
        outputs: [{ label: 'Shares bought', value: shares, format: 'number' }, money('Your average cost per share', shares > 0 ? invested / shares : 0, true), money('Average of the prices', avgPrice), money('Value at the last price', shares * prices[prices.length - 1])],
        notes: ['Investing a fixed amount buys more shares when prices are low, so your average cost ends up below the average price.'],
      };
    },
  },

  'portfolio-rebalancing': {
    inputs: [
      { id: 'stocks', label: 'Stocks now', kind: 'money', default: 70000, min: 0 },
      { id: 'bonds', label: 'Bonds now', kind: 'money', default: 25000, min: 0 },
      { id: 'cash', label: 'Cash now', kind: 'money', default: 5000, min: 0 },
      { id: 'targetStocks', label: 'Target for stocks', kind: 'percent', default: 60, min: 0, max: 100 },
      { id: 'targetBonds', label: 'Target for bonds', kind: 'percent', default: 35, min: 0, max: 100 },
    ],
    compute(v) {
      const total = num(v, 'stocks') + num(v, 'bonds') + num(v, 'cash');
      const targetCash = Math.max(0, 1 - pct(v, 'targetStocks') - pct(v, 'targetBonds'));
      const move = (now: number, target: number) => total * target - now;
      const describe = (x: number) => (Math.abs(x) < 0.5 ? 'No change' : x > 0 ? `Buy ${Math.round(x).toLocaleString('en-US')}` : `Sell ${Math.round(-x).toLocaleString('en-US')}`);
      return {
        outputs: [
          money('Total portfolio', total),
          text('Stocks', describe(move(num(v, 'stocks'), pct(v, 'targetStocks'))), false),
          text('Bonds', describe(move(num(v, 'bonds'), pct(v, 'targetBonds'))), false),
          text('Cash', describe(move(num(v, 'cash'), targetCash)), true),
        ],
        notes: ['Amounts are in dollars. Selling in a taxable account can create capital gains; rebalancing inside retirement accounts doesn’t.'],
      };
    },
  },

  'bond-yield': {
    inputs: [
      { id: 'face', label: 'Face value', kind: 'money', default: 1000, min: 0 },
      { id: 'price', label: 'Price you pay', kind: 'money', default: 950, min: 0.01 },
      { id: 'coupon', label: 'Coupon rate', kind: 'percent', default: 4, min: 0, max: 20, step: 0.01 },
      { id: 'years', label: 'Years to maturity', kind: 'number', default: 5, min: 0.5, max: 50 },
    ],
    compute(v) {
      const c = num(v, 'face') * pct(v, 'coupon');
      const p = num(v, 'price');
      const ytm = (c + (num(v, 'face') - p) / num(v, 'years')) / ((num(v, 'face') + p) / 2);
      return { outputs: [money('Yearly interest', c), percentOut('Current yield', p > 0 ? c / p : 0), percentOut('Approximate yield to maturity', ytm, true)] };
    },
  },

  'inflation-adjusted-return': {
    inputs: [
      { id: 'nominal', label: 'Return before inflation', kind: 'percent', default: 7, min: -50, max: 50, step: 0.1 },
      { id: 'inflation', label: 'Inflation', kind: 'percent', default: 3, min: -10, max: 30, step: 0.1 },
    ],
    compute(v) {
      return { outputs: [percentOut('Real (inflation-adjusted) return', (1 + pct(v, 'nominal')) / (1 + pct(v, 'inflation')) - 1, true)] };
    },
  },

  'capital-gain-on-sale': {
    inputs: [
      FILING_STATUS_INPUT,
      { id: 'proceeds', label: 'Sale proceeds', kind: 'money', default: 15000, min: 0 },
      { id: 'basis', label: 'Cost basis (what you paid, plus fees)', kind: 'money', default: 10000, min: 0 },
      { id: 'longTerm', label: 'Held more than one year?', kind: 'select', default: 'yes', options: YES_NO },
      { id: 'otherIncome', label: 'Your other taxable income', kind: 'money', default: 60000, min: 0 },
    ],
    compute(v) {
      const s = status(v);
      const gain = num(v, 'proceeds') - num(v, 'basis');
      if (gain <= 0) {
        const limit = fed.more.capitalLossLimit[s];
        return {
          outputs: [money('Capital loss', -gain, true), money('Deductible against other income this year', Math.min(-gain, limit)), money('Carried to future years', Math.max(0, -gain - limit))],
          notes: ['Losses first offset any other capital gains.'],
        };
      }
      const other = num(v, 'otherIncome');
      const base = federalIncomeTax(other, s);
      const tax = str(v, 'longTerm') === 'yes' ? taxWithCapitalGains(other + gain, gain, s).total - base : federalIncomeTax(other + gain, s) - base;
      return {
        outputs: [money('Capital gain', gain), money('Estimated federal tax on the gain', tax, true), percentOut('Rate on this gain', tax / gain), percentOut('Your ordinary top rate', marginalRate(other, fed.brackets[s]))],
        notes: ['The 3.8% net investment income tax and state tax aren’t included.'],
      };
    },
  },

  /* ================= Loans ================= */
  'personal-loan': {
    inputs: [
      { id: 'amount', label: 'Loan amount', kind: 'money', default: 10000, min: 0 },
      { id: 'rate', label: 'Interest rate', kind: 'percent', default: 11, min: 0, max: 40, step: 0.01 },
      { id: 'years', label: 'Term (years)', kind: 'number', default: 3, min: 0.5, max: 10 },
      { id: 'fee', label: 'Origination fee', kind: 'percent', default: 4, min: 0, max: 12, step: 0.1 },
    ],
    compute(v) {
      const n = Math.round(num(v, 'years') * 12);
      const pay = loanPayment(num(v, 'amount'), pct(v, 'rate') / 12, n);
      const fee = num(v, 'amount') * pct(v, 'fee');
      return {
        outputs: [money('Monthly payment', pay, true), money('Fee taken up front', fee), money('Total interest', pay * n - num(v, 'amount')), percentOut('Effective rate including the fee', aprWithFee(num(v, 'amount'), fee, pay, n))],
      };
    },
  },

  'biweekly-payments': {
    inputs: [
      { id: 'amount', label: 'Loan amount', kind: 'money', default: 250000, min: 0 },
      { id: 'rate', label: 'Interest rate', kind: 'percent', default: 6.5, min: 0, max: 20, step: 0.01 },
      { id: 'years', label: 'Term (years)', kind: 'integer', default: 30, min: 1, max: 40 },
    ],
    compute(v) {
      const n = num(v, 'years') * 12;
      const monthly = loanPayment(num(v, 'amount'), pct(v, 'rate') / 12, n);
      const monthlyRows = amortize(num(v, 'amount'), pct(v, 'rate') / 12, n);
      let bal = num(v, 'amount');
      let interest = 0;
      let k = 0;
      const half = monthly / 2;
      const r = pct(v, 'rate') / 26;
      while (bal > 0.005 && k < 26 * 60) {
        const i = bal * r;
        interest += i;
        bal = bal + i - half;
        k++;
      }
      return {
        outputs: [money('Monthly payment', monthly), money('Biweekly payment (half)', half), money('Interest saved', interestOf(monthlyRows) - interest, true), { label: 'Paid off sooner by', value: n / 12 - k / 26, format: 'years' }],
        notes: ['26 half-payments a year equal 13 monthly payments. Check that your lender applies the extra to principal.'],
      };
    },
  },

  'loan-amortization': {
    inputs: [
      { id: 'amount', label: 'Loan amount', kind: 'money', default: 15000, min: 0 },
      { id: 'rate', label: 'Interest rate', kind: 'percent', default: 8, min: 0, max: 40, step: 0.01 },
      { id: 'years', label: 'Term (years)', kind: 'number', default: 4, min: 0.5, max: 30 },
    ],
    compute(v) {
      const n = Math.round(num(v, 'years') * 12);
      const rows = amortize(num(v, 'amount'), pct(v, 'rate') / 12, n);
      return {
        outputs: [money('Monthly payment', loanPayment(num(v, 'amount'), pct(v, 'rate') / 12, n), true), money('Total interest', interestOf(rows))],
        table: { caption: 'Payment by payment', columns: ['Payment #', 'Interest', 'Principal', 'Balance'], formats: ['number', 'money', 'money', 'money'], rows: rows.map((r) => [r.period, r.interest, r.principal, r.balance]) },
      };
    },
  },

  'debt-consolidation': {
    inputs: [
      { id: 'b1', label: 'Debt 1 balance', kind: 'money', default: 5000, min: 0 },
      { id: 'r1', label: 'Debt 1 APR', kind: 'percent', default: 23, min: 0, max: 40, step: 0.01 },
      { id: 'p1', label: 'Debt 1 monthly payment', kind: 'money', default: 200, min: 0 },
      { id: 'b2', label: 'Debt 2 balance', kind: 'money', default: 4000, min: 0 },
      { id: 'r2', label: 'Debt 2 APR', kind: 'percent', default: 19, min: 0, max: 40, step: 0.01 },
      { id: 'p2', label: 'Debt 2 monthly payment', kind: 'money', default: 150, min: 0 },
      { id: 'newRate', label: 'Consolidation loan rate', kind: 'percent', default: 11, min: 0, max: 40, step: 0.01 },
      { id: 'newYears', label: 'Consolidation loan term (years)', kind: 'number', default: 3, min: 0.5, max: 10 },
      { id: 'fee', label: 'Loan fee', kind: 'percent', default: 3, min: 0, max: 12, step: 0.1 },
    ],
    compute(v) {
      const debts = [1, 2].map((i) => ({ balance: num(v, `b${i}`), apr: pct(v, `r${i}`), min: num(v, `p${i}`) }));
      const now = payDebts(debts, 0, 'avalanche');
      const total = sum(debts.map((d) => d.balance));
      const fee = total * pct(v, 'fee');
      const n = Math.round(num(v, 'newYears') * 12);
      const pay = loanPayment(total + fee, pct(v, 'newRate') / 12, n);
      const newInterest = pay * n - total - fee;
      return {
        outputs: [
          now ? money('Interest if you keep paying as now', now.interest) : text('Current plan', 'Current payments don’t keep up with interest.', false),
          money('Current monthly payments', sum(debts.map((d) => d.min))),
          money('New loan payment', pay),
          money('New loan interest plus fee', newInterest + fee),
          now ? money('Estimated savings', now.interest - (newInterest + fee), true) : text('Estimated savings', 'Consolidating gives you a payoff plan.'),
        ],
      };
    },
  },

  'business-loan-payment': {
    inputs: [
      { id: 'amount', label: 'Loan amount', kind: 'money', default: 50000, min: 0 },
      { id: 'rate', label: 'Interest rate', kind: 'percent', default: 9, min: 0, max: 40, step: 0.01 },
      { id: 'years', label: 'Term (years)', kind: 'number', default: 7, min: 0.5, max: 25 },
    ],
    compute(v) {
      const n = Math.round(num(v, 'years') * 12);
      const pay = loanPayment(num(v, 'amount'), pct(v, 'rate') / 12, n);
      const rows = amortize(num(v, 'amount'), pct(v, 'rate') / 12, n);
      const first = yearlySummary(rows)[0];
      return {
        outputs: [money('Monthly payment', pay, true), money('Total interest', interestOf(rows)), money('Interest in the first year', first?.interest ?? 0)],
        notes: ['Business loan interest is generally deductible as a business expense; principal is not.'],
      };
    },
  },

  'interest-only-vs-amortizing': {
    inputs: [
      { id: 'amount', label: 'Loan amount', kind: 'money', default: 200000, min: 0 },
      { id: 'rate', label: 'Interest rate', kind: 'percent', default: 7, min: 0, max: 20, step: 0.01 },
      { id: 'ioYears', label: 'Interest-only years', kind: 'integer', default: 10, min: 1, max: 15 },
      { id: 'years', label: 'Total term (years)', kind: 'integer', default: 30, min: 2, max: 40 },
    ],
    compute(v) {
      const r = pct(v, 'rate') / 12;
      const n = num(v, 'years') * 12;
      const io = num(v, 'amount') * r;
      const after = loanPayment(num(v, 'amount'), r, n - num(v, 'ioYears') * 12);
      const regular = loanPayment(num(v, 'amount'), r, n);
      const ioTotal = io * num(v, 'ioYears') * 12 + after * (n - num(v, 'ioYears') * 12) - num(v, 'amount');
      const regTotal = regular * n - num(v, 'amount');
      return {
        outputs: [money('Interest-only payment', io), money('Payment after interest-only ends', after), money('Regular payment the whole time', regular), money('Extra interest with interest-only', ioTotal - regTotal, true)],
      };
    },
  },

  /* ================= Automobile ================= */
  'lease-vs-buy': {
    inputs: [
      { id: 'price', label: 'Car price', kind: 'money', default: 35000, min: 0 },
      { id: 'down', label: 'Down payment if buying', kind: 'money', default: 4000, min: 0 },
      { id: 'rate', label: 'Loan rate', kind: 'percent', default: 7, min: 0, max: 30, step: 0.01 },
      { id: 'loanYears', label: 'Loan years', kind: 'integer', default: 5, min: 1, max: 8 },
      { id: 'leasePayment', label: 'Lease payment per month', kind: 'money', default: 450, min: 0 },
      { id: 'leaseMonths', label: 'Lease length (months)', kind: 'integer', default: 36, min: 12, max: 60 },
      { id: 'dueAtSigning', label: 'Due at lease signing', kind: 'money', default: 3000, min: 0 },
      { id: 'valueLeft', label: 'Car’s value at the end of the lease (% of price)', kind: 'percent', default: 55, min: 0, max: 100 },
    ],
    compute(v) {
      const m = num(v, 'leaseMonths');
      const loan = Math.max(0, num(v, 'price') - num(v, 'down'));
      const r = pct(v, 'rate') / 12;
      const n = num(v, 'loanYears') * 12;
      const pay = loanPayment(loan, r, n);
      const equity = num(v, 'price') * pct(v, 'valueLeft') - balanceAfter(loan, r, n, Math.min(m, n));
      const buyCost = num(v, 'down') + pay * Math.min(m, n) - equity;
      const leaseCost = num(v, 'dueAtSigning') + num(v, 'leasePayment') * m;
      return {
        outputs: [money(`Net cost of buying over ${m} months`, buyCost), money(`Cost of leasing over ${m} months`, leaseCost), text('Cheaper over the lease term', buyCost < leaseCost ? 'Buying' : 'Leasing')],
        notes: ['Leases may also charge for extra miles and wear. Business use changes the tax picture.'],
      };
    },
  },

  'car-affordability': {
    inputs: [
      { id: 'budget', label: 'Monthly payment you can afford', kind: 'money', default: 450, min: 0 },
      { id: 'rate', label: 'Loan rate', kind: 'percent', default: 7, min: 0, max: 30, step: 0.01 },
      { id: 'years', label: 'Loan years', kind: 'integer', default: 5, min: 1, max: 8 },
      { id: 'down', label: 'Down payment and trade-in', kind: 'money', default: 5000, min: 0 },
      { id: 'salesTax', label: 'Sales tax rate', kind: 'percent', default: 8, min: 0, max: 12, step: 0.05, help: 'Ohio’s state rate plus your county’s rate.' },
    ],
    compute(v) {
      const loan = loanForPayment(num(v, 'budget'), pct(v, 'rate') / 12, num(v, 'years') * 12);
      const price = (loan + num(v, 'down')) / (1 + pct(v, 'salesTax'));
      return { outputs: [money('Loan amount', loan), money('Car price you can afford (before tax)', price, true)], notes: ['Leave room for insurance, gas and upkeep.'] };
    },
  },

  'trade-in-effect': {
    inputs: [
      { id: 'price', label: 'New car price', kind: 'money', default: 32000, min: 0 },
      { id: 'tradeValue', label: 'Trade-in value', kind: 'money', default: 9000, min: 0 },
      { id: 'tradePayoff', label: 'Loan still owed on your trade-in', kind: 'money', default: 4000, min: 0 },
      { id: 'salesTax', label: 'Sales tax rate', kind: 'percent', default: 8, min: 0, max: 12, step: 0.05 },
    ],
    compute(v) {
      const taxable = Math.max(0, num(v, 'price') - num(v, 'tradeValue'));
      const tax = taxable * pct(v, 'salesTax');
      const taxSaved = num(v, 'price') * pct(v, 'salesTax') - tax;
      const netTrade = num(v, 'tradeValue') - num(v, 'tradePayoff');
      return {
        outputs: [money('Net trade-in equity', netTrade), money('Sales tax', tax), money('Sales tax saved by trading in', taxSaved), money('Amount to finance or pay', num(v, 'price') + tax - netTrade, true)],
        notes: ['Ohio generally lets you subtract the trade-in value before figuring sales tax on a vehicle purchase from a dealer.'],
      };
    },
  },

  'total-cost-of-ownership': {
    inputs: [
      { id: 'price', label: 'Purchase price', kind: 'money', default: 30000, min: 0 },
      { id: 'years', label: 'Years you’ll keep it', kind: 'integer', default: 6, min: 1, max: 20 },
      { id: 'resale', label: 'Value when you sell (% of price)', kind: 'percent', default: 40, min: 0, max: 100 },
      { id: 'interest', label: 'Total loan interest', kind: 'money', default: 4000, min: 0 },
      { id: 'insurance', label: 'Insurance per year', kind: 'money', default: 1600, min: 0 },
      { id: 'fuel', label: 'Fuel per year', kind: 'money', default: 1600, min: 0 },
      { id: 'maintenance', label: 'Maintenance and repairs per year', kind: 'money', default: 900, min: 0 },
      { id: 'miles', label: 'Miles per year', kind: 'number', default: 12000, min: 1 },
    ],
    compute(v) {
      const years = num(v, 'years');
      const depreciation = num(v, 'price') * (1 - pct(v, 'resale'));
      const total = depreciation + num(v, 'interest') + (num(v, 'insurance') + num(v, 'fuel') + num(v, 'maintenance')) * years;
      return { outputs: [money('Depreciation', depreciation), money('Total cost of ownership', total, true), money('Per year', total / years), money('Per mile', total / (num(v, 'miles') * years))] };
    },
  },

  'auto-loan-early-payoff': {
    inputs: [
      { id: 'balance', label: 'Loan balance', kind: 'money', default: 18000, min: 0 },
      { id: 'rate', label: 'Interest rate', kind: 'percent', default: 7.5, min: 0, max: 30, step: 0.01 },
      { id: 'monthsLeft', label: 'Months left', kind: 'integer', default: 48, min: 1, max: 96 },
      { id: 'extra', label: 'Extra each month', kind: 'money', default: 100, min: 0 },
    ],
    compute(v) {
      const r = pct(v, 'rate') / 12;
      const base = amortize(num(v, 'balance'), r, num(v, 'monthsLeft'));
      const fast = amortize(num(v, 'balance'), r, num(v, 'monthsLeft'), num(v, 'extra'));
      return { outputs: [money('Interest saved', interestOf(base) - interestOf(fast), true), { label: 'Paid off sooner by', value: base.length - fast.length, format: 'months' }] };
    },
  },

  'gas-vs-electric': {
    inputs: [
      { id: 'miles', label: 'Miles per year', kind: 'number', default: 12000, min: 0 },
      { id: 'mpg', label: 'Gas car miles per gallon', kind: 'number', default: 30, min: 1 },
      { id: 'gasPrice', label: 'Gas price per gallon', kind: 'money', default: 3.25, min: 0, step: 0.01 },
      { id: 'kwhPer100', label: 'Electric car kWh per 100 miles', kind: 'number', default: 30, min: 1 },
      { id: 'kwhPrice', label: 'Electricity price per kWh', kind: 'money', default: 0.16, min: 0, step: 0.01 },
      { id: 'years', label: 'Years', kind: 'integer', default: 5, min: 1, max: 20 },
    ],
    compute(v) {
      const gas = (num(v, 'miles') / num(v, 'mpg')) * num(v, 'gasPrice');
      const ev = (num(v, 'miles') / 100) * num(v, 'kwhPer100') * num(v, 'kwhPrice');
      return { outputs: [money('Gas cost per year', gas), money('Electricity cost per year', ev), money(`Fuel savings over ${num(v, 'years')} years`, (gas - ev) * num(v, 'years'), true)] };
    },
  },
};

export type { CalcResult };
