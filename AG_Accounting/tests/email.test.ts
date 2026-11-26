import { brevoListIds, validateNewsletter } from '../src/shared/newsletter.ts';
import { handleNewsletter } from '../src/worker/newsletter.ts';
import { newsletterKey, parseSender, runWeeklyEmails } from '../src/worker/emailJobs.ts';
import type { EmailBundle } from '../src/worker/emailJobs.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const LISTS = JSON.stringify({ newsletter: 3, tips: 4, 'drip-personal': 5, 'drip-business': 6, 'drip-niche': 7, 'drip-wise': 8 });

const goodSignup = {
  email: 'Pat@Example.com',
  firstName: 'Pat',
  subscriptions: ['newsletter', 'tips'],
  consent: true,
  website: '',
  startedAt: Date.now() - 60_000,
};

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = JSON.stringify(body);
  return {
    method: 'POST',
    url: 'https://ag.example/api/newsletter',
    headers: new Headers({ 'Content-Type': 'application/json', Origin: 'https://ag.example', ...headers }),
    text: async () => text,
  } as unknown as Request;
}

/** Fake D1 covering the queries the newsletter and email jobs use. */
function fakeDb() {
  const rate: string[] = [];
  const sends: { kind: string; item: string; mode: string }[] = [];
  return {
    rate,
    sends,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (sql.includes('FROM rate_events')) return { n: rate.filter((k) => k === args[0]).length };
              if (sql.includes('FROM email_sends')) return sends.some((s) => s.kind === args[0] && s.item === args[1]) ? { hit: 1 } : null;
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO rate_events')) rate.push(String(args[0]));
              if (sql.includes('INSERT INTO email_sends')) sends.push({ kind: String(args[0]), item: String(args[1]), mode: String(args[2]) });
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function fakeFetch() {
  const calls: { url: string; body: unknown }[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith('/emailCampaigns')) return new Response(JSON.stringify({ id: 42 }), { status: 201 });
    return new Response(null, { status: 204 });
  };
  return { calls, fn };
}

const ENV_BASE = { BREVO_API_KEY: 'test-key', BREVO_LIST_IDS: LISTS, BREVO_DOI_TEMPLATE_ID: '9', NEWSLETTER_FROM: 'AG Accounting <office@example.com>' };

const BUNDLE: EmailBundle = {
  tips: [
    { id: 'tip-01', subject: 'Tip one', preheader: 'p', html: '<p>1</p>' },
    { id: 'tip-02', subject: 'Tip two', preheader: 'p', html: '<p>2</p>' },
  ],
  newsletters: { '2027-02': { id: 'newsletter-2027-02', subject: 'Feb', preheader: 'p', html: '<p>n</p>' } },
};

export const tests = [
  {
    name: 'newsletter validation: consent and a known subscription are required',
    run() {
      const ok = validateNewsletter(goodSignup);
      assert(ok.ok && ok.value.email === 'pat@example.com', 'normalizes email');
      const noConsent = validateNewsletter({ ...goodSignup, consent: false });
      assert(!noConsent.ok && !!noConsent.errors.consent, 'consent required');
      const none = validateNewsletter({ ...goodSignup, subscriptions: [] });
      assert(!none.ok && !!none.errors.subscriptions, 'at least one subscription');
      const bogus = validateNewsletter({ ...goodSignup, subscriptions: ['newsletter', 'spam-list'] });
      assert(!bogus.ok, 'unknown subscription rejected');
      const link = validateNewsletter({ ...goodSignup, firstName: 'http://evil.example' });
      assert(!link.ok && !!link.errors.firstName, 'links in the name rejected');
    },
  },
  {
    name: 'subscriptions map to configured Brevo lists',
    run() {
      const ids = brevoListIds(['newsletter', 'drip-wise'], LISTS);
      assert(JSON.stringify(ids) === '[3,8]', JSON.stringify(ids));
      assert(brevoListIds(['tips'], undefined) === null, 'not configured');
      assert(brevoListIds(['tips'], '{"newsletter":3}') === null, 'missing list');
    },
  },
  {
    name: 'sign-up endpoint: double opt-in call with lists, template and redirect; nothing stored but a rate key',
    async run() {
      const db = fakeDb();
      const f = fakeFetch();
      const res = await handleNewsletter(post(goodSignup), { ...ENV_BASE, DB: db } as never, f.fn);
      assert(res.status === 200, `status ${res.status}`);
      assert(f.calls.length === 1 && f.calls[0].url.endsWith('/contacts/doubleOptinConfirmation'), 'one DOI call');
      const body = f.calls[0].body as { includeListIds: number[]; templateId: number; redirectionUrl: string; attributes: Record<string, string> };
      assert(JSON.stringify(body.includeListIds) === '[3,4]', 'lists');
      assert(body.templateId === 9 && body.redirectionUrl === 'https://ag.example/newsletter/confirmed', 'template and redirect');
      assert(body.attributes.FIRSTNAME === 'Pat', 'first name attribute');
      assert(db.rate.length === 1 && !db.rate[0].includes('example.com'), 'only a hashed rate key is stored');
    },
  },
  {
    name: 'sign-up endpoint: bots, missing config, bad input and rate limits',
    async run() {
      const f = fakeFetch();
      const bot = await handleNewsletter(post({ ...goodSignup, website: 'spam' }), { ...ENV_BASE, DB: fakeDb() } as never, f.fn);
      assert(bot.status === 200 && f.calls.length === 0, 'bots get a normal reply and nothing is sent');
      const off = await handleNewsletter(post(goodSignup), { DB: fakeDb() } as never, f.fn);
      assert(off.status === 503, 'not configured');
      const bad = await handleNewsletter(post({ ...goodSignup, consent: false }), { ...ENV_BASE, DB: fakeDb() } as never, f.fn);
      assert(bad.status === 422, 'validation');
      const cross = await handleNewsletter(post(goodSignup, { Origin: 'https://evil.example' }), { ...ENV_BASE, DB: fakeDb() } as never, f.fn);
      assert(cross.status === 403, 'cross-origin');
      const db = fakeDb();
      for (let i = 0; i < 5; i++) await handleNewsletter(post(goodSignup), { ...ENV_BASE, DB: db } as never, f.fn);
      const limited = await handleNewsletter(post(goodSignup), { ...ENV_BASE, DB: db } as never, f.fn);
      assert(limited.status === 429, `rate limit ${limited.status}`);
    },
  },
  {
    name: 'Tuesday job in draft mode creates a campaign but does not send',
    async run() {
      const db = fakeDb();
      const f = fakeFetch();
      const out = await runWeeklyEmails({ ...ENV_BASE, DB: db } as never, new Date(Date.UTC(2027, 1, 16, 14)), f.fn, BUNDLE);
      assert(out[0].itemId === 'tip-01' && out[0].status === 'draft created in Brevo', JSON.stringify(out));
      assert(!f.calls.some((c) => c.url.endsWith('/sendNow')), 'no send in draft mode');
      const created = f.calls[0].body as { recipients: { listIds: number[] }; sender: { email: string } };
      assert(JSON.stringify(created.recipients.listIds) === '[4]' && created.sender.email === 'office@example.com', 'tips list and sender');
      assert(out.length === 1, 'no newsletter after the first week of the month');
    },
  },
  {
    name: 'Tuesday job never repeats a tip, and sends in auto mode',
    async run() {
      const db = fakeDb();
      const f = fakeFetch();
      const env = { ...ENV_BASE, DB: db, SEND_MODE: 'auto' } as never;
      await runWeeklyEmails(env, new Date(Date.UTC(2027, 1, 16, 14)), f.fn, BUNDLE);
      const second = await runWeeklyEmails(env, new Date(Date.UTC(2027, 1, 23, 14)), f.fn, BUNDLE);
      assert(second[0].itemId === 'tip-02' && second[0].status === 'sent', JSON.stringify(second));
      assert(f.calls.filter((c) => c.url.endsWith('/sendNow')).length === 2, 'two sends');
      const third = await runWeeklyEmails(env, new Date(Date.UTC(2027, 2, 9, 14)), f.fn, BUNDLE);
      assert(third[0].status === 'nothing approved to send', JSON.stringify(third));
    },
  },
  {
    name: 'monthly newsletter goes out in the first week only, once',
    async run() {
      const db = fakeDb();
      const f = fakeFetch();
      const env = { ...ENV_BASE, DB: db } as never;
      const first = await runWeeklyEmails(env, new Date(Date.UTC(2027, 1, 2, 14)), f.fn, BUNDLE);
      assert(first.some((o) => o.kind === 'newsletter' && o.itemId === 'newsletter-2027-02'), JSON.stringify(first));
      const again = await runWeeklyEmails(env, new Date(Date.UTC(2027, 1, 2, 15)), f.fn, BUNDLE);
      assert(again.some((o) => o.kind === 'newsletter' && o.status === 'already handled'), 'not twice');
      assert(newsletterKey(new Date(Date.UTC(2027, 2, 1, 3))) === '2027-02', 'uses Ohio time (still Feb 28 there)');
    },
  },
  {
    name: 'jobs do nothing without email settings',
    async run() {
      const out = await runWeeklyEmails({ DB: fakeDb() } as never, new Date(), fakeFetch().fn, BUNDLE);
      assert(out[0].status === 'email not configured', JSON.stringify(out));
      assert(parseSender('AG Accounting <a@b.co>')?.email === 'a@b.co' && parseSender('nope') === null, 'sender parsing');
    },
  },
];
