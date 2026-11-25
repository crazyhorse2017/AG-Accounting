import { fed } from '../../content/taxYear.ts';
import { mileageDeduction } from '../../lib/tax.ts';
import { num, pct } from '../types.ts';
import type { CalculatorImpl } from '../types.ts';

export const businessCalculators: Record<string, CalculatorImpl> = {
  'break-even': {
    inputs: [
      { id: 'fixed', label: 'Fixed costs per month', kind: 'money', default: 5000, min: 0 },
      { id: 'price', label: 'Price per unit', kind: 'money', default: 50, min: 0 },
      { id: 'variable', label: 'Variable cost per unit', kind: 'money', default: 20, min: 0 },
    ],
    compute(v) {
      const margin = num(v, 'price') - num(v, 'variable');
      if (margin <= 0) return { outputs: [{ label: 'Break-even', value: 'Price must be higher than the variable cost per unit.', format: 'text', emphasis: true }] };
      const units = Math.ceil(num(v, 'fixed') / margin);
      return {
        outputs: [
          { label: 'Contribution margin per unit', value: margin, format: 'money' },
          { label: 'Units to break even each month', value: units, format: 'number', emphasis: true },
          { label: 'Sales to break even each month', value: units * num(v, 'price'), format: 'money' },
        ],
      };
    },
  },

  'profit-margin': {
    inputs: [
      { id: 'revenue', label: 'Revenue', kind: 'money', default: 100000, min: 0 },
      { id: 'cogs', label: 'Cost of goods sold', kind: 'money', default: 55000, min: 0 },
      { id: 'expenses', label: 'Operating expenses', kind: 'money', default: 25000, min: 0 },
    ],
    compute(v) {
      const revenue = num(v, 'revenue');
      const gross = revenue - num(v, 'cogs');
      const net = gross - num(v, 'expenses');
      return {
        outputs: [
          { label: 'Gross profit', value: gross, format: 'money' },
          { label: 'Gross margin', value: revenue > 0 ? gross / revenue : 0, format: 'percent' },
          { label: 'Net profit', value: net, format: 'money' },
          { label: 'Net margin', value: revenue > 0 ? net / revenue : 0, format: 'percent', emphasis: true },
        ],
      };
    },
  },

  'markup-vs-margin': {
    inputs: [
      { id: 'cost', label: 'Your cost', kind: 'money', default: 60, min: 0 },
      { id: 'price', label: 'Selling price', kind: 'money', default: 100, min: 0 },
    ],
    compute(v) {
      const cost = num(v, 'cost');
      const price = num(v, 'price');
      const profit = price - cost;
      return {
        outputs: [
          { label: 'Profit per sale', value: profit, format: 'money' },
          { label: 'Markup (profit ÷ cost)', value: cost > 0 ? profit / cost : 0, format: 'percent', emphasis: true },
          { label: 'Margin (profit ÷ price)', value: price > 0 ? profit / price : 0, format: 'percent', emphasis: true },
        ],
      };
    },
  },

  'mileage-deduction': {
    inputs: [
      { id: 'milesH1', label: 'Business miles driven January to June 2026', kind: 'number', default: 3000, min: 0 },
      { id: 'milesH2', label: 'Business miles driven July to December 2026', kind: 'number', default: 3000, min: 0 },
    ],
    compute(v) {
      const r = mileageDeduction([num(v, 'milesH1'), num(v, 'milesH2')]);
      const [a, b] = fed.mileage.businessCentsPerMile;
      return {
        outputs: [
          { label: `January to June (${a.cents}¢ per mile)`, value: r.parts[0].amount, format: 'money' },
          { label: `July to December (${b.cents}¢ per mile)`, value: r.parts[1].amount, format: 'money' },
          { label: 'Estimated mileage deduction', value: r.total, format: 'money', emphasis: true },
        ],
        notes: ['Keep a mileage log with dates, destinations and business purpose. Commuting miles don’t count.'],
      };
    },
  },

  'home-office-simplified': {
    inputs: [{ id: 'sqft', label: 'Square feet used regularly and only for business', kind: 'number', default: 200, min: 0 }],
    compute(v) {
      const o = fed.other;
      const sqft = Math.min(num(v, 'sqft'), o.homeOfficeSimplifiedMaxSqFt);
      return {
        outputs: [
          { label: 'Square feet counted', value: sqft, format: 'number' },
          { label: 'Simplified home office deduction', value: sqft * o.homeOfficeSimplifiedRatePerSqFt, format: 'money', emphasis: true },
        ],
        notes: [`The simplified method allows $${o.homeOfficeSimplifiedRatePerSqFt} per square foot, up to ${o.homeOfficeSimplifiedMaxSqFt} square feet, and can’t exceed your business’s gross income from that use.`],
      };
    },
  },

  'straight-line-depreciation': {
    inputs: [
      { id: 'cost', label: 'Cost of the asset', kind: 'money', default: 10000, min: 0 },
      { id: 'salvage', label: 'Salvage value', kind: 'money', default: 1000, min: 0 },
      { id: 'life', label: 'Useful life (years)', kind: 'integer', default: 5, min: 1, max: 50 },
    ],
    compute(v) {
      const life = Math.max(1, Math.floor(num(v, 'life')));
      const annual = Math.max(0, num(v, 'cost') - num(v, 'salvage')) / life;
      const rows: (number | string)[][] = [];
      let book = num(v, 'cost');
      for (let y = 1; y <= life; y++) {
        book -= annual;
        rows.push([y, annual, Math.max(0, book)]);
      }
      return {
        outputs: [{ label: 'Depreciation each year', value: annual, format: 'money', emphasis: true }],
        table: { caption: 'Depreciation schedule', columns: ['Year', 'Depreciation', 'Book value at year end'], formats: ['number', 'money', 'money'], rows },
        notes: ['This is book (straight-line) depreciation. Tax depreciation usually follows IRS MACRS rules and conventions instead.'],
      };
    },
  },

  'return-on-investment': {
    inputs: [
      { id: 'cost', label: 'Amount invested', kind: 'money', default: 10000, min: 0 },
      { id: 'gain', label: 'Total returned (including the original amount)', kind: 'money', default: 13500, min: 0 },
      { id: 'years', label: 'Years held', kind: 'number', default: 3, min: 0 },
    ],
    compute(v) {
      const cost = num(v, 'cost');
      const back = num(v, 'gain');
      const roi = cost > 0 ? (back - cost) / cost : 0;
      const years = num(v, 'years');
      return {
        outputs: [
          { label: 'Profit', value: back - cost, format: 'money' },
          { label: 'Return on investment', value: roi, format: 'percent', emphasis: true },
          { label: 'Annualized return', value: years > 0 && cost > 0 && back > 0 ? Math.pow(back / cost, 1 / years) - 1 : 0, format: 'percent' },
        ],
      };
    },
  },

  'employee-true-cost': {
    inputs: [
      { id: 'salary', label: 'Annual wages', kind: 'money', default: 45000, min: 0 },
      { id: 'benefits', label: 'Benefits per year (health, retirement match, etc.)', kind: 'money', default: 6000, min: 0 },
      { id: 'futaSuta', label: 'Unemployment taxes per year (federal and state)', kind: 'money', default: 500, min: 0 },
      { id: 'other', label: 'Other costs (equipment, training, insurance)', kind: 'money', default: 1500, min: 0 },
    ],
    compute(v) {
      const salary = num(v, 'salary');
      const p = fed.payroll;
      const employerFica = Math.min(salary, p.socialSecurityWageBase) * p.socialSecurityRate + salary * p.medicareRate;
      const total = salary + employerFica + num(v, 'benefits') + num(v, 'futaSuta') + num(v, 'other');
      return {
        outputs: [
          { label: 'Employer Social Security and Medicare', value: employerFica, format: 'money' },
          { label: 'Total yearly cost', value: total, format: 'money', emphasis: true },
          { label: 'Cost compared with wages', value: salary > 0 ? total / salary : 0, format: 'percent' },
          { label: 'Hourly cost (2,080 hours)', value: total / 2080, format: 'money' },
        ],
      };
    },
  },

  'inventory-turnover': {
    inputs: [
      { id: 'cogs', label: 'Cost of goods sold for the year', kind: 'money', default: 240000, min: 0 },
      { id: 'beginning', label: 'Inventory at the start of the year', kind: 'money', default: 40000, min: 0 },
      { id: 'ending', label: 'Inventory at the end of the year', kind: 'money', default: 50000, min: 0 },
    ],
    compute(v) {
      const avg = (num(v, 'beginning') + num(v, 'ending')) / 2;
      const turns = avg > 0 ? num(v, 'cogs') / avg : 0;
      return {
        outputs: [
          { label: 'Average inventory', value: avg, format: 'money' },
          { label: 'Inventory turnover', value: turns, format: 'number', emphasis: true },
          { label: 'Days to sell inventory', value: turns > 0 ? 365 / turns : 0, format: 'number' },
        ],
      };
    },
  },

  'cash-runway': {
    inputs: [
      { id: 'cash', label: 'Cash on hand', kind: 'money', default: 60000, min: 0 },
      { id: 'monthlyIn', label: 'Money coming in per month', kind: 'money', default: 15000, min: 0 },
      { id: 'monthlyOut', label: 'Money going out per month', kind: 'money', default: 20000, min: 0 },
      { id: 'growth', label: 'Expected monthly change in income', kind: 'percent', default: 0 },
    ],
    compute(v) {
      let cash = num(v, 'cash');
      let income = num(v, 'monthlyIn');
      const out = num(v, 'monthlyOut');
      const g = pct(v, 'growth');
      let months = 0;
      while (cash > 0 && months < 600) {
        const net = income - out;
        if (net >= 0 && g >= 0) return { outputs: [{ label: 'Runway', value: 'Cash isn’t running down at these numbers.', format: 'text', emphasis: true }] };
        cash += net;
        income *= 1 + g;
        months++;
      }
      return {
        outputs: [
          { label: 'Monthly burn today', value: Math.max(0, out - num(v, 'monthlyIn')), format: 'money' },
          { label: 'Months of runway', value: months, format: 'months', emphasis: true },
        ],
      };
    },
  },
};
