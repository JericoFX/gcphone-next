import { createSignal, onCleanup } from 'solid-js';
import { createGameView, type GameView } from '../utils/gameRender';
import {
  initSession,
  publishCanvasAsVideo,
  unpublishCanvasVideo,
  disconnectAll,
  enableMicrophone,
  setMicrophoneEnabled,
} from '../utils/peerManager';
import { fetchNui } from '../utils/fetchNui';
import type { MediaTrackEntry, ViewerHandlers, UseLiveCameraOptions } from './liveCameraTypes';

export function useLiveCamera(options?: UseLiveCameraOptions) {
  const fps = options?.fps ?? 24;
  const aspect = options?.aspect ?? 9 / 16;
  const maxSeconds = options?.maxSeconds ?? 300;

  // ── State ──
  let gameView: GameView | undefined;
  let canvas: HTMLCanvasElement | undefined;
  const tracks = new Map<string, MediaTrackEntry[]>();

  const [sessionId, setSessionId] = createSignal<string | null>(null);
  const [connected, setConnected] = createSignal(false);
  const [videoReady, setVideoReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [localIdentity, setLocalIdentity] = createSignal('');

  // ── Track Management ──

  function addTrack(peerId: string, entry: MediaTrackEntry) {
    const current = tracks.get(peerId) || [];
    for (const prev of current) {
      if (prev.sid === entry.sid) {
        prev.element.remove();
      }
    }
    const filtered = current.filter((e) => e.sid !== entry.sid);
    tracks.set(peerId, [...filtered, entry]);
  }

  function removeTrack(peerId: string, sid?: string) {
    if (!tracks.has(peerId)) return;

    if (!sid) {
      for (const entry of tracks.get(peerId) || []) {
        entry.element.remove();
      }
      tracks.delete(peerId);
      return;
    }

    const next = (tracks.get(peerId) || []).filter((entry) => {
      if (entry.sid !== sid) return true;
      entry.element.remove();
      return false;
    });

    if (next.length > 0) {
      tracks.set(peerId, next);
    } else {
      tracks.delete(peerId);
    }
  }

  function getTracksFor(peerId: string): MediaTrackEntry[] {
    return tracks.get(peerId) || [];
  }

  function getAllTracks(): Map<string, MediaTrackEntry[]> {
    return tracks;
  }

  function renderTracksTo(peerId: string, container: HTMLElement) {
    while (container.firstChild) container.removeChild(container.firstChild);

    const entries = tracks.get(peerId) || [];
    const videoEntry = entries.find((e) => e.kind === 'video');
    const audioEntries = entries.filter((e) => e.kind === 'audio');

    if (videoEntry) {
      container.appendChild(videoEntry.element);
    }

    for (const audio of audioEntries) {
      audio.element.style.display = 'none';
      container.appendChild(audio.element);
    }
  }

  // ── Broadcaster: Canvas + GameView ──

  async function startCamera(): Promise<boolean> {
    if (canvas || gameView) return false;
    try {
      canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.top = '-9999px';
      canvas.style.left = '-9999px';
      document.body.appendChild(canvas);

      gameView = createGameView(canvas);
      gameView.resizeByAspect(aspect);

      const success = await fetchNui<{ success: boolean }>('startLiveSession', {}, { success: true });
      setVideoReady(true);
      return success?.success !== false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Camera start failed';
      setError(msg);
      if (!gameView && canvas) canvas.remove();
      return false;
    }
  }

  async function publishVideo(): Promise<void> {
    if (!canvas) throw new Error('Camera not started');
    await publishCanvasAsVideo(canvas, fps);
    setConnected(true);
  }

  function unpublishVideo() {
    unpublishCanvasVideo();
    setConnected(false);
  }

  function getPreviewStream(): MediaStream | null {
    if (!canvas) return null;
    return canvas.captureStream(fps);
  }

  function createPreviewElement(): HTMLVideoElement | null {
    const stream = getPreviewStream();
    if (!stream) return null;
    const el = document.createElement('video');
    el.srcObject = stream;
    el.autoplay = true;
    el.playsInline = true;
    el.muted = true;
    return el;
  }

  // ── Viewer: WebRTC Session ──

  async function initViewer(handlers: ViewerHandlers): Promise<string> {
    try {
      const sid = await initSession(maxSeconds, {
        onRemoteStream: handlers.onRemoteStream,
        onRemoteDisconnected: handlers.onRemoteDisconnected,
        onCallTimeout: handlers.onTimeout,
      });
      setSessionId(sid);
      setLocalIdentity(sid);
      return sid;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Session init failed';
      setError(msg);
      throw e;
    }
  }

  // ── Audio ──

  async function enableMic(): Promise<void> {
    await enableMicrophone();
  }

  function setMicEnabled(on: boolean) {
    setMicrophoneEnabled(on);
  }

  // ── Cleanup ──

  function stopCamera() {
    unpublishCanvasVideo();

    if (gameView) {
      gameView.destroy();
      gameView.canvas.remove();
      gameView = undefined;
    }
    if (canvas) {
      canvas.remove();
      canvas = undefined;
    }

    disconnectAll();

    for (const entries of tracks.values()) {
      for (const entry of entries) {
        entry.element.remove();
      }
    }
    tracks.clear();

    void fetchNui('stopLiveSession', {}, true);

    setSessionId(null);
    setConnected(false);
    setVideoReady(false);
    setError(null);
    setLocalIdentity('');
  }

  onCleanup(() => stopCamera());

  return {
    sessionId,
    connected,
    videoReady,
    error,
    localIdentity,

    startCamera,
    stopCamera,
    publishVideo,
    unpublishVideo,
    getPreviewStream,
    createPreviewElement,

    initViewer,

    addTrack,
    removeTrack,
    getTracksFor,
    getAllTracks,
    renderTracksTo,

    enableMic,
    setMicEnabled,

    get canvasRef() { return canvas ?? null; },
    get gameViewRef() { return gameView ?? undefined; },
  };
}
