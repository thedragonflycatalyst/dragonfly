// How a trainer reaches a client: Dragonfly chat (the default), a text message, or WhatsApp.
// Text and WhatsApp open the phone's own app with the message filled in (free: no SMS gateway or WhatsApp Business account).
export type ContactVia = 'app' | 'sms' | 'whatsapp';
export const CONTACT_LABEL: Record<ContactVia, string> = { app: 'Dragonfly chat', sms: 'Text message', whatsapp: 'WhatsApp' };

/** Digits with country code for WhatsApp (10-digit numbers are treated as US/Canada) */
export function intlDigits(phone: string): string | null {
  const d = phone.replace(/[^\d+]/g, '');
  const digits = d.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (!d.startsWith('+') && digits.length === 10) return `1${digits}`;
  return digits;
}

/** Link that opens Messages or WhatsApp to this person with the text ready to send; null if there's no usable number */
export function contactLink(via: ContactVia, phone: string | null | undefined, text = '', os: string = 'android'): string | null {
  if (via === 'app' || !phone) return null;
  if (via === 'whatsapp') { const n = intlDigits(phone); return n ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null; }
  const n = phone.replace(/[^\d+]/g, '');
  if (n.replace(/\D/g, '').length < 7) return null;
  return `sms:${n}${text ? `${os === 'ios' ? '&' : '?'}body=${encodeURIComponent(text)}` : ''}`;
}
