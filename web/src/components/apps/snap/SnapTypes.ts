export interface SnapPost {
  id: number;
  account_id?: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  caption?: string;
  likes?: number;
  liked?: boolean;
  is_live?: boolean;
  is_own?: boolean;
}

export interface SnapStory {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  expires_at?: string;
  is_own?: boolean;
}

export interface SnapLive {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  live_viewers?: number;
}

export interface SnapLiveSocketMessage {
  id: string;
  liveId: string;
  authorId?: string;
  username: string;
  display?: string;
  avatar?: string;
  content: string;
  isMention: boolean;
  createdAt: number;
}

export interface SnapLiveReaction {
  id: string;
  liveId: string;
  username: string;
  avatar?: string;
  reaction: string;
  createdAt: number;
}

export type TrackKind = 'audio' | 'video';

export interface MediaTrackEntry {
  sid: string;
  kind: TrackKind;
  element: HTMLMediaElement;
}

export interface SnapFollowRequest {
  id: number;
  account_id: number;
  from_identifier?: string;
  to_identifier?: string;
  username?: string;
  display_name?: string;
  avatar?: string;
  verified?: boolean;
  created_at?: string;
}

export interface SnapDiscoverPost {
  id: number;
  account_id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  caption?: string;
  likes?: number;
  created_at?: string;
  is_private?: boolean;
  is_following?: boolean;
  requested_by_me?: boolean;
}

export interface LiveStartResponse {
  success?: boolean;
  payload?: { postId?: number };
  error?: string;
}

export interface SnapLiveAudioStartResponse {
  success?: boolean;
  enabled?: boolean;
  reason?: string;
  config?: {
    updateIntervalMs?: number;
  };
}

export interface SnapLiveProximityState {
  liveId?: number;
  listening?: boolean;
  targetOnline?: boolean;
  distance?: number;
}

export interface SnapLiveProximityVolume {
  liveId?: number;
  volume?: number;
}

export interface SnapLiveProximityDisabled {
  liveId?: number;
  reason?: string;
}

export interface SnapLiveAudioStatusResponse {
  active?: boolean;
  activeListen?: boolean;
  currentVolume?: number;
}

export interface SnapAccount {
  username?: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
  is_private?: boolean | number;
}

export function cleanLiveText(value: unknown, maxLength: number): string {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

export function normalizeLiveMessage(input: unknown): SnapLiveSocketMessage | null {
  if (!input || typeof input !== 'object') return null;

  const source = input as Record<string, unknown>;
  const id = cleanLiveText(source.id, 64);
  const liveId = cleanLiveText(source.liveId, 64);
  const username = cleanLiveText(source.username, 32);
  const content = cleanLiveText(source.content, 400);

  if (!id || !liveId || !username || !content) return null;

  const createdAtValue = Number(source.createdAt);
  const createdAt = Number.isFinite(createdAtValue) && createdAtValue > 0
    ? Math.floor(createdAtValue)
    : Date.now();

  return {
    id,
    liveId,
    authorId: cleanLiveText(source.authorId, 80) || undefined,
    username,
    display: cleanLiveText(source.display, 80) || undefined,
    content,
    isMention: source.isMention === true,
    createdAt,
    avatar: cleanLiveText(source.avatar, 255) || undefined,
  };
}

export function getLiveAudioDisabledMessage(reason: string): string {
  if (reason === 'owner_offline') return 'Emisor no disponible';
  if (reason === 'stream_not_live') return 'Live finalizado';
  if (reason === 'rate_limited') return 'Intentando reconectar audio...';
  if (reason === 'stream_unavailable') return 'Audio de proximidad no disponible';
  return 'Audio pausado hasta recuperar proximidad';
}

export const SNAP_MOCK_LIVE_ID = -999001;
export const SNAP_MOCK_USERS = ['mika', 'luna', 'santi', 'mery', 'rodrigo'];
export const SNAP_MOCK_LINES = [
  'Se ve re bien 🔥',
  'Vamos snap live 🙌',
  'Que buena toma 😮',
  'Jajaja top 😂',
  'Saludos desde LS ❤️',
  'Audio ok ✅',
  'Subi ese tema 🎵',
];
