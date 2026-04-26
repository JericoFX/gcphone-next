/**
 * Native WebRTC Peer Connection Manager
 *
 * Uses RTCPeerConnection directly with FiveM events for signaling.
 * No external signaling server — SDP offer/answer and ICE candidates
 * are relayed through the FiveM server via NUI callbacks.
 *
 * Supports:
 * - 1-on-1 video calls (single peer connection)
 * - 1-to-many live streaming (broadcaster creates connection per viewer)
 */

import { fetchNui } from './fetchNui';

// ── State ──

let connections = new Map<string, RTCPeerConnection>();
let localStream: MediaStream | null = null;
let callTimeoutId: ReturnType<typeof setTimeout> | null = null;
let callStartTime: number | null = null;
let maxDuration: number = 0;
let sessionId: string | null = null;
let activeChannel: string | null = null;
const allowedPeers = new Set<string>();

let cachedIceServers: RTCIceServer[] | null = null;
let iceServersFetchedAt = 0;
const ICE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const INIT_TIMEOUT_MS = 15000;

// ── ICE Server Management ──

function isValidIceServer(entry: unknown): entry is RTCIceServer {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  const urls = e.urls;
  if (typeof urls === 'string') return /^(stun|turn|turns):/.test(urls);
  if (Array.isArray(urls)) return urls.every((u) => typeof u === 'string' && /^(stun|turn|turns):/.test(u));
  return false;
}

async function getIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();
  if (cachedIceServers && now - iceServersFetchedAt < ICE_CACHE_TTL_MS) {
    return cachedIceServers;
  }
  try {
    const servers = await fetchNui<RTCIceServer[]>('getWebRTCIceServers', undefined, []);
    if (Array.isArray(servers)) {
      const valid = servers.filter(isValidIceServer);
      if (valid.length > 0) {
        cachedIceServers = valid;
        iceServersFetchedAt = now;
        return valid;
      }
    }
  } catch {}
  return [{ urls: 'stun:stun.l.google.com:19302' }];
}

// ── Handlers ──

export interface PeerHandlers {
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onRemoteDisconnected?: (peerId: string) => void;
  onCallTimeout?: () => void;
  onError?: (error: string) => void;
}

export interface PeerSignal {
  type: 'offer' | 'answer' | 'candidate';
  data: string;
  fromPeerId: string;
  channel: string;
}

let handlers: PeerHandlers = {};

// ── Session ID ──

function generateSessionId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_ID_RE = /^[0-9a-f]{32}$/;

export function isValidPeerId(id: unknown): id is string {
  return typeof id === 'string' && SESSION_ID_RE.test(id);
}

// ── RTCPeerConnection Factory ──

async function createPeerConnection(remotePeerId: string, signalingChannel: string): Promise<RTCPeerConnection> {
  const iceServers = await getIceServers();

  const pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      void fetchNui('webrtcSignal', {
        channel: signalingChannel,
        targetPeerId: remotePeerId,
        type: 'candidate',
        data: JSON.stringify(event.candidate.toJSON()),
      }, true);
    }
  };

  pc.ontrack = (event) => {
    if (event.streams[0]) {
      handlers.onRemoteStream?.(remotePeerId, event.streams[0]);
    }
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === 'failed') {
      connections.delete(remotePeerId);
      handlers.onError?.('ICE_FAILED');
      handlers.onRemoteDisconnected?.(remotePeerId);
    } else if (state === 'closed') {
      connections.delete(remotePeerId);
      handlers.onRemoteDisconnected?.(remotePeerId);
    }
    // 'disconnected' is transient — may recover, do not clean up
  };

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }

  connections.set(remotePeerId, pc);
  return pc;
}

// ── Public API ──

export async function initSession(maxDurationSeconds?: number, eventHandlers?: PeerHandlers): Promise<string> {
  handlers = eventHandlers || {};

  disconnectAll();

  // Invalidate ICE cache on new session to pick up fresh TURN credentials
  cachedIceServers = null;

  console.log('[peerManager] Fetching ICE servers...');
  const icePromise = getIceServers();
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('ICE server fetch timeout')), INIT_TIMEOUT_MS),
  );
  const iceServers = await Promise.race([icePromise, timeoutPromise]);
  console.log('[peerManager] ICE servers:', iceServers.length, 'entries');
  if (!iceServers.length) {
    throw new Error('No ICE servers available');
  }

  sessionId = generateSessionId();
  callStartTime = Date.now();
  maxDuration = (maxDurationSeconds && maxDurationSeconds > 0) ? maxDurationSeconds : 300;

  if (maxDuration > 0) {
    callTimeoutId = setTimeout(() => {
      handlers.onCallTimeout?.();
      disconnectAll();
    }, maxDuration * 1000);
  }

  return sessionId;
}

