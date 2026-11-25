import { containsSensitiveNumber, isLikelyBot, LIMITS, SENSITIVE_DATA_MESSAGE, validateContact } from '../src/shared/contact.ts';
import { handleContact, rateKey } from '../src/worker/contact.ts';
import { telHref } from '../src/lib/format.ts';
import { draftItems } from '../src/content/site.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const valid = {
  name: 'Jane Client',
  email: 'Jane@Example.com',
  phone: '',
  topic: 'Individual taxes',
  preferredContact: 'email',
  message: 'I need help filing my return this year.',
  website: '',
  startedAt: Date.now() - 60_000,
};

/** Minimal in-memory stand-in for the D1 calls the handler makes. */
function fakeDb() {
  const rows: unknown[][] = [];
  const db = {
    rows,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              return { n: rows.filter((r) => r[6] === args[0]).length };
            },
            async run() {
              if (sql.trim().startsWith('INSERT')) rows.push(args);
              return { success: true };
            },
          };
        },
      };
    },
  };
  return db;
}

/**
 * A Request-like object. Browsers silently drop the Origin header on `new Request()`,
 * but a standalone `Headers` object keeps it, so the origin check can be tested.
 */
function post(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    method: 'POST',
    url: 'https://ag.example/api/contact',
    headers: new Headers({ 'Content-Type': 'application/json', Origin: 'https://ag.example', ...headers }),
    text: async () => text,
  } as unknown as Request;
}

export const tests = [
  {
    name: 'accepts a normal message and normalizes the email',
    run() {
      const r = validateContact(valid);
      assert(r.ok, 'expected valid');
      assert(r.ok && r.value.email === 'jane@example.com', 'email should be lowercased');
      assert(r.ok && r.value.phone === null, 'blank phone becomes null');
    },
  },
  {
    name: 'requires name, email, topic and message',
    run() {
      const r = validateContact({ ...valid, name: ' ', email: 'nope', topic: 'Lottery', message: 'hi' });
      assert(!r.ok, 'expected invalid');
      assert(!r.ok && r.errors.name && r.errors.email && r.errors.topic && r.errors.message, 'all four fields should error');
    },
  },
  {
    name: 'needs a phone number when phone contact is chosen',
    run() {
      const r = validateContact({ ...valid, preferredContact: 'phone' });
      assert(!r.ok && !!r.errors.phone, 'phone required for phone contact');
      assert(validateContact({ ...valid, preferredContact: 'phone', phone: '(216) 555-0100' }).ok, 'valid phone passes');
    },
  },
  {
    name: 'rejects messages containing an SSN',
    run() {
      for (const ssn of ['123-45-6789', '123 45 6789', 'my ssn is 123456789 ok']) {
        const r = validateContact({ ...valid, message: `Hello, ${ssn}, thanks` });
        assert(!r.ok && r.errors.message === SENSITIVE_DATA_MESSAGE, `should reject ${ssn}`);
      }
    },
  },
  {
    name: 'rejects messages containing a card number (Luhn valid)',
    run() {
      assert(containsSensitiveNumber('card 4111 1111 1111 1111 exp'), 'spaced test card');
      assert(containsSensitiveNumber('4111-1111-1111-1111'), 'dashed test card');
      assert(!containsSensitiveNumber('4111 1111 1111 1112'), 'non-Luhn number is not a card');
    },
  },
  {
    name: 'does not flag phone numbers, ZIP codes, years or amounts',
    run() {
      for (const text of ['Call 216-555-0100', 'ZIP 44124-1234', 'Tax years 2023 and 2024', 'I owe $1,250.00', '(440) 555 0199']) {
        assert(!containsSensitiveNumber(text), `false positive on "${text}"`);
      }
    },
  },
  {
    name: 'treats honeypot fills and instant submits as bots',
    run() {
      const now = Date.now();
      assert(isLikelyBot({ website: 'spam.example', startedAt: now - 60_000 }, now), 'honeypot');
      assert(isLikelyBot({ website: '', startedAt: now - 500 }, now), 'too fast');
      assert(!isLikelyBot({ website: '', startedAt: now - LIMITS.minFillMs - 1 }, now), 'normal user');
    },
  },
  {
    name: 'rate key is a one-way hash that changes by day',
    async run() {
      const a = await rateKey('203.0.113.7', 'salt', new Date('2026-11-25T12:00:00Z'));
      const b = await rateKey('203.0.113.7', 'salt', new Date('2026-11-26T12:00:00Z'));
      assert(/^[0-9a-f]{64}$/.test(a), 'hex sha-256');
      assert(!a.includes('203'), 'raw IP must not appear');
      assert(a !== b, 'key rotates daily');
    },
  },
  {
    name: 'worker stores a valid message',
    async run() {
      const db = fakeDb();
      const res = await handleContact(post(valid), { DB: db } as never);
      assert(res.status === 200, `status ${res.status}`);
      assert(db.rows.length === 1, 'one row inserted');
      assert(!JSON.stringify(db.rows[0]).includes('203.0.113'), 'no raw IP stored');
    },
  },
  {
    name: 'worker rejects SSNs without storing anything',
    async run() {
      const db = fakeDb();
      const res = await handleContact(post({ ...valid, message: 'My SSN is 123-45-6789' }), { DB: db } as never);
      assert(res.status === 422, `status ${res.status}`);
      assert(db.rows.length === 0, 'nothing stored');
    },
  },
  {
    name: 'worker silently drops bot submissions',
    async run() {
      const db = fakeDb();
      const res = await handleContact(post({ ...valid, website: 'http://spam' }), { DB: db } as never);
      assert(res.status === 200, 'bots get a normal-looking reply');
      assert(db.rows.length === 0, 'nothing stored');
    },
  },
  {
    name: 'worker enforces method, origin, content type and size',
    async run() {
      const env = { DB: fakeDb() } as never;
      assert((await handleContact(new Request('https://ag.example/api/contact'), env)).status === 405, 'GET blocked');
      assert((await handleContact(post(valid, { Origin: 'https://evil.example' }), env)).status === 403, 'cross-origin blocked');
      assert((await handleContact(post('name=x', { 'Content-Type': 'text/plain' }), env)).status === 415, 'non-JSON blocked');
      assert((await handleContact(post({ ...valid, message: 'x'.repeat(20_000) }), env)).status === 413, 'oversized blocked');
    },
  },
  {
    name: 'worker rate limits repeat senders',
    async run() {
      const db = fakeDb();
      const env = { DB: db } as never;
      for (let i = 0; i < 5; i++) assert((await handleContact(post(valid), env)).status === 200, `message ${i + 1} accepted`);
      assert((await handleContact(post(valid), env)).status === 429, 'sixth message limited');
    },
  },
  {
    name: 'worker reports unavailable when D1 is not bound',
    async run() {
      const res = await handleContact(post(valid), {} as never);
      assert(res.status === 503, `status ${res.status}`);
    },
  },
  {
    name: 'phone links use E.164 for US numbers',
    run() {
      assert(telHref('(216) 555-0100') === 'tel:+12165550100', telHref('(216) 555-0100'));
    },
  },
  {
    name: 'draft list flags unconfirmed content',
    run() {
      const items = draftItems();
      assert(items.includes('Office hours'), 'missing hours are flagged');
      assert(!items.includes('Phone number'), 'a filled-in phone is not flagged');
      assert(items.some((i) => i.startsWith('Service:')), 'unconfirmed services are flagged');
    },
  },
];
