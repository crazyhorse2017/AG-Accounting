import type { BusinessInfo } from '../content/site.ts';

/** Turns a display phone number into a tel: link (digits only, US numbers get +1). */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  return `tel:${digits}`;
}

export function formatAddress(address: NonNullable<BusinessInfo['address']>): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
}

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeMoneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function money(n: number, whole = false): string {
  if (!Number.isFinite(n)) return '—';
  return (whole ? wholeMoneyFmt : moneyFmt).format(n);
}

export function percent(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits).replace(/\.0+$/, '')}%`;
}

export function number(n: number): string {
  return Number.isFinite(n) ? numberFmt.format(n) : '—';
}

/** "2027-04-15" -> "Thursday, April 15, 2027" (date-only, no time zone shift). */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatValue(value: number | string, format: 'money' | 'percent' | 'number' | 'years' | 'months' | 'text'): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'money':
      return money(value);
    case 'percent':
      return percent(value, 2).replace(/(\.\d)0%$/, '$1%');
    case 'years':
      return `${numberFmt.format(value)} year${value === 1 ? '' : 's'}`;
    case 'months':
      return `${numberFmt.format(value)} month${value === 1 ? '' : 's'}`;
    case 'number':
      return number(value);
    default:
      return String(value);
  }
}
