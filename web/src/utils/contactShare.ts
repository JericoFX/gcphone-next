import { sanitizePhone, sanitizeText } from './sanitize';

const CONTACT_SHARE_PREFIX = 'GC_CONTACT:';

export interface SharedContactPayload {
  display: string;
  number: string;
}

export function buildSharedContactMessage(displayInput: unknown, numberInput: unknown): string {
  const display = sanitizeText(displayInput, 80);
  const number = sanitizePhone(numberInput);
  if (!display || !number) return '';
  const params = new URLSearchParams({ name: display, number });
  return `${CONTACT_SHARE_PREFIX}${params.toString()}`;
}

export function parseSharedContactMessage(input: unknown): SharedContactPayload | null {
  const message = sanitizeText(input, 800);
  if (!message.startsWith(CONTACT_SHARE_PREFIX)) return null;
  const params = new URLSearchParams(message.slice(CONTACT_SHARE_PREFIX.length));
  const display = sanitizeText(params.get('name') || '', 80);
  const number = sanitizePhone(params.get('number') || '');
  if (!display || !number) return null;
  return { display, number };
}
