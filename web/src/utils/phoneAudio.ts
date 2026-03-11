export type ToneCategory = 'ringtone' | 'notification' | 'message' | 'vibrate';
export type AudioProfile = 'normal' | 'street' | 'vehicle' | 'silent';

export interface PhoneToneCatalogItem {
  id: string;
  name: string;
  file: string;
  vibrando?: string;
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
    calling: PhoneToneCatalogItem[];
  };
}

type TonePlaybackOptions = {
  toneId?: string;
  category: ToneCategory;
  volume?: number;
  loop?: boolean;
  audioProfile?: AudioProfile;
  forceVibrate?: boolean;
};

type NamedPlaybackOptions = {
  sound: string;
  volume?: number;
  loop?: boolean;
};

type ActiveChannel = {
  audio: HTMLAudioElement;
  kind: 'tone' | 'named';
  options: TonePlaybackOptions | NamedPlaybackOptions;
  source: string;
};

export const FALLBACK_AUDIO_CATALOG: PhoneToneCatalog = {
  source: {
    name: 'Pixabay',
    license: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    downloadPage: 'https://pixabay.com/sound-effects/',
  },
  categories: {
    ringtones: [
      { id: 'call_1', name: 'Tono 1', file: '/audio/ringtones/call_1.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_2', name: 'Tono 2', file: '/audio/ringtones/call_2.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_3', name: 'Tono 3', file: '/audio/ringtones/call_3.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_4', name: 'Tono 4', file: '/audio/ringtones/call_4.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_5', name: 'Tono 5', file: '/audio/ringtones/call_5.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_6', name: 'Tono 6', file: '/audio/ringtones/call_6.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_7', name: 'Tono 7', file: '/audio/ringtones/call_7.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_8', name: 'Tono 8', file: '/audio/ringtones/call_8.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_9', name: 'Tono 9', file: '/audio/ringtones/call_9.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_10', name: 'Tono 10', file: '/audio/ringtones/call_10.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_11', name: 'Tono 11', file: '/audio/ringtones/call_11.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_12', name: 'Tono 12', file: '/audio/ringtones/call_12.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
      { id: 'call_13', name: 'Tono 13', file: '/audio/ringtones/call_13.mp3', vibrando: '/audio/ringtones/call_vibrando.mp3' },
    ],
    notifications: [
      { id: 'notif_1', name: 'Notificacion 1', file: '/audio/notifications/nueva_notificacion.mp3', vibrando: '/audio/notifications/nueva_notificacion_vibrando.mp3' },
      { id: 'notif_2', name: 'Notificacion 2', file: '/audio/notifications/nueva_notificacion2.mp3', vibrando: '/audio/notifications/nueva_notificacion_vibrando.mp3' },
      { id: 'notif_3', name: 'Notificacion 3', file: '/audio/notifications/nueva_notificacion3.mp3', vibrando: '/audio/notifications/nueva_notificacion_vibrando.mp3' },
      { id: 'pop_1', name: 'Pop 1', file: '/audio/notifications/pop.mp3' },
      { id: 'pop_2', name: 'Pop 2', file: '/audio/notifications/pop2.mp3' },
    ],
    messages: [
      { id: 'msg_1', name: 'Mensaje 1', file: '/audio/messages/nueva_notificacion.mp3', vibrando: '/audio/messages/nueva_notificacion_vibrando.mp3' },
      { id: 'msg_2', name: 'Mensaje 2', file: '/audio/messages/nueva_notificacion2.mp3', vibrando: '/audio/messages/nueva_notificacion_vibrando.mp3' },
      { id: 'msg_3', name: 'Mensaje 3', file: '/audio/messages/nueva_notificacion3.mp3', vibrando: '/audio/messages/nueva_notificacion_vibrando.mp3' },
    ],
    calling: [
      { id: 'calling_loop', name: 'Sonando', file: '/audio/sonando.mp3' },
      { id: 'calling_short', name: 'Sonando corto', file: '/audio/sonando_corto.mp3' },
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

const DEFAULT_TONES: Record<ToneCategory, string> = {
  ringtone: 'call_1',
  notification: 'notif_1',
  message: 'msg_1',
  vibrate: 'call_1',
};

const VIBRANDO_FALLBACKS: Record<ToneCategory, string> = {
  ringtone: '/audio/ringtones/call_vibrando.mp3',
  notification: '/audio/notifications/nueva_notificacion_vibrando.mp3',
  message: '/audio/messages/nueva_notificacion_vibrando.mp3',
  vibrate: '/audio/ringtones/call_vibrando.mp3',
};

const NAMED_AUDIO: Record<string, string> = Object.fromEntries(
  FALLBACK_AUDIO_CATALOG.categories.calling.map((item) => [item.id, item.file]),
);

const TONE_BY_ID = new Map<string, PhoneToneCatalogItem>();
for (const item of FALLBACK_AUDIO_CATALOG.categories.ringtones) TONE_BY_ID.set(item.id, item);
for (const item of FALLBACK_AUDIO_CATALOG.categories.notifications) TONE_BY_ID.set(item.id, item);
for (const item of FALLBACK_AUDIO_CATALOG.categories.messages) TONE_BY_ID.set(item.id, item);

function clampVolume(volume?: number) {
  const next = typeof volume === 'number' ? volume : 0.5;
  return Math.max(0, Math.min(next, 1));
}

export function resolveNamedAudio(sound?: string) {
  if (!sound) return null;
  return NAMED_AUDIO[sound] || null;
}

export function resolveToneCatalogId(toneId: string | undefined, category: ToneCategory) {
  const normalized = toneId && TONE_BY_ID.has(toneId) ? toneId : TONE_ALIASES[toneId || ''];
  if (normalized && TONE_BY_ID.has(normalized)) return normalized;
  return DEFAULT_TONES[category];
}

export function resolveToneAsset(toneId: string | undefined, category: ToneCategory, audioProfile: AudioProfile = 'normal', forceVibrate = false) {
  const resolvedId = resolveToneCatalogId(toneId, category);
  const entry = TONE_BY_ID.get(resolvedId);
  if (!entry) return null;

  if (forceVibrate || audioProfile === 'silent') {
    return entry.vibrando || VIBRANDO_FALLBACKS[category];
  }

  return entry.file;
}

export function resolveToneVolume(volume: number | undefined, audioProfile: AudioProfile = 'normal', forceVibrate = false) {
  const base = clampVolume(volume);
  if (forceVibrate || audioProfile === 'silent') return Math.max(0.08, Math.min(base * 0.3, 0.22));
  if (audioProfile === 'street') return Math.min(base * 1.1, 1);
  if (audioProfile === 'vehicle') return Math.min(base * 1.15, 1);
  return base;
}

class PhoneAudioManager {
  private channels = new Map<string, ActiveChannel>();

  has(channel: string) {
    return this.channels.has(channel);
  }

  stop(channel: string) {
    const active = this.channels.get(channel);
    if (!active) return;
    active.audio.pause();
    active.audio.currentTime = 0;
    this.channels.delete(channel);
  }

  stopAll() {
    for (const channel of Array.from(this.channels.keys())) {
      this.stop(channel);
    }
  }

  playTone(channel: string, options: TonePlaybackOptions) {
    const source = resolveToneAsset(options.toneId, options.category, options.audioProfile, options.forceVibrate);
    if (!source) return false;
    return this.play(channel, source, 'tone', options, resolveToneVolume(options.volume, options.audioProfile, options.forceVibrate));
  }

  playNamed(channel: string, options: NamedPlaybackOptions) {
    const source = resolveNamedAudio(options.sound);
    if (!source) return false;
    return this.play(channel, source, 'named', options, clampVolume(options.volume));
  }

  refresh(channel: string) {
    const active = this.channels.get(channel);
    if (!active) return false;
    if (active.kind === 'tone') {
      return this.playTone(channel, active.options as TonePlaybackOptions);
    }
    return this.playNamed(channel, active.options as NamedPlaybackOptions);
  }

  updateNamedVolume(channel: string, volume: number) {
    const active = this.channels.get(channel);
    if (!active || active.kind !== 'named') return false;
    const nextOptions = { ...(active.options as NamedPlaybackOptions), volume };
    active.options = nextOptions;
    active.audio.volume = clampVolume(volume);
    return true;
  }

  private play(channel: string, source: string, kind: 'tone' | 'named', options: TonePlaybackOptions | NamedPlaybackOptions, volume: number) {
    this.stop(channel);

    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.loop = options.loop === true;
    audio.volume = volume;

    const active: ActiveChannel = { audio, kind, options, source };
    this.channels.set(channel, active);

    const clearIfCurrent = () => {
      const current = this.channels.get(channel);
      if (current && current.audio === audio) {
        this.channels.delete(channel);
      }
    };

    audio.addEventListener('ended', clearIfCurrent);
    audio.addEventListener('error', clearIfCurrent);
    void audio.play().catch(() => {
      clearIfCurrent();
    });
    return true;
  }
}

export const phoneAudio = new PhoneAudioManager();
