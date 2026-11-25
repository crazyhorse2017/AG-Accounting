import { fed } from '../../content/taxYear.ts';
import { amortize, cagr, compound, futureValue, loanPayment, paymentForGoal, periodsToGoal, periodsToPayOff, yearlySummary } from '../../lib/finance.ts';
import { employeeFica } from '../../lib/tax.ts';
import { FILING_STATUS_INPUT, num, pct, str } from '../types.ts';
import type { CalcResult, CalculatorImpl } from '../types.ts';
import type { FilingStatus } from '../../content/taxYear.ts';

const yearlyTable = (rows: ReturnType<typeof amortize>, caption: string): CalcResult['table'] => ({
  caption,
  columns: ['Year', 'Paid', 'Interest', 'Principal', 'Balance'],
  formats: ['number', 'money', 'money', 'money', 'money'],
  rows: yearlySummary(rows).map((y) => [y.year, y.paid, y.interest, y.principal, y.balance]),
});

const sumInterest = (rows: ReturnType<typeof amortize>) => rows.reduce((s, r) => s + r.interest, 0);

function loanCalc(defaults: { amount: number; rate: number; years: number }, label = 'Loan amount'): CalculatorImpl {
  return {
    inputs: [
      { id: 'amount', label, kind: 'money', default: defaults.amount, min: 0 },
      { id: 'rate', label: 'Annual interest rate', kind: 'percent', default: defaults.rate, min: 0, max: 40, step: 0.01 },
      { id: 'years', label: 'Term (years)', kind: 'number', default: defaults.years, min: 0.5, max: 40 },
    ],
    compute(v) {
      const n = Math.round(num(v, 'years') * 12);
      const r = pct(v, 'rate') / 12;
      const payment = loanPayment(num(v, 'amount'), r, n);
      const rows = amortize(num(v, 'amount'), r, n);
      return {
        outputs: [
          { label: 'Monthly payment', value: payment, format: 'money', emphasis: true },
          { label: 'Total interest', value: sumInterest(rows), format: 'money' },
          { label: 'Total of all payments', value: payment * n, format: 'money' },
        ],
        table: yearlyTable(rows, 'Year-by-year summary'),
      };
    },
  };
}

