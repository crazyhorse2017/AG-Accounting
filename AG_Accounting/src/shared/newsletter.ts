/**
 * Newsletter sign-up rules, shared by the browser form and the Worker.
 * People join only by choosing to, confirming by email (double opt-in), and can
 * unsubscribe from any email. Subscriber data is stored in Brevo, not on our site.
 */

export const SUBSCRIPTIONS = [
  { id: 'newsletter', label: 'Monthly tax newsletter', description: 'Tax changes, upcoming due dates, and new articles, once a month.' },
  { id: 'tips', label: 'Weekly tax tip', description: 'One short, practical tip every Tuesday.' },
  { id: 'drip-personal', label: 'Personal tax series', description: 'A short email series on getting the most from your personal return.' },
  { id: 'drip-business', label: 'Small business series', description: 'A series for self-employed people and small business owners.' },
  { id: 'drip-niche', label: 'Special situations series', description: 'Retirees, landlords, gig workers, military families and more.' },
  { id: 'drip-wise', label: 'Word to the Wise series', description: 'Protecting yourself from scams, mistakes and penalties.' },
] as const;

export type SubscriptionId = (typeof SUBSCRIPTIONS)[number]['id'];

export const DEFAULT_SUBSCRIPTIONS: SubscriptionId[] = ['newsletter', 'tips'];

export type NewsletterInput = {
  email: string;
  firstName: string;
  subscriptions: string[];
  consent: boolean;
  website: string;
  startedAt: number;
};

export type NewsletterSignup = { email: string; firstName: string | null; subscriptions: SubscriptionId[] };

export type NewsletterErrors = Partial<Record<'email' | 'firstName' | 'subscriptions' | 'consent', string>>;

export type NewsletterResult = { ok: true; value: NewsletterSignup } | { ok: false; errors: NewsletterErrors };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateNewsletter(input: Partial<NewsletterInput>): NewsletterResult {
  const errors: NewsletterErrors = {};
  const email = String(input.email ?? '').trim().toLowerCase();
  if (!email) errors.email = 'Please enter your email address.';
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = 'Please enter a valid email address.';

  const firstName = String(input.firstName ?? '').replace(/\s+/g, ' ').trim();
  if (firstName.length > 60) errors.firstName = 'Please keep your first name under 60 characters.';
  else if (/[<>{}]|https?:/i.test(firstName)) errors.firstName = 'Please enter just your first name.';

  const known = new Set<string>(SUBSCRIPTIONS.map((s) => s.id));
  const raw = Array.isArray(input.subscriptions) ? input.subscriptions.map(String) : [];
  const subscriptions = [...new Set(raw)].filter((s): s is SubscriptionId => known.has(s));
  if (subscriptions.length === 0 || subscriptions.length !== new Set(raw).size) errors.subscriptions = 'Please choose at least one email to receive.';

  if (input.consent !== true) errors.consent = 'Please confirm that you’d like to receive these emails.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, firstName: firstName || null, subscriptions } };
}

/** Map our subscription choices to Brevo list IDs, from the BREVO_LIST_IDS setting. */
export function brevoListIds(subscriptions: readonly SubscriptionId[], listMapJson: string | undefined): number[] | null {
  if (!listMapJson) return null;
  let map: Record<string, unknown>;
  try {
    map = JSON.parse(listMapJson) as Record<string, unknown>;
  } catch {
    return null;
  }
  const ids: number[] = [];
  for (const s of subscriptions) {
    const id = Number(map[s]);
    if (!Number.isInteger(id) || id <= 0) return null;
    ids.push(id);
  }
  return ids;
}
