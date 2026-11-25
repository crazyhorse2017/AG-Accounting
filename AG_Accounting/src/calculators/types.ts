/** The calculator engine: each calculator is a list of inputs and a pure compute function. */

export type InputKind = 'money' | 'percent' | 'number' | 'integer' | 'select';

export type InputDef = {
  id: string;
  label: string;
  kind: InputKind;
  /** Default value. Percent inputs are in percentage points (6.5 means 6.5%). */
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  help?: string;
};

export type OutputFormat = 'money' | 'percent' | 'number' | 'years' | 'months' | 'text';

export type Output = { label: string; value: number | string; format: OutputFormat; emphasis?: boolean };

export type ResultTable = { caption: string; columns: string[]; formats: OutputFormat[]; rows: (number | string)[][] };

export type CalcResult = { outputs: Output[]; table?: ResultTable; notes?: string[] };

export type Values = Record<string, number | string>;

export type CalculatorImpl = {
  inputs: InputDef[];
  compute: (v: Values) => CalcResult;
};

/** Helpers for reading values inside compute(). */
export const num = (v: Values, id: string): number => {
  const x = Number(v[id]);
  return Number.isFinite(x) ? x : 0;
};
export const pct = (v: Values, id: string): number => num(v, id) / 100;
export const str = (v: Values, id: string): string => String(v[id] ?? '');

export const FILING_STATUS_INPUT: InputDef = {
  id: 'status',
  label: 'Filing status',
  kind: 'select',
  default: 'single',
  options: [
    { value: 'single', label: 'Single' },
    { value: 'mfj', label: 'Married filing jointly' },
    { value: 'mfs', label: 'Married filing separately' },
    { value: 'hoh', label: 'Head of household' },
  ],
};

export function defaultValues(inputs: readonly InputDef[]): Values {
  return Object.fromEntries(inputs.map((i) => [i.id, i.default]));
}