export function getSessionId(): string | null {
  return sessionId;
}

export function getActiveChannel(): string | null {
  return activeChannel;
}

export function getCallRemainingTime(): number {
  if (!callStartTime || maxDuration <= 0) return 0;
  const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
  return Math.max(0, maxDuration - elapsed);
}

export function allowPeer(remotePeerId: string) {
  if (remotePeerId && typeof remotePeerId === 'string') {
    allowedPeers.add(remotePeerId);
  }
}

export async function registerPeerSession(channel: string): Promise<string | null> {
  if (!sessionId || !channel) return null;
  activeChannel = channel;
  await fetchNui('webrtcRegisterSession', { sessionId, channel }, true);
  return sessionId;
}

export async function connectPeer(remotePeerId: string, signalingChannel = activeChannel || ''): Promise<void> {
  if (!signalingChannel) return;
  allowPeer(remotePeerId);
  await createOffer(remotePeerId, signalingChannel);
}

// ── Create Offer (caller side) ──

export async function createOffer(remotePeerId: string, signalingChannel: string): Promise<void> {
  if (!sessionId || !isValidPeerId(remotePeerId)) return;

  allowPeer(remotePeerId);
  const pc = await createPeerConnection(remotePeerId, signalingChannel);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await fetchNui('webrtcSignal', {
    channel: signalingChannel,
    targetPeerId: remotePeerId,
    type: 'offer',
    data: JSON.stringify(offer),
    fromPeerId: sessionId,
  }, true);
}

// ── Handle incoming signal from FiveM event ──

export async function handleSignal(signal: PeerSignal): Promise<void> {
  if (!sessionId) return;

  const { type, data, fromPeerId, channel } = signal;
  if (activeChannel && channel !== activeChannel) {
    console.warn('[peerManager] Signal for inactive channel:', channel);
    return;
  }
  if (!fromPeerId || !allowedPeers.has(fromPeerId)) {
    console.warn('[peerManager] Signal from unauthorized peer:', fromPeerId);
    return;
  }

  try {
    if (type === 'offer') {
      const pc = await createPeerConnection(fromPeerId, channel);
      const offer = JSON.parse(data) as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetchNui('webrtcSignal', {
        channel,
        targetPeerId: fromPeerId,
        type: 'answer',
        data: JSON.stringify(answer),
        fromPeerId: sessionId,
      }, true);
    } else if (type === 'answer') {
      const pc = connections.get(fromPeerId);
      if (!pc) return;
      const answer = JSON.parse(data) as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } else if (type === 'candidate') {
      const pc = connections.get(fromPeerId);
      if (!pc) return;
      const candidate = JSON.parse(data) as RTCIceCandidateInit;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (e) {
    console.warn('[peerManager] Signal handling error from', fromPeerId, e);
    disconnectPeer(fromPeerId);
  }
}

export async function handlePeerSignal(signal: PeerSignal): Promise<void> {
  await handleSignal(signal);
}

// ── Media Management ──

export function setLocalStream(stream: MediaStream | null) {
  localStream = stream;
}

export async function publishCanvasAsVideo(canvas: HTMLCanvasElement, fps = 24): Promise<MediaStream> {
  const stream = canvas.captureStream(fps);
  localStream = stream;
  return stream;
}

export function unpublishCanvasVideo() {
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
}

export async function enableMicrophone(): Promise<void> {
  if (!localStream) {
    localStream = new MediaStream();
  }

  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { autoGainControl: true, noiseSuppression: true, echoCancellation: true },
    });
    for (const track of audioStream.getAudioTracks()) {
      localStream.addTrack(track);
    }
  } catch (e) {
    console.warn('[peerManager] Mic not available:', e);
  }
}

export function setMicrophoneEnabled(enabled: boolean) {
  if (!localStream) return;
  for (const track of localStream.getAudioTracks()) {
    track.enabled = enabled;
  }
}

// ── Cleanup ──

export function disconnectPeer(remotePeerId: string) {
  const pc = connections.get(remotePeerId);
  if (pc) {
    try { pc.close(); } catch {}
    connections.delete(remotePeerId);
  }
}

export function disconnectAll() {
  if (callTimeoutId) {
    clearTimeout(callTimeoutId);
    callTimeoutId = null;
  }

  for (const pc of connections.values()) {
    try { pc.close(); } catch {}
  }
  connections.clear();
  allowedPeers.clear();

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  sessionId = null;
  activeChannel = null;
  callStartTime = null;
  maxDuration = 0;
  handlers = {};
}

export function getActiveConnectionCount(): number {
  return connections.size;
}
