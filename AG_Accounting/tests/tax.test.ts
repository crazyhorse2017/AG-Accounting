import { dueDates, fed, federalBracketChecks } from '../src/content/taxYear.ts';
import type { FilingStatus } from '../src/content/taxYear.ts';
import {
  childTaxCredit,
  earnedIncomeCredit,
  employeeFica,
  federalIncomeTax,
  marginalRate,
  mileageDeduction,
  ohioIncomeTax,
  progressiveTax,
  selfEmploymentTax,
  standardDeduction,
  taxableSocialSecurity,
  taxWithCapitalGains,
} from '../src/lib/tax.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

const STATUSES: FilingStatus[] = ['single', 'mfj', 'mfs', 'hoh'];

export const tests = [
  {
    name: 'bracket tables reproduce the tax amounts printed in Rev. Proc. 2025-32',
    run() {
      for (const s of STATUSES) {
        const tops = fed.brackets[s].filter((b) => b.upTo !== null).map((b) => b.upTo as number);
        const expected = federalBracketChecks[s];
        assert(tops.length === expected.length, `${s}: bracket count`);
        tops.forEach((top, i) => assert(near(federalIncomeTax(top, s), expected[i]), `${s} at ${top}: got ${federalIncomeTax(top, s)}, IRS ${expected[i]}`));
      }
    },
  },
  {
    name: 'brackets are ascending and end with an open top bracket',
    run() {
      for (const s of STATUSES) {
        const b = fed.brackets[s];
        assert(b[b.length - 1].upTo === null && b[b.length - 1].rate === 0.37, `${s}: last bracket`);
        for (let i = 1; i < b.length - 1; i++) assert((b[i].upTo as number) > (b[i - 1].upTo as number), `${s}: ascending`);
      }
    },
  },
  {
    name: 'progressive tax basics',
    run() {
      assert(progressiveTax(0, fed.brackets.single) === 0, 'zero income');
      assert(progressiveTax(-500, fed.brackets.single) === 0, 'negative income');
      assert(near(federalIncomeTax(60000, 'single'), 5800 + 0.22 * (60000 - 50400)), 'single 60k');
      assert(marginalRate(60000, fed.brackets.single) === 0.22, 'marginal 22%');
      assert(marginalRate(1e7, fed.brackets.mfj) === 0.37, 'top marginal');
    },
  },
  {
    name: 'standard deduction with age/blind additions',
    run() {
      assert(standardDeduction('single') === 16100, 'single');
      assert(standardDeduction('mfj', 2) === 32200 + 2 * 1650, 'mfj two 65+');
      assert(standardDeduction('hoh', 1) === 24150 + 2050, 'hoh one 65+');
    },
  },
  {
    name: 'capital gains stack on top of ordinary income',
    run() {
      // Single, $40,000 ordinary + $20,000 LT gain: 9,450 at 0% (up to 49,450), 10,550 at 15%.
      const r = taxWithCapitalGains(60000, 20000, 'single');
      assert(near(r.atZero, 9450) && near(r.atFifteen, 10550) && r.atTwenty === 0, JSON.stringify(r));
      assert(near(r.gainsTax, 10550 * 0.15), 'gains tax');
      const rich = taxWithCapitalGains(700000, 100000, 'single');
      assert(near(rich.atTwenty, 100000) && rich.atFifteen === 0 && rich.atZero === 0, 'all gains at 20% above 545,500');
    },
  },
  {
    name: 'self-employment tax',
    run() {
      const r = selfEmploymentTax(50000, 'single');
      assert(near(r.base, 46175), 'base 92.35%');
      assert(near(r.total, 46175 * 0.153), `total ${r.total}`);
      assert(near(r.deductibleHalf, (46175 * 0.153) / 2), 'half');
      assert(selfEmploymentTax(400, 'single').total === 0, 'under $400 of SE earnings');
      const capped = selfEmploymentTax(100000, 'single', 184500);
      assert(capped.socialSecurity === 0, 'wages already at wage base → no SS part');
    },
  },
  {
    name: 'employee FICA respects the wage base and additional Medicare',
    run() {
      const r = employeeFica(250000, 'single');
      assert(near(r.socialSecurity, 184500 * 0.062), 'SS capped');
      assert(near(r.additionalMedicare, 50000 * 0.009), 'additional Medicare over 200k');
    },
  },
  {
    name: 'child tax credit phase-out ($50 per $1,000 or part)',
    run() {
      assert(childTaxCredit(2, 100000, 'single').credit === 4400, 'full credit');
      assert(childTaxCredit(2, 200001, 'single').credit === 4350, 'first $50 step');
      assert(childTaxCredit(1, 500000, 'mfj').credit === 0, 'fully phased out');
      assert(childTaxCredit(3, 50000, 'mfj').refundableCap === 5100, 'refundable cap 3 × 1,700');
    },
  },
  {
    name: 'EITC reaches its maximum and phases out to zero',
    run() {
      for (const row of fed.eitc.byChildren) {
        const peak = earnedIncomeCredit(row.children, row.earnedIncomeAmount, row.earnedIncomeAmount, 'single').credit;
        assert(near(peak, row.maxCredit, 1), `${row.children} children max: ${peak}`);
        assert(earnedIncomeCredit(row.children, row.phaseoutEndOther, row.phaseoutEndOther, 'single').credit === 0, `${row.children} children end`);
        assert(earnedIncomeCredit(row.children, row.phaseoutEndJoint - 1, row.phaseoutEndJoint - 1, 'mfj').credit >= 0, 'joint positive');
      }
      assert(earnedIncomeCredit(1, 20000, 20000, 'mfs').credit === 0, 'MFS not eligible');
      assert(earnedIncomeCredit(1, 20000, 20000, 'single', 13000).credit === 0, 'investment income limit');
    },
  },
  {
    name: 'taxable Social Security follows the 50%/85% tiers',
    run() {
      assert(taxableSocialSecurity(20000, 10000, 0, 'single') === 0, 'below base');
      assert(near(taxableSocialSecurity(20000, 20000, 0, 'single'), 2500), 'first tier: (30,000-25,000)/2');
      assert(near(taxableSocialSecurity(30000, 100000, 0, 'single'), 25500), 'capped at 85%');
    },
  },
  {
    name: 'Ohio 2026 schedule',
    run() {
      assert(ohioIncomeTax(26050) === 0, 'zero bracket');
      assert(near(ohioIncomeTax(50000), 332 + 0.0275 * (50000 - 26050)), '50k');
    },
  },
  {
    name: 'mileage uses both 2026 rates',
    run() {
      const r = mileageDeduction([1000, 1000]);
      assert(near(r.total, 725 + 760), `total ${r.total}`);
    },
  },
  {
    name: 'due dates never fall on weekends and are in order',
    run() {
      let prev = '';
      for (const d of dueDates) {
        const [y, m, day] = d.date.split('-').map(Number);
        const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
        assert(dow !== 0 && dow !== 6, `${d.id} falls on a weekend`);
        assert(d.date >= prev, 'sorted');
        prev = d.date;
      }
    },
  },
];
