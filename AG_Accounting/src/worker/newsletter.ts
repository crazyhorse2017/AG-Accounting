/**
 * POST /api/newsletter: newsletter sign-up through Brevo's double opt-in.
 *
 * The Worker never stores subscriber names or emails. It validates the request,
 * rate-limits by a one-way hashed key, and asks Brevo to send a confirmation email.
 * The person is only added to lists after they click the link in that email.
 */

import { isLikelyBot } from '../shared/contact.ts';
import { brevoListIds, validateNewsletter } from '../shared/newsletter.ts';
import type { NewsletterInput } from '../shared/newsletter.ts';
import { json, rateKey, readJsonBody, sameOrigin } from './contact.ts';
import type { Env } from './contact.ts';

export const NEWSLETTER_RATE_LIMIT_PER_HOUR = 5;
export const BREVO_API = 'https://api.brevo.com/v3';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function handleNewsletter(request: Request, env: Env, fetchImpl: FetchLike = fetch): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  if (!sameOrigin(request)) return json({ ok: false, error: 'Forbidden.' }, 403);

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;
  if (typeof body !== 'object' || body === null) return json({ ok: false, error: 'Invalid request.' }, 400);
  const input = body as Partial<NewsletterInput>;

  const now = Date.now();
  if (isLikelyBot({ website: String(input.website ?? ''), startedAt: Number(input.startedAt) }, now)) return json({ ok: true });

  const result = validateNewsletter(input);
  if (!result.ok) return json({ ok: false, errors: result.errors, error: 'Please fix the highlighted fields.' }, 422);

  const listIds = brevoListIds(result.value.subscriptions, env.BREVO_LIST_IDS);
  const templateId = Number(env.BREVO_DOI_TEMPLATE_ID);
  if (!env.BREVO_API_KEY || !listIds || !Number.isInteger(templateId) || templateId <= 0) {
    return json({ ok: false, error: 'Newsletter sign-up isn’t available yet. Please check back soon.' }, 503);
  }

  if (env.DB) {
    const key = await rateKey(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.RATE_KEY_SALT ?? 'ag-accounting', new Date(now));
    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM rate_events WHERE kind = 'newsletter' AND rate_key = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')`,
    )
      .bind(key)
      .first<{ n: number }>();
    if ((recent?.n ?? 0) >= NEWSLETTER_RATE_LIMIT_PER_HOUR) {
      return json({ ok: false, error: 'Too many sign-up attempts. Please try again later.' }, 429);
    }
    await env.DB.prepare(`INSERT INTO rate_events (kind, rate_key) VALUES ('newsletter', ?1)`).bind(key).run();
  }

  const origin = new URL(request.url).origin;
  const attributes: Record<string, string> = {};
  if (result.value.firstName) attributes.FIRSTNAME = result.value.firstName;

  const response = await fetchImpl(`${BREVO_API}/contacts/doubleOptinConfirmation`, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: result.value.email,
      attributes,
      includeListIds: listIds,
      templateId,
      redirectionUrl: `${origin}/newsletter/confirmed`,
    }),
  });
  if (!response.ok) {
    console.error(`Newsletter sign-up failed at Brevo with status ${response.status}`);
    return json({ ok: false, error: 'We couldn’t complete your sign-up right now. Please try again later.' }, 502);
  }
  return json({ ok: true });
}

export async function purgeOldRateEvents(db: D1Database): Promise<void> {
  await db.prepare(`DELETE FROM rate_events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days')`).run();
}
