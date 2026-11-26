import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { DEFAULT_SUBSCRIPTIONS, SUBSCRIPTIONS, validateNewsletter } from '../shared/newsletter.ts';
import type { NewsletterErrors, NewsletterInput } from '../shared/newsletter.ts';
import { Link } from '../lib/router.tsx';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

const inputClass = 'mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-base aria-[invalid=true]:border-red-600';

/** Newsletter sign-up form. `compact` shows only the two main subscriptions. */
export function NewsletterSignup({ compact = false, idPrefix = 'nl' }: { compact?: boolean; idPrefix?: string }) {
  const startedAt = useRef(Date.now());
  const [errors, setErrors] = useState<NewsletterErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const options = compact ? SUBSCRIPTIONS.filter((s) => DEFAULT_SUBSCRIPTIONS.includes(s.id)) : SUBSCRIPTIONS;
  const id = (name: string) => `${idPrefix}-${name}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: NewsletterInput = {
      email: String(form.get('email') ?? ''),
      firstName: String(form.get('firstName') ?? ''),
      subscriptions: form.getAll('subscriptions').map(String),
      consent: form.get('consent') === 'yes',
      website: String(form.get('website') ?? ''),
      startedAt: startedAt.current,
    };
    const result = validateNewsletter(input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; errors?: NewsletterErrors } | null;
      if (response.ok && data?.ok) {
        setStatus({ kind: 'sent' });
        return;
      }
      if (data?.errors) setErrors(data.errors);
      setStatus({ kind: 'error', message: data?.error ?? 'Something went wrong. Please try again later.' });
    } catch {
      setStatus({ kind: 'error', message: 'We couldn’t reach the server. Please check your connection.' });
    }
  }

  if (status.kind === 'sent') {
    return (
      <div role="status" className="rounded-lg border border-accent-500 bg-white p-5">
        <p className="font-semibold">Almost done: please check your email.</p>
        <p className="mt-1 text-sm text-muted">We sent you a message with a link to confirm your subscription. You won’t receive anything until you confirm.</p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4" aria-label="Newsletter sign-up">
      <div className={compact ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4 sm:grid-cols-2'}>
        <div>
          <label htmlFor={id('email')} className="block font-medium">
            Email
          </label>
          <input
            id={id('email')}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            className={inputClass}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? id('email-error') : undefined}
          />
          {errors.email && (
            <p id={id('email-error')} className="mt-1 text-sm text-red-700">
              {errors.email}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={id('firstName')} className="block font-medium">
            First name (optional)
          </label>
          <input
            id={id('firstName')}
            name="firstName"
            autoComplete="given-name"
            maxLength={60}
            className={inputClass}
            aria-invalid={errors.firstName ? true : undefined}
            aria-describedby={errors.firstName ? id('firstName-error') : undefined}
          />
          {errors.firstName && (
            <p id={id('firstName-error')} className="mt-1 text-sm text-red-700">
              {errors.firstName}
            </p>
          )}
        </div>
      </div>

      <fieldset aria-describedby={errors.subscriptions ? id('subs-error') : undefined}>
        <legend className="font-medium">What would you like to receive?</legend>
        <div className={`mt-2 grid gap-2 ${compact ? 'sm:grid-cols-2' : ''}`}>
          {options.map((s, i) => (
            <label key={s.id} className="flex items-start gap-3 rounded-md border border-line bg-white p-3">
              <input
                id={i === 0 ? id('subscriptions') : undefined}
                type="checkbox"
                name="subscriptions"
                value={s.id}
                defaultChecked={DEFAULT_SUBSCRIPTIONS.includes(s.id)}
                className="mt-1 h-4 w-4 accent-brand-800"
              />
              <span>
                <span className="font-medium">{s.label}</span>
                {!compact && <span className="block text-sm text-muted">{s.description}</span>}
              </span>
            </label>
          ))}
        </div>
        {errors.subscriptions && (
          <p id={id('subs-error')} className="mt-1 text-sm text-red-700">
            {errors.subscriptions}
          </p>
        )}
      </fieldset>

      <div>
        <label className="flex items-start gap-3">
          <input id={id('consent')} type="checkbox" name="consent" value="yes" className="mt-1 h-4 w-4 accent-brand-800" />
          <span className="text-sm">
            Yes, email me what I selected from AG Accounting. I can unsubscribe at any time. See our{' '}
            <Link to="/privacy" className="text-brand-800">
              privacy page
            </Link>
            .
          </span>
        </label>
        {errors.consent && <p className="mt-1 text-sm text-red-700">{errors.consent}</p>}
      </div>

      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={id('website')}>Leave this field empty</label>
        <input id={id('website')} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === 'error' && (
        <p role="alert" className="text-red-700">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={status.kind === 'sending'}
        className="select-none rounded-md bg-brand-800 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {status.kind === 'sending' ? 'Signing you up…' : 'Sign up'}
      </button>
    </form>
  );
}
