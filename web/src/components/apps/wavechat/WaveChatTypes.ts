export interface GifResult {
  id: string;
  url: string;
}

export interface UploadConfig {
  uploadUrl: string;
  uploadField: string;
}

export interface WaveChatGroup {
  id: number;
  name: string;
  members?: number;
}

export interface WaveChatInvite {
  id: number;
  group_id: number;
  group_name: string;
  inviter_number?: string;
  created_at?: string;
}

export interface WaveChatGroupMessage {
  id: number | string;
  group_id: number;
  sender_number?: string;
  message: string;
  media_url?: string;
  created_at?: string;
}

export interface WaveStatus {
  id: number;
  identifier?: string;
  phone_number: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  views?: number;
  created_at?: string;
  expires_at?: string;
  contact_name?: string;
}

export interface WaveStatusMediaConfig {
  provider?: string;
  canUploadImage?: boolean;
  canUploadVideo?: boolean;
  maxVideoDurationSeconds?: number;
}

export interface WaveSocketAuth {
  success?: boolean;
  host?: string;
  token?: string;
}

export function extractCoords(text?: string): { x: number; y: number } | null {
  if (!text) return null;
  const match = text.match(/LOC:([\-\d.]+),\s*([\-\d.]+)/i);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}
