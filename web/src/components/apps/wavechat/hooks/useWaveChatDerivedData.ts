import { createMemo } from 'solid-js';
import { sanitizePhone, sanitizeText } from '../../../../utils/sanitize';

interface ContactEntry {
  number: string;
  display: string;
}

interface WaveStatus {
  id: number;
  phone_number: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at?: string;
  contact_name?: string;
}

export function useWaveChatDerivedData(params: {
  contacts: () => ContactEntry[];
  statuses: () => WaveStatus[];
  groupContactSearch: () => string;
  ownNumber: () => string;
}) {
  const contactDisplayByNumber = createMemo(() => {
    const map = new Map<string, string>();
    for (const contact of params.contacts()) {
      map.set(contact.number, contact.display || contact.number);
    }
    return map;
  });

  const knownContactNumbers = createMemo(() => {
    const set = new Set<string>();
    for (const contact of params.contacts()) {
      set.add(contact.number);
    }
    return set;
  });

  const selectableContacts = createMemo(() => {
    const search = sanitizeText(params.groupContactSearch(), 80).toLowerCase();
    const ownNumber = sanitizePhone(params.ownNumber() || '');
    return params.contacts()
      .filter((contact) => sanitizePhone(contact.number) && sanitizePhone(contact.number) !== ownNumber)
      .filter((contact) => {
        if (!search) return true;
        return contact.display.toLowerCase().includes(search) || contact.number.includes(search);
      })
      .sort((a, b) => a.display.localeCompare(b.display, 'es'));
  });

  const statusRows = createMemo(() => {
    const mine: WaveStatus[] = [];
    const others: WaveStatus[] = [];
    const seen = new Set<string>();
    const ownNumber = params.ownNumber();
    for (const status of params.statuses()) {
      if (!status.phone_number) continue;
      if (status.phone_number === ownNumber) {
        mine.push(status);
        continue;
      }
      if (seen.has(status.phone_number)) continue;
      seen.add(status.phone_number);
      others.push(status);
    }
    return { mine, others };
  });

  return {
    contactDisplayByNumber,
    knownContactNumbers,
    selectableContacts,
    statusRows,
  };
}
