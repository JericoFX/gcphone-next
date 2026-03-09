import { fetchNui } from './fetchNui';

export interface LiveKitTokenResponse {
  success: boolean;
  token?: string;
  url?: string;
  roomName?: string;
  identity?: string;
  maxDuration?: number;
  error?: string;
}

export function fetchLiveKitToken(roomName: string, publish = true, maxDuration?: number) {
  return fetchNui<LiveKitTokenResponse>(
    'livekitGetToken',
    { roomName, publish, maxDuration: maxDuration ?? 300 },
    { success: false, error: 'TOKEN_ERROR' }
  );
}

export interface SocketTokenResponse {
  success: boolean;
  token?: string;
  host?: string;
  error?: string;
}

export function fetchSocketToken(payload?: Record<string, unknown>) {
  return fetchNui<SocketTokenResponse>(
    'socketGetToken',
    payload || {},
    { success: false, error: 'TOKEN_ERROR' }
  );
}
