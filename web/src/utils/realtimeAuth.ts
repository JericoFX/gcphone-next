import { fetchNui } from './fetchNui';

export interface LiveKitTokenResponse {
  success: boolean;
  token?: string;
  url?: string;
  roomName?: string;
  identity?: string;
  error?: string;
}

export interface SocketTokenResponse {
  success: boolean;
  token?: string;
  host?: string;
  error?: string;
}

export function fetchLiveKitToken(roomName: string, publish = true) {
  return fetchNui<LiveKitTokenResponse>(
    'livekitGetToken',
    { roomName, publish },
    { success: false, error: 'TOKEN_ERROR' }
  );
}

export function fetchSocketToken() {
  return fetchNui<SocketTokenResponse>(
    'socketGetToken',
    {},
    { success: false, error: 'TOKEN_ERROR' }
  );
}
