/**
 * Contact form API handler and retention cleanup.
 *
 * HARD RULE: never store or log card data, tax returns, SSNs or bank numbers.
 * Request bodies are never logged.
 */

import { isLikelyBot, validateContact } from '../shared/contact.ts';
import type { ContactInput, ContactSubmission } from '../shared/contact.ts';
import { CONTACT_RATE_LIMIT_PER_HOUR, CONTACT_RETENTION_DAYS } from '../shared/policy.ts';

export interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  /** Secret mixed into the rate-limit hash. Set with `wrangler secret put RATE_KEY_SALT`. */
  RATE_KEY_SALT?: string;
  /** Optional Brevo notification: API key (secret), recipient, and verified sender. */
  BREVO_API_KEY?: string;
  NOTIFY_TO?: string;
  NOTIFY_FROM?: string;
}

const MAX_BODY_BYTES = 10_000;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** One-way, salted, day-scoped key for rate limiting. The raw IP is never stored. */
export async function rateKey(ip: string, salt: string, now: Date): Promise<string> {
  const day = now.toISOString().slice(0, 10);
  return sha256Hex(`${salt}|${day}|${ip}`);
}

async function readJsonBody(request: Request): Promise<unknown | Response> {
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    return json({ ok: false, error: 'Unsupported content type.' }, 415);
  }
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return json({ ok: false, error: 'Message is too large.' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'Message is too large.' }, 413);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // Non-browser clients; the other checks still apply.
  return origin === new URL(request.url).origin;
}

async function notify(env: Env, submission: ContactSubmission): Promise<void> {
  if (!env.BREVO_API_KEY || !env.NOTIFY_TO || !env.NOTIFY_FROM) return;
  const lines = [
    `New message from the website contact form.`,
    ``,
    `Name: ${submission.name}`,
    `Email: ${submission.email}`,
    `Phone: ${submission.phone ?? '(not given)'}`,
    `Topic: ${submission.topic}`,
    `Prefers: ${submission.preferredContact}`,
    ``,
    submission.message,
  ];
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: env.NOTIFY_FROM, name: 'AG Accounting website' },
      to: [{ email: env.NOTIFY_TO }],
      replyTo: { email: submission.email, name: submission.name },
      subject: `Website message: ${submission.topic}`,
      textContent: lines.join('\n'),
    }),
  });
  if (!response.ok) console.error(`Contact notification failed with status ${response.status}`);
}

export async function handleContact(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  if (!sameOrigin(request)) return json({ ok: false, error: 'Forbidden.' }, 403);

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;
  if (typeof body !== 'object' || body === null) return json({ ok: false, error: 'Invalid request.' }, 400);
  const input = body as Partial<ContactInput>;

  const now = Date.now();
  // Bots get the same success reply as people, so they learn nothing.
  if (isLikelyBot({ website: String(input.website ?? ''), startedAt: Number(input.startedAt) }, now)) {
    return json({ ok: true });
  }

  const result = validateContact(input);
  if (!result.ok) return json({ ok: false, errors: result.errors, error: 'Please fix the highlighted fields.' }, 422);

  if (!env.DB) return json({ ok: false, error: 'The contact form isnâ€™t available yet. Please call or email us.' }, 503);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const key = await rateKey(ip, env.RATE_KEY_SALT ?? 'ag-accounting', new Date(now));

  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM contact_requests WHERE rate_key = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')`,
  )
    .bind(key)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= CONTACT_RATE_LIMIT_PER_HOUR) {
    return json({ ok: false, error: 'Youâ€™ve sent several messages recently. Please try again later or call us.' }, 429);
  }

  const v = result.value;
  await env.DB.prepare(
    `INSERT INTO contact_requests (name, email, phone, topic, preferred_contact, message, rate_key) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(v.name, v.email, v.phone, v.topic, v.preferredContact, v.message, key)
    .run();

  const sending = notify(env, v).catch(() => console.error('Contact notification threw an error'));
  if (ctx) ctx.waitUntil(sending);
  else await sending;

  return json({ ok: true });
}

export async function purgeOldContactRequests(db: D1Database): Promise<void> {
  await db
    .prepare(`DELETE FROM contact_requests WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)`)
    .bind(`-${CONTACT_RETENTION_DAYS} days`)
    .run();
}
