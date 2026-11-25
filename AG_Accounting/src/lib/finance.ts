/** General finance math for the calculators. Pure functions, unit-tested. */

/** Monthly (or per-period) payment for an amortizing loan. Rate is per period as a decimal. */
export function loanPayment(principal: number, ratePerPeriod: number, periods: number): number {
  if (periods <= 0) return 0;
  if (ratePerPeriod === 0) return principal / periods;
  const f = Math.pow(1 + ratePerPeriod, periods);
  return (principal * ratePerPeriod * f) / (f - 1);
}

export type AmortizationRow = { period: number; payment: number; interest: number; principal: number; balance: number };

/** Amortization schedule, with optional extra principal each period. Stops when paid off. */
export function amortize(principal: number, ratePerPeriod: number, periods: number, extraPerPeriod = 0): AmortizationRow[] {
  const basePayment = loanPayment(principal, ratePerPeriod, periods);
  const rows: AmortizationRow[] = [];
  let balance = principal;
  for (let period = 1; period <= periods * 2 && balance > 0.005; period++) {
    const interest = balance * ratePerPeriod;
    let toPrincipal = basePayment + extraPerPeriod - interest;
    if (toPrincipal <= 0) break; // payment doesn't cover interest
    if (toPrincipal > balance) toPrincipal = balance;
    balance -= toPrincipal;
    rows.push({ period, payment: interest + toPrincipal, interest, principal: toPrincipal, balance: Math.max(0, balance) });
  }
  return rows;
}

/** Sum rows into calendar-style years (12 periods each). */
export function yearlySummary(rows: readonly AmortizationRow[], periodsPerYear = 12) {
  const years: { year: number; paid: number; interest: number; principal: number; balance: number }[] = [];
  for (const r of rows) {
    const y = Math.ceil(r.period / periodsPerYear);
    let entry = years[y - 1];
    if (!entry) {
      entry = { year: y, paid: 0, interest: 0, principal: 0, balance: 0 };
      years[y - 1] = entry;
    }
    entry.paid += r.payment;
    entry.interest += r.interest;
    entry.principal += r.principal;
    entry.balance = r.balance;
  }
  return years;
}

/** Future value of a starting balance plus regular contributions (end of period). */
export function futureValue(start: number, contributionPerPeriod: number, ratePerPeriod: number, periods: number): number {
  if (ratePerPeriod === 0) return start + contributionPerPeriod * periods;
  const f = Math.pow(1 + ratePerPeriod, periods);
  return start * f + contributionPerPeriod * ((f - 1) / ratePerPeriod);
}

/** Contribution per period needed to reach a goal. */
export function paymentForGoal(goal: number, start: number, ratePerPeriod: number, periods: number): number {
  if (periods <= 0) return Math.max(0, goal - start);
  if (ratePerPeriod === 0) return Math.max(0, (goal - start) / periods);
  const f = Math.pow(1 + ratePerPeriod, periods);
  return Math.max(0, ((goal - start * f) * ratePerPeriod) / (f - 1));
}

/** Number of periods to pay off a balance with a fixed payment, or null if never. */
export function periodsToPayOff(balance: number, ratePerPeriod: number, payment: number): number | null {
  if (balance <= 0) return 0;
  if (payment <= balance * ratePerPeriod) return null;
  if (ratePerPeriod === 0) return Math.ceil(balance / payment);
  return Math.ceil(-Math.log(1 - (ratePerPeriod * balance) / payment) / Math.log(1 + ratePerPeriod));
}

/** Periods needed to reach a goal with regular contributions, or null if never (capped at 1200). */
export function periodsToGoal(goal: number, start: number, contribution: number, ratePerPeriod: number): number | null {
  let balance = start;
  for (let n = 0; n <= 1200; n++) {
    if (balance >= goal) return n;
    balance = balance * (1 + ratePerPeriod) + contribution;
  }
  return null;
}

/** Compound annual growth rate. */
export function cagr(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || endValue <= 0 || years <= 0) return 0;
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

/** Interest compounded n times per year, for a number of years. */
export function compound(principal: number, annualRate: number, timesPerYear: number, years: number): number {
  return principal * Math.pow(1 + annualRate / timesPerYear, timesPerYear * years);
}
