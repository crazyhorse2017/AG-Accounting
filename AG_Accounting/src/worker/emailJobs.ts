/**
 * Scheduled email jobs (Cloudflare cron, Tuesdays).
 *
 * - Weekly tip: the next approved tip that hasn't been sent, to the "tips" list.
 * - Monthly newsletter: in the first week of the month, that month's pre-built issue,
 *   to the "newsletter" list.
 *
 * Only approved content is ever in emails.json (tools/build_emails.py enforces it).
 * SEND_MODE "draft" (default) creates the campaign in Brevo for a person to review and
 * send; "auto" sends it. Every action is logged in D1 so nothing is sent twice.
 */

import emailsFile from './generated/emails.json';
import { easternDate } from '../lib/daily.ts';
import { BREVO_API } from './newsletter.ts';
import type { Env } from './contact.ts';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type BuiltEmail = { id: string; subject: string; preheader: string; html: string };

export type EmailBundle = {
  tips: BuiltEmail[];
  newsletters: Record<string, BuiltEmail>;
};

export const EMAILS = emailsFile as unknown as EmailBundle;

export type JobOutcome = { kind: 'tip' | 'newsletter'; itemId: string | null; status: string };

/** "AG Accounting <alex@example.com>" -> { name, email } */
export function parseSender(value: string | undefined): { name: string; email: string } | null {
  if (!value) return null;
  const m = /^\s*(.*?)\s*<([^>\s]+@[^>\s]+)>\s*$/.exec(value);
  if (m) return { name: m[1] || 'AG Accounting', email: m[2] };
  return /^[^\s@]+@[^\s@]+$/.test(value.trim()) ? { name: 'AG Accounting', email: value.trim() } : null;
}

function listId(env: Env, key: string): number | null {
  try {
    const id = Number((JSON.parse(env.BREVO_LIST_IDS ?? '{}') as Record<string, unknown>)[key]);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function alreadySent(db: D1Database, kind: string, itemId: string): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 AS hit FROM email_sends WHERE kind = ?1 AND item_id = ?2`).bind(kind, itemId).first<{ hit: number }>();
  return Boolean(row);
}

async function createCampaign(
  env: Env,
  fetchImpl: FetchLike,
  email: BuiltEmail,
  kind: 'tip' | 'newsletter',
  list: number,
): Promise<{ id: string; sent: boolean }> {
  const sender = parseSender(env.NEWSLETTER_FROM);
  if (!sender) throw new Error('NEWSLETTER_FROM is not set');
  const headers = { 'api-key': env.BREVO_API_KEY ?? '', 'Content-Type': 'application/json', Accept: 'application/json' };
  const created = await fetchImpl(`${BREVO_API}/emailCampaigns`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `${kind === 'tip' ? 'Weekly tip' : 'Newsletter'}: ${email.id}`,
      subject: email.subject,
      previewText: email.preheader,
      sender,
      htmlContent: email.html,
      recipients: { listIds: [list] },
    }),
  });
  if (!created.ok) throw new Error(`Brevo campaign create failed with status ${created.status}`);
  const id = String(((await created.json()) as { id?: number | string }).id ?? '');
  if (env.SEND_MODE !== 'auto') return { id, sent: false };
  const send = await fetchImpl(`${BREVO_API}/emailCampaigns/${encodeURIComponent(id)}/sendNow`, { method: 'POST', headers });
  if (!send.ok) throw new Error(`Brevo campaign send failed with status ${send.status}`);
  return { id, sent: true };
}

async function runOne(
  env: Env,
  fetchImpl: FetchLike,
  kind: 'tip' | 'newsletter',
  email: BuiltEmail | undefined,
  listKey: string,
): Promise<JobOutcome> {
  if (!email) return { kind, itemId: null, status: 'nothing approved to send' };
  const db = env.DB!;
  if (await alreadySent(db, kind, email.id)) return { kind, itemId: email.id, status: 'already handled' };
  const list = listId(env, listKey);
  if (!list) return { kind, itemId: email.id, status: `no Brevo list for "${listKey}"` };
  const result = await createCampaign(env, fetchImpl, email, kind, list);
  await db
    .prepare(`INSERT INTO email_sends (kind, item_id, mode, brevo_campaign_id) VALUES (?1, ?2, ?3, ?4)`)
    .bind(kind, email.id, result.sent ? 'auto' : 'draft', result.id)
    .run();
  return { kind, itemId: email.id, status: result.sent ? 'sent' : 'draft created in Brevo' };
}

/** The next approved tip that hasn't been handled yet. */
export async function nextTip(db: D1Database, bundle: EmailBundle = EMAILS): Promise<BuiltEmail | undefined> {
  for (const tip of bundle.tips) {
    if (!(await alreadySent(db, 'tip', tip.id))) return tip;
  }
  return undefined;
}

export function newsletterKey(now: Date): string {
  const { year, month } = easternDate(now);
  return `${year}-${String(month).padStart(2, '0')}`;
}

export async function runWeeklyEmails(env: Env, now: Date = new Date(), fetchImpl: FetchLike = fetch, bundle: EmailBundle = EMAILS): Promise<JobOutcome[]> {
  if (!env.DB || !env.BREVO_API_KEY) return [{ kind: 'tip', itemId: null, status: 'email not configured' }];
  const outcomes: JobOutcome[] = [];
  try {
    outcomes.push(await runOne(env, fetchImpl, 'tip', await nextTip(env.DB, bundle), 'tips'));
    if (easternDate(now).day <= 7) {
      outcomes.push(await runOne(env, fetchImpl, 'newsletter', bundle.newsletters[newsletterKey(now)], 'newsletter'));
    }
  } catch (err) {
    console.error(`Tuesday job failed: ${String(err)}`);
    outcomes.push({ kind: 'tip', itemId: null, status: 'failed' });
  }
  return outcomes;
}
