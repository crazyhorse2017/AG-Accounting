/**
 * Contact form rules, shared by the browser form and the Worker so both
 * validate exactly the same way. The Worker never trusts the browser.
 *
 * HARD RULE: the site never accepts Social Security numbers, card numbers or
 * bank account numbers. Submissions that look like they contain one are rejected
 * with a friendly message instead of being stored.
 */

export const CONTACT_TOPICS = [
  'Individual taxes',
  'Business taxes',
  'Accounting or bookkeeping',
  'Payroll',
  'A letter from the IRS or state',
  'Something else',
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export type PreferredContact = 'email' | 'phone';

export type ContactInput = {
  name: string;
  email: string;
  phone: string;
  topic: string;
  preferredContact: string;
  message: string;
  /** Honeypot field: real people never see or fill it. */
  website: string;
  /** Milliseconds since epoch when the form was first shown. */
  startedAt: number;
};

export type ContactSubmission = {
  name: string;
  email: string;
  phone: string | null;
  topic: ContactTopic;
  preferredContact: PreferredContact;
  message: string;
};

export type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'topic' | 'preferredContact' | 'message', string>>;

export type ValidationResult =
  | { ok: true; value: ContactSubmission }
  | { ok: false; errors: FieldErrors };

export const LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  messageMin: 10,
  message: 2000,
  /** Submissions faster than this after the form appears are treated as bots. */
  minFillMs: 3000,
} as const;

export const SENSITIVE_DATA_MESSAGE =
  'For your security, please don’t include Social Security numbers, card numbers, or bank account numbers. We’ll ask for what we need through a secure method.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** SSN in the common 123-45-6789 / 123 45 6789 shapes, or exactly nine digits on their own. */
const SSN_PATTERN = /(?<!\d)(?:\d{3}[-\s.]\d{2}[-\s.]\d{4}|\d{9})(?!\d)/;

/** Runs of 13 to 19 digits, allowing single spaces or dashes between them. */
const CARD_CANDIDATE = /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g;

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/** True when text appears to contain an SSN or a payment card number. */
export function containsSensitiveNumber(text: string): boolean {
  if (SSN_PATTERN.test(text)) return true;
  for (const match of text.matchAll(CARD_CANDIDATE)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) return true;
  }
  return false;
}

/** Collapses whitespace and strips control characters. */
export function cleanText(value: unknown, keepNewlines = false): string {
  if (typeof value !== 'string') return '';
  const noControl = value.replace(keepNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ');
  if (keepNewlines) {
    return noControl
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return noControl.replace(/\s+/g, ' ').trim();
}

export function isLikelyBot(input: Pick<ContactInput, 'website' | 'startedAt'>, now: number): boolean {
  if (cleanText(input.website) !== '') return true;
  if (!Number.isFinite(input.startedAt) || input.startedAt <= 0) return true;
  return now - input.startedAt < LIMITS.minFillMs;
}

export function validateContact(input: Partial<ContactInput>): ValidationResult {
  const errors: FieldErrors = {};

  const name = cleanText(input.name);
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;

  const email = cleanText(input.email).toLowerCase();
  if (!email) errors.email = 'Please enter your email address.';
  else if (email.length > LIMITS.email || !EMAIL_PATTERN.test(email)) errors.email = 'Please enter a valid email address.';

  const phone = cleanText(input.phone);
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (phone.length > LIMITS.phone || !/^[\d\s()+.-]+$/.test(phone) || digits.length < 10 || digits.length > 15) {
      errors.phone = 'Please enter a valid phone number, or leave it blank.';
    }
  }

  const topic = cleanText(input.topic);
  const knownTopic = CONTACT_TOPICS.find((t) => t === topic);
  if (!knownTopic) errors.topic = 'Please choose what you need help with.';

  const preferred = cleanText(input.preferredContact);
  if (preferred !== 'email' && preferred !== 'phone') {
    errors.preferredContact = 'Please choose how you’d like us to reach you.';
  } else if (preferred === 'phone' && !phone) {
    errors.phone = 'Please add a phone number so we can call you.';
  }

  const message = cleanText(input.message, true);
  if (message.length < LIMITS.messageMin) errors.message = 'Please tell us a little more about what you need.';
  else if (message.length > LIMITS.message) errors.message = `Please keep your message under ${LIMITS.message} characters.`;

  if (!errors.message && containsSensitiveNumber(message)) errors.message = SENSITIVE_DATA_MESSAGE;
  if (!errors.name && containsSensitiveNumber(name)) errors.name = SENSITIVE_DATA_MESSAGE;

  if (Object.keys(errors).length > 0 || !knownTopic) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      email,
      phone: phone || null,
      topic: knownTopic,
      preferredContact: preferred as PreferredContact,
      message,
    },
  };
}
