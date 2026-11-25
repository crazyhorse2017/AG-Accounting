import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { business } from '../content/site.ts';
import { Notice, PageHeader, Section } from '../components/ui.tsx';
import { formatAddress, telHref } from '../lib/format.ts';
import { CONTACT_TOPICS, LIMITS, SENSITIVE_DATA_MESSAGE, validateContact } from '../shared/contact.ts';
import type { ContactInput, FieldErrors } from '../shared/contact.ts';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

const inputClass =
  'mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-base shadow-sm focus:border-brand-600 aria-[invalid=true]:border-red-600';

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export function ContactPage() {
  const startedAt = useRef(Date.now());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: ContactInput = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      topic: String(form.get('topic') ?? ''),
      preferredContact: String(form.get('preferredContact') ?? ''),
      message: String(form.get('message') ?? ''),
      website: String(form.get('website') ?? ''),
      startedAt: startedAt.current,
    };

    const result = validateContact(input);
    if (!result.ok) {
      setErrors(result.errors);
      setStatus({ kind: 'idle' });
      const first = Object.keys(result.errors)[0];
      if (first) document.getElementById(`contact-${first}`)?.focus();
      return;
    }

    setErrors({});
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; errors?: FieldErrors; error?: string } | null;
      if (response.ok && data?.ok) {
        setStatus({ kind: 'sent' });
        return;
      }
      if (data?.errors) setErrors(data.errors);
      setStatus({ kind: 'error', message: data?.error ?? 'Something went wrong sending your message. Please try again or call us.' });
    } catch {
      setStatus({ kind: 'error', message: 'We couldn’t reach the server. Please check your connection or call us.' });
    }
  }

  return (
    <>
      <PageHeader eyebrow="Contact" title="Get in touch" intro="Send a message and we’ll get back to you, usually within one business day." />
      <Section>
        <div className="grid gap-12 md:grid-cols-[3fr_2fr]">
          <div>
            {status.kind === 'sent' ? (
              <div role="status" className="rounded-lg border border-accent-500 bg-white p-6">
                <h2 className="text-2xl">Thank you, your message was sent.</h2>
                <p className="mt-2 text-muted">We’ll be in touch soon using the contact method you chose.</p>
              </div>
            ) : (
              <form noValidate onSubmit={onSubmit} className="space-y-5" aria-describedby="contact-privacy-note">
                <Notice tone="warning">
                  <span id="contact-privacy-note">{SENSITIVE_DATA_MESSAGE}</span>
                </Notice>

                <Field id="contact-name" label="Your name" error={errors.name}>
                  <input
                    id="contact-name"
                    name="name"
                    autoComplete="name"
                    maxLength={LIMITS.name}
                    required
                    className={inputClass}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={describedBy('contact-name', errors.name)}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="contact-email" label="Email" error={errors.email}>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength={LIMITS.email}
                      required
                      className={inputClass}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={describedBy('contact-email', errors.email)}
                    />
                  </Field>
                  <Field id="contact-phone" label="Phone (optional)" error={errors.phone}>
                    <input
                      id="contact-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      maxLength={LIMITS.phone}
                      className={inputClass}
                      aria-invalid={errors.phone ? true : undefined}
                      aria-describedby={describedBy('contact-phone', errors.phone)}
                    />
                  </Field>
                </div>

                <Field id="contact-topic" label="What can we help with?" error={errors.topic}>
                  <select
                    id="contact-topic"
                    name="topic"
                    required
                    defaultValue=""
                    className={inputClass}
                    aria-invalid={errors.topic ? true : undefined}
                    aria-describedby={describedBy('contact-topic', errors.topic)}
                  >
                    <option value="" disabled>
                      Choose one
                    </option>
                    {CONTACT_TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>

                <fieldset aria-describedby={errors.preferredContact ? 'contact-preferredContact-error' : undefined}>
                  <legend className="font-medium">How should we reach you?</legend>
                  <div className="mt-2 flex gap-6">
                    {(['email', 'phone'] as const).map((v, i) => (
                      <label key={v} className="flex items-center gap-2">
                        <input
                          id={i === 0 ? 'contact-preferredContact' : undefined}
                          type="radio"
                          name="preferredContact"
                          value={v}
                          defaultChecked={v === 'email'}
                          className="h-4 w-4 accent-brand-800"
                        />
                        {v === 'email' ? 'Email' : 'Phone call'}
                      </label>
                    ))}
                  </div>
                  {errors.preferredContact && (
                    <p id="contact-preferredContact-error" className="mt-1 text-sm text-red-700">
                      {errors.preferredContact}
                    </p>
                  )}
                </fieldset>

                <Field
                  id="contact-message"
                  label="Your message"
                  error={errors.message}
                  hint="A sentence or two about what you need is plenty."
                >
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={6}
                    maxLength={LIMITS.message}
                    required
                    className={inputClass}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={describedBy('contact-message', errors.message, 'hint')}
                  />
                </Field>

                {/* Honeypot: hidden from people and screen readers; bots tend to fill it. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label htmlFor="contact-website">Leave this field empty</label>
                  <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
                </div>

                {status.kind === 'error' && (
                  <p role="alert" className="text-red-700">
                    {status.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status.kind === 'sending'}
                  className="rounded-md bg-brand-800 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {status.kind === 'sending' ? 'Sending…' : 'Send message'}
                </button>
              </form>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-lg border border-line bg-white p-6">
              <h2 className="text-xl">Other ways to reach us</h2>
              <ul className="mt-3 space-y-2">
                {business.phone && (
                  <li>
                    <a href={telHref(business.phone)} className="font-semibold text-brand-800">
                      {business.phone}
                    </a>
                  </li>
                )}
                {business.email && (
                  <li>
                    <a href={`mailto:${business.email}`} className="text-brand-800">
                      {business.email}
                    </a>
                  </li>
                )}
                {business.address && <li>{formatAddress(business.address)}</li>}
                {!business.phone && !business.email && !business.address && (
                  <li className="text-muted">Phone, email, and office details are coming soon.</li>
                )}
              </ul>
              {business.hours && (
                <ul className="mt-4 space-y-1 text-sm text-muted">
                  {business.hours.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
            <Notice>Need to send documents? Please don’t email them. Ask us about our secure file portal.</Notice>
          </aside>
        </div>
      </Section>
    </>
  );
}
