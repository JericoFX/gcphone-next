export type ToneCategory = 'ringtone' | 'notification' | 'message' | 'vibrate';
export type AudioProfile = 'normal' | 'street' | 'vehicle' | 'silent';

export interface PhoneToneCatalogItem {
  id: string;
  name: string;
}

export interface PhoneToneCatalog {
  source: {
    name: string;
    license: string;
    licenseUrl: string;
    downloadPage: string;
  };
  categories: {
    ringtones: PhoneToneCatalogItem[];
    notifications: PhoneToneCatalogItem[];
    messages: PhoneToneCatalogItem[];
  };
}

export const TONE_CATALOG: PhoneToneCatalog = {
  source: {
    name: 'gcphone_sounds',
    license: 'Included with gcphone-next',
    licenseUrl: '',
    downloadPage: 'https://github.com/JericoFX/Audiotool',
  },
  categories: {
    ringtones: [
      { id: 'call_1', name: 'Tono 1' },
      { id: 'call_2', name: 'Tono 2' },
      { id: 'call_3', name: 'Tono 3' },
      { id: 'call_4', name: 'Tono 4' },
      { id: 'call_5', name: 'Tono 5' },
      { id: 'call_6', name: 'Tono 6' },
      { id: 'call_7', name: 'Tono 7' },
      { id: 'call_8', name: 'Tono 8' },
      { id: 'call_9', name: 'Tono 9' },
      { id: 'call_10', name: 'Tono 10' },
      { id: 'call_11', name: 'Tono 11' },
      { id: 'call_12', name: 'Tono 12' },
      { id: 'call_13', name: 'Tono 13' },
    ],
    notifications: [
      { id: 'notif_1', name: 'Notificacion 1' },
      { id: 'notif_2', name: 'Notificacion 2' },
      { id: 'notif_3', name: 'Notificacion 3' },
      { id: 'pop_1', name: 'Pop 1' },
      { id: 'pop_2', name: 'Pop 2' },
    ],
    messages: [
      { id: 'msg_1', name: 'Mensaje 1' },
      { id: 'msg_2', name: 'Mensaje 2' },
      { id: 'msg_3', name: 'Mensaje 3' },
    ],
  },
};

const TONE_ALIASES: Record<string, string> = {
  call_main_01: 'call_1',
  call_alt_01: 'call_2',
  notif_soft_01: 'notif_1',
  msg_soft_01: 'msg_1',
  buzz_short_01: 'call_1',
};

const VALID_TONE_IDS = new Set<string>();
for (const item of TONE_CATALOG.categories.ringtones) VALID_TONE_IDS.add(item.id);
for (const item of TONE_CATALOG.categories.notifications) VALID_TONE_IDS.add(item.id);
for (const item of TONE_CATALOG.categories.messages) VALID_TONE_IDS.add(item.id);

const DEFAULT_TONES: Record<ToneCategory, string> = {
  ringtone: 'call_1',
  notification: 'notif_1',
  message: 'msg_1',
  vibrate: 'call_1',
};

export function resolveToneCatalogId(toneId: string | undefined, category: ToneCategory) {
  const normalized = toneId && VALID_TONE_IDS.has(toneId) ? toneId : TONE_ALIASES[toneId || ''];
  if (normalized && VALID_TONE_IDS.has(normalized)) return normalized;
  return DEFAULT_TONES[category];
}
