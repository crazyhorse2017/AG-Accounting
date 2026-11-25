import { CALCULATORS, registryProblems } from '../src/calculators/registry.ts';
import { defaultValues } from '../src/calculators/types.ts';
import { amortize, cagr, futureValue, loanPayment, paymentForGoal, periodsToPayOff } from '../src/lib/finance.ts';
import { TAX_DATA_IDS } from '../src/content/taxYear.ts';
import { isVisible, visibleItems } from '../src/content/status.ts';
import { matchRoute } from '../src/lib/routes.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

export const tests = [
  {
    name: 'every calculator has both metadata and a formula',
    run() {
      assert(registryProblems.missingImpl.length === 0, `no formula: ${registryProblems.missingImpl.join(', ')}`);
      assert(registryProblems.missingMeta.length === 0, `no metadata: ${registryProblems.missingMeta.join(', ')}`);
      assert(CALCULATORS.length >= 40, `M1 target is ~40 calculators, have ${CALCULATORS.length}`);
    },
  },
  {
    name: 'every calculator runs on its defaults and returns finite numbers',
    run() {
      for (const c of CALCULATORS) {
        const r = c.impl.compute(defaultValues(c.impl.inputs));
        assert(r.outputs.length > 0, `${c.id}: no outputs`);
        assert(r.outputs.some((o) => o.emphasis), `${c.id}: no highlighted result`);
        for (const o of r.outputs) {
          if (typeof o.value === 'number') assert(Number.isFinite(o.value), `${c.id}: "${o.label}" is ${o.value}`);
        }
      }
    },
  },
  {
    name: 'calculators survive zero and extreme inputs without crashing',
    run() {
      for (const c of CALCULATORS) {
        for (const pick of ['min', 'max'] as const) {
          const values = defaultValues(c.impl.inputs);
          for (const i of c.impl.inputs) if (i.kind !== 'select') values[i.id] = i[pick] ?? (pick === 'min' ? 0 : 1_000_000);
          const r = c.impl.compute(values);
          for (const o of r.outputs) {
            if (typeof o.value === 'number') assert(!Number.isNaN(o.value), `${c.id} (${pick}): "${o.label}" is NaN`);
          }
        }
      }
    },
  },
  {
    name: 'calculator dependencies point at real tax data',
    run() {
      for (const c of CALCULATORS) for (const id of c.dataIds) assert(TAX_DATA_IDS.includes(id), `${c.id} depends on unknown data ${id}`);
    },
  },
  {
    name: 'loan payment matches a known value',
    run() {
      // $240,000 at 6.5% for 30 years = $1,516.96 per month.
      assert(near(loanPayment(240000, 0.065 / 12, 360), 1516.96), String(loanPayment(240000, 0.065 / 12, 360)));
      assert(near(loanPayment(1200, 0, 12), 100), 'zero rate');
    },
  },
  {
    name: 'amortization pays off exactly and extra payments shorten it',
    run() {
      const rows = amortize(100000, 0.06 / 12, 360);
      assert(rows.length === 360 && near(rows[359].balance, 0), 'paid off in 360');
      const fast = amortize(100000, 0.06 / 12, 360, 100);
      assert(fast.length < 360, 'extra payments shorten');
    },
  },
  {
    name: 'future value, goal payment and payoff periods are consistent',
    run() {
      const fv = futureValue(1000, 100, 0.005, 120);
      const pay = paymentForGoal(fv, 1000, 0.005, 120);
      assert(near(pay, 100), `round trip ${pay}`);
      assert(periodsToPayOff(1000, 0.02, 15) === null, 'payment below interest never pays off');
      assert(periodsToPayOff(1200, 0, 100) === 12, 'zero rate payoff');
      assert(near(cagr(100, 200, 10), Math.pow(2, 0.1) - 1, 1e-9), 'CAGR');
    },
  },
  {
    name: 'router matches static and parameter routes',
    run() {
      assert(matchRoute('/')?.pattern === '/', 'home');
      assert(matchRoute('/Tax-Center/rates/')?.pattern === '/tax-center/rates', 'case and trailing slash');
      const m = matchRoute('/calculators/mortgage-payment');
      assert(m?.pattern === '/calculators/:slug' && m.params.slug === 'mortgage-payment', 'slug');
      assert(matchRoute('/calculators/bad slug') === null, 'bad slug');
      assert(matchRoute('/nope') === null, 'unknown');
    },
  },
  {
    name: 'drafts are hidden unless draft preview is on',
    run() {
      const items = [{ status: 'draft' }, { status: 'approved' }];
      assert(visibleItems(items, false).length === 1, 'hidden');
      assert(visibleItems(items, true).length === 2, 'preview');
      assert(isVisible({ status: 'approved' }, false), 'approved visible');
    },
  },
];