export const personalCalculators: Record<string, CalculatorImpl> = {
  /* ---------------- Savings ---------------- */
  'savings-goal': {
    inputs: [
      { id: 'goal', label: 'Savings goal', kind: 'money', default: 20000, min: 0 },
      { id: 'start', label: 'Already saved', kind: 'money', default: 2000, min: 0 },
      { id: 'years', label: 'Years to reach it', kind: 'number', default: 3, min: 0.1, max: 60 },
      { id: 'rate', label: 'Expected annual return', kind: 'percent', default: 4, min: 0, max: 20, step: 0.1 },
    ],
    compute(v) {
      const n = Math.round(num(v, 'years') * 12);
      const monthly = paymentForGoal(num(v, 'goal'), num(v, 'start'), pct(v, 'rate') / 12, n);
      return {
        outputs: [
          { label: 'Save each month', value: monthly, format: 'money', emphasis: true },
          { label: 'Total you’ll put in', value: monthly * n, format: 'money' },
          { label: 'Growth from interest', value: Math.max(0, num(v, 'goal') - num(v, 'start') - monthly * n), format: 'money' },
        ],
      };
    },
  },

  'compound-interest': {
    inputs: [
      { id: 'start', label: 'Starting amount', kind: 'money', default: 10000, min: 0 },
      { id: 'monthly', label: 'Monthly addition', kind: 'money', default: 200, min: 0 },
      { id: 'rate', label: 'Annual interest rate', kind: 'percent', default: 5, min: 0, max: 30, step: 0.1 },
      { id: 'years', label: 'Years', kind: 'integer', default: 10, min: 1, max: 60 },
    ],
    compute(v) {
      const years = Math.floor(num(v, 'years'));
      const r = pct(v, 'rate') / 12;
      const rows: (number | string)[][] = [];
      for (let y = 1; y <= years; y++) {
        rows.push([y, num(v, 'start') + num(v, 'monthly') * 12 * y, futureValue(num(v, 'start'), num(v, 'monthly'), r, y * 12)]);
      }
      const end = futureValue(num(v, 'start'), num(v, 'monthly'), r, years * 12);
      const contributed = num(v, 'start') + num(v, 'monthly') * 12 * years;
      return {
        outputs: [
          { label: 'Ending balance', value: end, format: 'money', emphasis: true },
          { label: 'Total contributed', value: contributed, format: 'money' },
          { label: 'Interest earned', value: end - contributed, format: 'money' },
        ],
        table: { caption: 'Growth by year', columns: ['Year', 'Contributed', 'Balance'], formats: ['number', 'money', 'money'], rows },
        notes: ['Assumes interest compounds monthly and additions are made at the end of each month.'],
      };
    },
  },

  'emergency-fund': {
    inputs: [
      { id: 'expenses', label: 'Essential monthly expenses', kind: 'money', default: 3500, min: 0 },
      { id: 'months', label: 'Months of expenses to cover', kind: 'integer', default: 6, min: 1, max: 24 },
      { id: 'saved', label: 'Already saved', kind: 'money', default: 5000, min: 0 },
      { id: 'monthlySaving', label: 'You can save each month', kind: 'money', default: 400, min: 0 },
    ],
    compute(v) {
      const target = num(v, 'expenses') * num(v, 'months');
      const gap = Math.max(0, target - num(v, 'saved'));
      const per = num(v, 'monthlySaving');
      return {
        outputs: [
          { label: 'Emergency fund target', value: target, format: 'money', emphasis: true },
          { label: 'Still to save', value: gap, format: 'money' },
          { label: 'Months to reach it', value: gap === 0 ? 0 : per > 0 ? Math.ceil(gap / per) : 'Add a monthly amount', format: gap === 0 || per > 0 ? 'months' : 'text' },
        ],
      };
    },
  },

  'rule-of-72': {
    inputs: [{ id: 'rate', label: 'Annual rate of return', kind: 'percent', default: 7, min: 0.1, max: 50, step: 0.1 }],
    compute(v) {
      const rate = num(v, 'rate');
      const exact = Math.log(2) / Math.log(1 + rate / 100);
      return {
        outputs: [
          { label: 'Years to double (rule of 72)', value: 72 / rate, format: 'years', emphasis: true },
          { label: 'Years to double (exact)', value: exact, format: 'years' },
        ],
      };
    },
  },

  'inflation-impact': {
    inputs: [
      { id: 'amount', label: 'Amount today', kind: 'money', default: 1000, min: 0 },
      { id: 'rate', label: 'Annual inflation rate', kind: 'percent', default: 3, min: 0, max: 20, step: 0.1 },
      { id: 'years', label: 'Years from now', kind: 'integer', default: 10, min: 1, max: 60 },
    ],
    compute(v) {
      const f = Math.pow(1 + pct(v, 'rate'), num(v, 'years'));
      return {
        outputs: [
          { label: 'Cost of the same things in the future', value: num(v, 'amount') * f, format: 'money', emphasis: true },
          { label: 'What today’s amount will buy then (in today’s dollars)', value: num(v, 'amount') / f, format: 'money' },
        ],
      };
    },
  },

  'cd-earnings': {
    inputs: [
      { id: 'deposit', label: 'Deposit', kind: 'money', default: 10000, min: 0 },
      { id: 'apy', label: 'APY', kind: 'percent', default: 4, min: 0, max: 20, step: 0.01 },
      { id: 'months', label: 'Term (months)', kind: 'integer', default: 12, min: 1, max: 120 },
    ],
    compute(v) {
      const end = num(v, 'deposit') * Math.pow(1 + pct(v, 'apy'), num(v, 'months') / 12);
      return {
        outputs: [
          { label: 'Value at maturity', value: end, format: 'money', emphasis: true },
          { label: 'Interest earned', value: end - num(v, 'deposit'), format: 'money' },
        ],
        notes: ['CD interest is generally taxable in the year it’s credited to you, even if you don’t withdraw it.'],
      };
    },
  },

  /* ---------------- Mortgage ---------------- */
  'mortgage-payment': {
    inputs: [
      { id: 'price', label: 'Home price', kind: 'money', default: 300000, min: 0 },
      { id: 'down', label: 'Down payment', kind: 'money', default: 60000, min: 0 },
      { id: 'rate', label: 'Interest rate', kind: 'percent', default: 6.5, min: 0, max: 20, step: 0.01 },
      { id: 'years', label: 'Term (years)', kind: 'select', default: '30', options: [{ value: '30', label: '30 years' }, { value: '20', label: '20 years' }, { value: '15', label: '15 years' }, { value: '10', label: '10 years' }] },
      { id: 'tax', label: 'Property tax per year', kind: 'money', default: 4500, min: 0 },
      { id: 'insurance', label: 'Homeowners insurance per year', kind: 'money', default: 1400, min: 0 },
    ],
    compute(v) {
      const loan = Math.max(0, num(v, 'price') - num(v, 'down'));
      const n = Number(str(v, 'years')) * 12;
      const pi = loanPayment(loan, pct(v, 'rate') / 12, n);
      const escrow = (num(v, 'tax') + num(v, 'insurance')) / 12;
      const rows = amortize(loan, pct(v, 'rate') / 12, n);
      return {
        outputs: [
          { label: 'Loan amount', value: loan, format: 'money' },
          { label: 'Principal and interest', value: pi, format: 'money' },
          { label: 'Taxes and insurance', value: escrow, format: 'money' },
          { label: 'Estimated monthly payment', value: pi + escrow, format: 'money', emphasis: true },
          { label: 'Total interest over the loan', value: sumInterest(rows), format: 'money' },
        ],
        table: yearlyTable(rows, 'Year-by-year loan summary'),
        notes: ['PMI may apply if your down payment is under 20%. HOA dues aren’t included.'],
      };
    },
  },

  'mortgage-extra-payments': {
    inputs: [
      { id: 'balance', label: 'Loan balance', kind: 'money', default: 240000, min: 0 },
      { id: 'rate', label: 'Interest rate', kind: 'percent', default: 6.5, min: 0, max: 20, step: 0.01 },
      { id: 'yearsLeft', label: 'Years left on the loan', kind: 'number', default: 30, min: 1, max: 40 },
      { id: 'extra', label: 'Extra principal each month', kind: 'money', default: 200, min: 0 },
    ],
    compute(v) {
      const r = pct(v, 'rate') / 12;
      const n = Math.round(num(v, 'yearsLeft') * 12);
      const base = amortize(num(v, 'balance'), r, n);
      const faster = amortize(num(v, 'balance'), r, n, num(v, 'extra'));
      return {
        outputs: [
          { label: 'Interest saved', value: sumInterest(base) - sumInterest(faster), format: 'money', emphasis: true },
          { label: 'Paid off sooner by', value: (base.length - faster.length) / 12, format: 'years' },
          { label: 'New payoff time', value: faster.length / 12, format: 'years' },
        ],
      };
    },
  },

  'refinance-break-even': {
    inputs: [
      { id: 'balance', label: 'Current loan balance', kind: 'money', default: 250000, min: 0 },
      { id: 'currentRate', label: 'Current rate', kind: 'percent', default: 7.25, min: 0, max: 20, step: 0.01 },
      { id: 'yearsLeft', label: 'Years left on current loan', kind: 'number', default: 27, min: 1, max: 40 },
      { id: 'newRate', label: 'New rate', kind: 'percent', default: 6, min: 0, max: 20, step: 0.01 },
      { id: 'newYears', label: 'New loan term (years)', kind: 'number', default: 30, min: 1, max: 40 },
      { id: 'costs', label: 'Closing costs', kind: 'money', default: 5000, min: 0 },
    ],
    compute(v) {
      const current = loanPayment(num(v, 'balance'), pct(v, 'currentRate') / 12, Math.round(num(v, 'yearsLeft') * 12));
      const next = loanPayment(num(v, 'balance'), pct(v, 'newRate') / 12, Math.round(num(v, 'newYears') * 12));
      const savings = current - next;
      return {
        outputs: [
          { label: 'Current payment (principal and interest)', value: current, format: 'money' },
          { label: 'New payment', value: next, format: 'money' },
          { label: 'Monthly savings', value: savings, format: 'money' },
          { label: 'Months to break even on closing costs', value: savings > 0 ? Math.ceil(num(v, 'costs') / savings) : 'No monthly savings', format: savings > 0 ? 'months' : 'text', emphasis: true },
        ],
        notes: ['A longer new term can lower the payment but raise total interest. Compare total costs too.'],
      };
    },
  },

  'mortgage-15-vs-30': {
    inputs: [
      { id: 'loan', label: 'Loan amount', kind: 'money', default: 250000, min: 0 },
      { id: 'rate15', label: '15-year rate', kind: 'percent', default: 5.75, min: 0, max: 20, step: 0.01 },
      { id: 'rate30', label: '30-year rate', kind: 'percent', default: 6.5, min: 0, max: 20, step: 0.01 },
    ],
    compute(v) {
      const p15 = loanPayment(num(v, 'loan'), pct(v, 'rate15') / 12, 180);
      const p30 = loanPayment(num(v, 'loan'), pct(v, 'rate30') / 12, 360);
      const i15 = p15 * 180 - num(v, 'loan');
      const i30 = p30 * 360 - num(v, 'loan');
      return {
        outputs: [
          { label: '15-year monthly payment', value: p15, format: 'money' },
          { label: '30-year monthly payment', value: p30, format: 'money' },
          { label: '15-year total interest', value: i15, format: 'money' },
          { label: '30-year total interest', value: i30, format: 'money' },
          { label: 'Interest saved with 15 years', value: i30 - i15, format: 'money', emphasis: true },
        ],
      };
    },
  },

  /* ---------------- Loans and auto ---------------- */
  'loan-payment': loanCalc({ amount: 20000, rate: 8, years: 5 }),
  'auto-loan': loanCalc({ amount: 30000, rate: 7, years: 5 }, 'Amount financed (price minus down payment and trade-in)'),
  'student-loan-payment': loanCalc({ amount: 30000, rate: 6, years: 10 }, 'Student loan balance'),

  'loan-comparison': {
    inputs: [
      { id: 'amount', label: 'Loan amount', kind: 'money', default: 25000, min: 0 },
      { id: 'rateA', label: 'Loan A rate', kind: 'percent', default: 7, min: 0, max: 40, step: 0.01 },
      { id: 'yearsA', label: 'Loan A term (years)', kind: 'number', default: 5, min: 0.5, max: 40 },
      { id: 'rateB', label: 'Loan B rate', kind: 'percent', default: 6, min: 0, max: 40, step: 0.01 },
      { id: 'yearsB', label: 'Loan B term (years)', kind: 'number', default: 7, min: 0.5, max: 40 },
    ],
    compute(v) {
      const a = loanPayment(num(v, 'amount'), pct(v, 'rateA') / 12, Math.round(num(v, 'yearsA') * 12));
      const b = loanPayment(num(v, 'amount'), pct(v, 'rateB') / 12, Math.round(num(v, 'yearsB') * 12));
      const ia = a * Math.round(num(v, 'yearsA') * 12) - num(v, 'amount');
      const ib = b * Math.round(num(v, 'yearsB') * 12) - num(v, 'amount');
      return {
        outputs: [
          { label: 'Loan A monthly payment', value: a, format: 'money' },
          { label: 'Loan B monthly payment', value: b, format: 'money' },
          { label: 'Loan A total interest', value: ia, format: 'money' },
          { label: 'Loan B total interest', value: ib, format: 'money' },
          { label: 'Cheaper overall', value: ia <= ib ? 'Loan A' : 'Loan B', format: 'text', emphasis: true },
        ],
      };
    },
  },

  'fuel-cost': {
    inputs: [
      { id: 'miles', label: 'Miles driven per year', kind: 'number', default: 12000, min: 0 },
      { id: 'mpg', label: 'Miles per gallon', kind: 'number', default: 28, min: 1 },
      { id: 'price', label: 'Price per gallon', kind: 'money', default: 3.25, min: 0, step: 0.01 },
    ],
    compute(v) {
      const yearly = (num(v, 'miles') / Math.max(1, num(v, 'mpg'))) * num(v, 'price');
      return {
        outputs: [
          { label: 'Fuel cost per year', value: yearly, format: 'money', emphasis: true },
          { label: 'Fuel cost per month', value: yearly / 12, format: 'money' },
          { label: 'Cost per mile', value: num(v, 'miles') > 0 ? yearly / num(v, 'miles') : 0, format: 'money' },
        ],
      };
    },
  },

  /* ---------------- Credit cards ---------------- */
  'credit-card-payoff': {
    inputs: [
      { id: 'balance', label: 'Card balance', kind: 'money', default: 5000, min: 0 },
      { id: 'apr', label: 'APR', kind: 'percent', default: 22, min: 0, max: 40, step: 0.01 },
      { id: 'payment', label: 'Monthly payment', kind: 'money', default: 200, min: 0 },
    ],
    compute(v) {
      const r = pct(v, 'apr') / 12;
      const months = periodsToPayOff(num(v, 'balance'), r, num(v, 'payment'));
      if (months === null) {
        return { outputs: [{ label: 'Payoff time', value: 'This payment doesn’t cover the monthly interest, so the balance will never be paid off.', format: 'text', emphasis: true }] };
      }
      let bal = num(v, 'balance');
      let interest = 0;
      for (let i = 0; i < months; i++) {
        const int = bal * r;
        interest += int;
        bal = Math.max(0, bal + int - num(v, 'payment'));
      }
      return {
        outputs: [
          { label: 'Months to pay off', value: months, format: 'months', emphasis: true },
          { label: 'Total interest', value: interest, format: 'money' },
        ],
        notes: ['Assumes no new charges.'],
      };
    },
  },

  'credit-card-payoff-by-date': {
    inputs: [
      { id: 'balance', label: 'Card balance', kind: 'money', default: 5000, min: 0 },
      { id: 'apr', label: 'APR', kind: 'percent', default: 22, min: 0, max: 40, step: 0.01 },
      { id: 'months', label: 'Months to be debt-free', kind: 'integer', default: 24, min: 1, max: 360 },
    ],
    compute(v) {
      const n = Math.floor(num(v, 'months'));
      const pay = loanPayment(num(v, 'balance'), pct(v, 'apr') / 12, n);
      return {
        outputs: [
          { label: 'Monthly payment needed', value: pay, format: 'money', emphasis: true },
          { label: 'Total interest', value: pay * n - num(v, 'balance'), format: 'money' },
        ],
      };
    },
  },

  'minimum-payment-cost': {
    inputs: [
      { id: 'balance', label: 'Card balance', kind: 'money', default: 5000, min: 0 },
      { id: 'apr', label: 'APR', kind: 'percent', default: 22, min: 0, max: 40, step: 0.01 },
      { id: 'minPct', label: 'Minimum payment (% of balance)', kind: 'percent', default: 2, min: 0.5, max: 10, step: 0.1 },
      { id: 'minFloor', label: 'Minimum payment floor', kind: 'money', default: 25, min: 1 },
    ],
    compute(v) {
      const r = pct(v, 'apr') / 12;
      let bal = num(v, 'balance');
      let months = 0;
      let interest = 0;
      while (bal > 0.005 && months < 1200) {
        const int = bal * r;
        const pay = Math.min(bal + int, Math.max(num(v, 'minFloor'), bal * pct(v, 'minPct') + 0));
        if (pay <= int) return { outputs: [{ label: 'Result', value: 'The minimum payment doesn’t cover interest at these settings.', format: 'text', emphasis: true }] };
        interest += int;
        bal = bal + int - pay;
        months++;
      }
      return {
        outputs: [
          { label: 'Time to pay off with minimum payments', value: months / 12, format: 'years', emphasis: true },
          { label: 'Total interest paid', value: interest, format: 'money' },
        ],
        notes: ['Card issuers calculate minimums differently; check your statement for your card’s formula.'],
      };
    },
  },

  /* ---------------- Paycheck ---------------- */
  'hourly-to-salary': {
    inputs: [
      { id: 'hourly', label: 'Hourly wage', kind: 'money', default: 22, min: 0, step: 0.01 },
      { id: 'hours', label: 'Hours per week', kind: 'number', default: 40, min: 0, max: 100 },
      { id: 'weeks', label: 'Paid weeks per year', kind: 'number', default: 52, min: 1, max: 52 },
    ],
    compute(v) {
      const yearly = num(v, 'hourly') * num(v, 'hours') * num(v, 'weeks');
      return {
        outputs: [
          { label: 'Yearly pay', value: yearly, format: 'money', emphasis: true },
          { label: 'Monthly pay', value: yearly / 12, format: 'money' },
          { label: 'Every two weeks', value: yearly / 26, format: 'money' },
          { label: 'Weekly pay', value: yearly / 52, format: 'money' },
        ],
      };
    },
  },

  'overtime-pay': {
    inputs: [
      { id: 'hourly', label: 'Regular hourly wage', kind: 'money', default: 20, min: 0, step: 0.01 },
      { id: 'regular', label: 'Regular hours this week', kind: 'number', default: 40, min: 0 },
      { id: 'overtime', label: 'Overtime hours this week', kind: 'number', default: 6, min: 0 },
      { id: 'multiplier', label: 'Overtime multiplier', kind: 'number', default: 1.5, min: 1, max: 3, step: 0.1 },
    ],
    compute(v) {
      const regular = num(v, 'hourly') * num(v, 'regular');
      const ot = num(v, 'hourly') * num(v, 'multiplier') * num(v, 'overtime');
      return {
        outputs: [
          { label: 'Regular pay', value: regular, format: 'money' },
          { label: 'Overtime pay', value: ot, format: 'money' },
          { label: 'Gross pay for the week', value: regular + ot, format: 'money', emphasis: true },
        ],
      };
    },
  },

  'pay-frequency-converter': {
    inputs: [
      { id: 'amount', label: 'Pay amount', kind: 'money', default: 2000, min: 0 },
      { id: 'from', label: 'That amount is paid', kind: 'select', default: '26', options: [{ value: '52', label: 'Weekly' }, { value: '26', label: 'Every two weeks' }, { value: '24', label: 'Twice a month' }, { value: '12', label: 'Monthly' }, { value: '1', label: 'Yearly' }] },
    ],
    compute(v) {
      const yearly = num(v, 'amount') * Number(str(v, 'from'));
      return {
        outputs: [
          { label: 'Yearly', value: yearly, format: 'money', emphasis: true },
          { label: 'Monthly', value: yearly / 12, format: 'money' },
          { label: 'Twice a month', value: yearly / 24, format: 'money' },
          { label: 'Every two weeks', value: yearly / 26, format: 'money' },
          { label: 'Weekly', value: yearly / 52, format: 'money' },
        ],
      };
    },
  },

  'fica-tax': {
    inputs: [FILING_STATUS_INPUT, { id: 'wages', label: 'Yearly wages', kind: 'money', default: 60000, min: 0 }],
    compute(v) {
      const r = employeeFica(num(v, 'wages'), str(v, 'status') as FilingStatus);
      return {
        outputs: [
          { label: 'Social Security (6.2% up to the wage base)', value: r.socialSecurity, format: 'money' },
          { label: 'Medicare (1.45%)', value: r.medicare, format: 'money' },
          { label: 'Additional Medicare (0.9% over the threshold)', value: r.additionalMedicare, format: 'money' },
          { label: 'Your total FICA tax', value: r.total, format: 'money', emphasis: true },
        ],
        notes: [`The 2026 Social Security wage base is $${fed.payroll.socialSecurityWageBase.toLocaleString('en-US')}. Your employer pays a matching amount (except the additional Medicare tax).`],
      };
    },
  },

  /* ---------------- Retirement ---------------- */
  '401k-growth': {
    inputs: [
      { id: 'salary', label: 'Yearly salary', kind: 'money', default: 60000, min: 0 },
      { id: 'contribution', label: 'Your contribution', kind: 'percent', default: 6, min: 0, max: 100, step: 0.5 },
      { id: 'match', label: 'Employer match rate', kind: 'percent', default: 50, min: 0, max: 200, help: 'For example, 50 means 50 cents per dollar you contribute.' },
      { id: 'matchLimit', label: 'Match applies up to (% of salary)', kind: 'percent', default: 6, min: 0, max: 100, step: 0.5 },
      { id: 'balance', label: 'Current balance', kind: 'money', default: 15000, min: 0 },
      { id: 'return', label: 'Expected annual return', kind: 'percent', default: 6, min: 0, max: 15, step: 0.1 },
      { id: 'years', label: 'Years until retirement', kind: 'integer', default: 30, min: 1, max: 50 },
    ],
    compute(v) {
      const yours = Math.min(num(v, 'salary') * pct(v, 'contribution'), fed.retirement.employeeDeferral401k);
      const employer = Math.min(num(v, 'salary') * pct(v, 'contribution'), num(v, 'salary') * pct(v, 'matchLimit')) * pct(v, 'match');
      const yearly = yours + employer;
      const end = futureValue(num(v, 'balance'), yearly / 12, pct(v, 'return') / 12, num(v, 'years') * 12);
      return {
        outputs: [
          { label: 'Your yearly contribution', value: yours, format: 'money' },
          { label: 'Employer match per year', value: employer, format: 'money' },
          { label: 'Estimated balance at retirement', value: end, format: 'money', emphasis: true },
        ],
        notes: [`Your contribution is capped at the 2026 limit of $${fed.retirement.employeeDeferral401k.toLocaleString('en-US')}. Salary is assumed to stay the same, and amounts aren’t adjusted for inflation.`],
      };
    },
  },

  'contribution-limits': {
    inputs: [
      { id: 'age', label: 'Your age at the end of 2026', kind: 'integer', default: 45, min: 18, max: 100 },
      { id: 'plan', label: 'Account', kind: 'select', default: '401k', options: [{ value: '401k', label: '401(k), 403(b), governmental 457 or TSP' }, { value: 'ira', label: 'Traditional or Roth IRA' }, { value: 'simple', label: 'SIMPLE IRA' }] },
    ],
    compute(v) {
      const r = fed.retirement;
      const age = num(v, 'age');
      const plan = str(v, 'plan');
      let base = 0;
      let catchUp = 0;
      if (plan === '401k') {
        base = r.employeeDeferral401k;
        catchUp = age >= 60 && age <= 63 ? r.catchUp401kAge60to63 : age >= 50 ? r.catchUp401kAge50 : 0;
      } else if (plan === 'ira') {
        base = r.ira;
        catchUp = age >= 50 ? r.iraCatchUpAge50 : 0;
      } else {
        base = r.simple;
        catchUp = age >= 60 && age <= 63 ? r.simpleCatchUpAge60to63 : age >= 50 ? r.simpleCatchUpAge50 : 0;
      }
      return {
        outputs: [
          { label: 'Regular limit', value: base, format: 'money' },
          { label: 'Catch-up for your age', value: catchUp, format: 'money' },
          { label: 'Your 2026 limit', value: base + catchUp, format: 'money', emphasis: true },
        ],
        notes: ['IRA deductions and Roth eligibility also depend on income. Some plans have their own lower limits.'],
      };
    },
  },

  'retirement-savings-goal': {
    inputs: [
      { id: 'income', label: 'Yearly income you want in retirement (today’s dollars)', kind: 'money', default: 50000, min: 0 },
      { id: 'otherIncome', label: 'Expected Social Security and pensions per year', kind: 'money', default: 24000, min: 0 },
      { id: 'withdrawal', label: 'Safe withdrawal rate', kind: 'percent', default: 4, min: 1, max: 10, step: 0.1 },
      { id: 'saved', label: 'Already saved', kind: 'money', default: 50000, min: 0 },
      { id: 'years', label: 'Years until retirement', kind: 'integer', default: 25, min: 1, max: 50 },
      { id: 'return', label: 'Expected annual return', kind: 'percent', default: 6, min: 0, max: 15, step: 0.1 },
    ],
    compute(v) {
      const gap = Math.max(0, num(v, 'income') - num(v, 'otherIncome'));
      const target = pct(v, 'withdrawal') > 0 ? gap / pct(v, 'withdrawal') : 0;
      const monthly = paymentForGoal(target, num(v, 'saved'), pct(v, 'return') / 12, num(v, 'years') * 12);
      return {
        outputs: [
          { label: 'Savings needed at retirement', value: target, format: 'money' },
          { label: 'Save each month to get there', value: monthly, format: 'money', emphasis: true },
        ],
        notes: ['A rough planning number in today’s dollars. Taxes, inflation and investment results will change it.'],
      };
    },
  },

  /* ---------------- Investment ---------------- */
  'investment-growth': {
    inputs: [
      { id: 'start', label: 'Starting investment', kind: 'money', default: 10000, min: 0 },
      { id: 'monthly', label: 'Monthly addition', kind: 'money', default: 300, min: 0 },
      { id: 'return', label: 'Expected annual return', kind: 'percent', default: 7, min: 0, max: 20, step: 0.1 },
      { id: 'years', label: 'Years', kind: 'integer', default: 20, min: 1, max: 60 },
      { id: 'inflation', label: 'Inflation', kind: 'percent', default: 3, min: 0, max: 15, step: 0.1 },
    ],
    compute(v) {
      const n = num(v, 'years') * 12;
      const end = futureValue(num(v, 'start'), num(v, 'monthly'), pct(v, 'return') / 12, n);
      const real = end / Math.pow(1 + pct(v, 'inflation'), num(v, 'years'));
      return {
        outputs: [
          { label: 'Projected value', value: end, format: 'money', emphasis: true },
          { label: 'In today’s dollars', value: real, format: 'money' },
          { label: 'Total contributed', value: num(v, 'start') + num(v, 'monthly') * n, format: 'money' },
        ],
        notes: ['Investment returns aren’t guaranteed and vary from year to year.'],
      };
    },
  },

  'annualized-return': {
    inputs: [
      { id: 'startValue', label: 'Starting value', kind: 'money', default: 10000, min: 0 },
      { id: 'endValue', label: 'Ending value', kind: 'money', default: 16000, min: 0 },
      { id: 'years', label: 'Years', kind: 'number', default: 5, min: 0.1 },
    ],
    compute(v) {
      return {
        outputs: [
          { label: 'Total return', value: num(v, 'startValue') > 0 ? num(v, 'endValue') / num(v, 'startValue') - 1 : 0, format: 'percent' },
          { label: 'Annualized return (CAGR)', value: cagr(num(v, 'startValue'), num(v, 'endValue'), num(v, 'years')), format: 'percent', emphasis: true },
        ],
      };
    },
  },

  'expense-ratio-cost': {
    inputs: [
      { id: 'amount', label: 'Amount invested', kind: 'money', default: 50000, min: 0 },
      { id: 'return', label: 'Annual return before fees', kind: 'percent', default: 7, min: 0, max: 20, step: 0.1 },
      { id: 'feeA', label: 'Fund A expense ratio', kind: 'percent', default: 0.05, min: 0, max: 3, step: 0.01 },
      { id: 'feeB', label: 'Fund B expense ratio', kind: 'percent', default: 1, min: 0, max: 3, step: 0.01 },
      { id: 'years', label: 'Years', kind: 'integer', default: 25, min: 1, max: 60 },
    ],
    compute(v) {
      const a = compound(num(v, 'amount'), pct(v, 'return') - pct(v, 'feeA'), 1, num(v, 'years'));
      const b = compound(num(v, 'amount'), pct(v, 'return') - pct(v, 'feeB'), 1, num(v, 'years'));
      return {
        outputs: [
          { label: 'Fund A ending value', value: a, format: 'money' },
          { label: 'Fund B ending value', value: b, format: 'money' },
          { label: 'Cost of the higher fee', value: Math.abs(a - b), format: 'money', emphasis: true },
        ],
      };
    },
  },

  /* ---------------- Kids and young adults ---------------- */
  'budget-50-30-20': {
    inputs: [{ id: 'takeHome', label: 'Monthly take-home pay', kind: 'money', default: 3000, min: 0 }],
    compute(v) {
      const t = num(v, 'takeHome');
      return {
        outputs: [
          { label: 'Needs (50%): rent, food, bills', value: t * 0.5, format: 'money' },
          { label: 'Wants (30%): fun, eating out, hobbies', value: t * 0.3, format: 'money' },
          { label: 'Savings and debt payoff (20%)', value: t * 0.2, format: 'money', emphasis: true },
        ],
        notes: ['A simple starting point. Adjust the split to fit your life.'],
      };
    },
  },

  'cost-of-a-habit': {
    inputs: [
      { id: 'cost', label: 'Cost each time', kind: 'money', default: 6, min: 0, step: 0.01 },
      { id: 'perWeek', label: 'Times per week', kind: 'number', default: 5, min: 0 },
      { id: 'return', label: 'If invested instead, annual return', kind: 'percent', default: 6, min: 0, max: 15, step: 0.1 },
      { id: 'years', label: 'Years', kind: 'integer', default: 10, min: 1, max: 60 },
    ],
    compute(v) {
      const monthly = (num(v, 'cost') * num(v, 'perWeek') * 52) / 12;
      return {
        outputs: [
          { label: 'Cost per year', value: monthly * 12, format: 'money' },
          { label: `Cost over ${num(v, 'years')} years`, value: monthly * 12 * num(v, 'years'), format: 'money' },
          { label: 'If invested instead', value: futureValue(0, monthly, pct(v, 'return') / 12, num(v, 'years') * 12), format: 'money', emphasis: true },
        ],
      };
    },
  },

  'kids-savings-goal': {
    inputs: [
      { id: 'goal', label: 'What does it cost?', kind: 'money', default: 300, min: 0 },
      { id: 'saved', label: 'Already saved', kind: 'money', default: 40, min: 0 },
      { id: 'weekly', label: 'Can save each week', kind: 'money', default: 10, min: 0 },
    ],
    compute(v) {
      const weeks = periodsToGoal(num(v, 'goal'), num(v, 'saved'), num(v, 'weekly'), 0);
      return {
        outputs: [
          { label: 'Weeks to reach your goal', value: weeks ?? 'Add a weekly amount', format: weeks === null ? 'text' : 'number', emphasis: true },
          { label: 'Still to save', value: Math.max(0, num(v, 'goal') - num(v, 'saved')), format: 'money' },
        ],
      };
    },
  },
};
