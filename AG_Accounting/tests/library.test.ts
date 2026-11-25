import { parseBlocks, parseFrontMatter, parseInline, toContentDoc } from '../src/lib/markdown.ts';
import { dayNumber, easternDate, onThisDay, pickForDay } from '../src/lib/daily.ts';
import { CALCULATOR_IMPLS } from '../src/calculators/registry.ts';
import { defaultValues } from '../src/calculators/types.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

function run(id: string, overrides: Record<string, number | string>) {
  const impl = CALCULATOR_IMPLS[id];
  return impl.compute({ ...defaultValues(impl.inputs), ...overrides });
}
const out = (r: ReturnType<typeof run>, label: string) => {
  const o = r.outputs.find((x) => x.label.startsWith(label));
  if (!o) throw new Error(`no output "${label}"`);
  return o.value;
};

const SAMPLE = `---
id: article-sample
title: Sample
slug: sample
category: personal-tax
summary: A test.
status: draft
reviewedOn:
source: IRS Publication 17 | https://www.irs.gov/publications/p17
source: IRS | https://www.irs.gov/
---
## Heading

First line
continues here with **bold** and *italic* and a [link](https://www.irs.gov/).

- one
- two

1. first
2. second

> A callout.

<script>alert(1)</script> stays text. [bad](javascript:alert(1))
`;

export const tests = [
  {
    name: 'front matter: fields and repeated sources',
    run() {
      const fm = parseFrontMatter(SAMPLE);
      assert(fm.meta.title === 'Sample' && fm.meta.status === 'draft', JSON.stringify(fm.meta));
      assert(fm.sources.length === 2 && fm.sources[0].url === 'https://www.irs.gov/publications/p17', 'sources');
      assert(fm.body.startsWith('## Heading'), 'body');
    },
  },
  {
    name: 'blocks: headings, joined paragraphs, lists, callouts',
    run() {
      const blocks = parseBlocks(parseFrontMatter(SAMPLE).body);
      const types = blocks.map((b) => b.type).join(',');
      assert(types === 'heading,paragraph,list,list,callout,paragraph', types);
      const ordered = blocks.filter((b) => b.type === 'list').map((b) => (b.type === 'list' ? b.ordered : null));
      assert(ordered[0] === false && ordered[1] === true, 'list kinds');
    },
  },
  {
    name: 'inline: bold, italic, safe links only, HTML stays text',
    run() {
      const nodes = parseInline('a **b** *c* [d](https://www.irs.gov/) [e](javascript:alert(1)) <b>x</b>');
      assert(nodes.some((n) => n.type === 'strong'), 'strong');
      assert(nodes.some((n) => n.type === 'em'), 'em');
      const links = nodes.filter((n) => n.type === 'link');
      assert(links.length === 1, 'only the https link becomes a link');
      const textOut = nodes.filter((n) => n.type === 'text').map((n) => (n.type === 'text' ? n.text : '')).join('');
      assert(textOut.includes('<b>x</b>') && textOut.includes('javascript:'), 'unsafe content stays as plain text');
    },
  },
  {
    name: 'content doc defaults to draft and counts words',
    run() {
      const doc = toContentDoc(SAMPLE, 'sample');
      assert(doc.status === 'draft' && doc.reviewedOn === null && doc.slug === 'sample', 'meta');
      assert(doc.wordCount > 10, `words ${doc.wordCount}`);
      assert(toContentDoc(SAMPLE.replace('status: draft', 'status: approved'), 'x').status === 'approved', 'approved');
      assert(toContentDoc(SAMPLE.replace('status: draft', 'status: yes'), 'x').status === 'draft', 'unknown status is draft');
    },
  },
  {
    name: 'daily rotation uses the Eastern date and covers every item',
    run() {
      // 2026-12-01 03:00 UTC is still November 30 in Ohio.
      const lateNight = new Date(Date.UTC(2026, 11, 1, 3, 0));
      const d = easternDate(lateNight);
      assert(d.month === 11 && d.day === 30, JSON.stringify(d));
      const items = Array.from({ length: 50 }, (_, i) => i);
      const seen = new Set<number>();
      for (let k = 0; k < 50; k++) seen.add(pickForDay(items, new Date(Date.UTC(2026, 0, 1 + k, 17)))!);
      assert(seen.size === 50, `50 days should show 50 different items, saw ${seen.size}`);
      assert(pickForDay([], new Date()) === null, 'empty list');
      assert(dayNumber(new Date(Date.UTC(2026, 0, 2, 17))) - dayNumber(new Date(Date.UTC(2026, 0, 1, 17))) === 1, 'day step');
    },
  },
  {
    name: 'this day in tax history matches MM-DD',
    run() {
      const facts = [{ monthDay: '04-15' }, { monthDay: '02-03' }, { monthDay: null }];
      const r = onThisDay(facts, new Date(Date.UTC(2027, 3, 15, 16)));
      assert(r.length === 1 && r[0].monthDay === '04-15', JSON.stringify(r));
    },
  },
  {
    name: 'RMD uses the Uniform Lifetime Table',
    run() {
      const r = run('required-minimum-distribution', { balance: 500000, age: 75, born1960: 'no' });
      assert(near(out(r, 'Required minimum distribution') as number, 500000 / 24.6), 'age 75 → 24.6');
      const notYet = run('required-minimum-distribution', { age: 74, born1960: 'yes' });
      assert(String(out(notYet, 'Required minimum distribution')).includes('75'), 'born 1960+ starts at 75');
    },
  },
  {
    name: 'Social Security claiming: 70% at 62, 124% at 70 (FRA 67)',
    run() {
      const r = run('social-security-claiming-age', { pia: 1000, lifeExpectancy: 90 });
      const rows = r.table!.rows;
      assert(near(rows[0][1] as number, 700, 0.1), `62: ${rows[0][1]}`);
      assert(near(rows[5][1] as number, 1000), '67');
      assert(near(rows[8][1] as number, 1240), '70');
    },
  },
  {
    name: 'points break-even and home sale exclusion',
    run() {
      const p = run('points-break-even', { loan: 300000, rateNoPoints: 6.75, rateWithPoints: 6.25, points: 2 });
      assert((out(p, 'Break-even') as number) > 50 && (out(p, 'Break-even') as number) < 70, `months ${out(p, 'Break-even')}`);
      const h = run('home-sale-gain-exclusion', { status: 'mfj', sale: 800000, sellingCosts: 40000, basis: 200000, improvements: 0, qualifies: 'yes' });
      assert(out(h, 'Taxable gain') === 60000, `taxable ${out(h, 'Taxable gain')}`);
    },
  },
  {
    name: 'snowball vs avalanche: avalanche never costs more interest',
    run() {
      const r = run('snowball-vs-avalanche', {});
      assert((out(r, 'Interest saved by avalanche') as number) >= -0.01, 'avalanche ≤ snowball');
    },
  },
];
