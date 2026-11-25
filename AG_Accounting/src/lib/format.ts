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
