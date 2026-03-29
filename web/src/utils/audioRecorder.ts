/**
 * Audio Recorder utility — captures microphone audio as webm/opus.
 * Used by Messages voice messages and WaveChat voice messages.
 *
 * Can produce either:
 *  - base64 string (for inline DB storage via NUI callback)
 *  - Blob (for upload to external API like fivemanage)
 */

export interface AudioRecording {
  blob: Blob;
  base64: string;
  durationMs: number;
  sizeBytes: number;
}

export interface AudioRecorderHandle {
  stop: () => void;
  cancel: () => void;
}

const MAX_DURATION_MS = 30_000;
const MIN_SIZE_BYTES = 100;
const MAX_SIZE_BYTES = 153_600;

export async function startAudioRecording(
  onComplete: (recording: AudioRecording) => void,
  onError?: (error: string) => void,
  maxDurationMs = MAX_DURATION_MS,
): Promise<AudioRecorderHandle> {
  let cancelled = false;
  let stream: MediaStream;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { autoGainControl: false, noiseSuppression: true, echoCancellation: false },
    });
  } catch {
    onError?.('MIC_UNAVAILABLE');
    return { stop: () => {}, cancel: () => {} };
  }

  const chunks: Blob[] = [];
  const startTime = Date.now();

  const recorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus',
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());

    if (cancelled) return;

    const durationMs = Date.now() - startTime;
    const blob = new Blob(chunks, { type: 'audio/webm' });

    if (blob.size < MIN_SIZE_BYTES) {
      onError?.('TOO_SHORT');
      return;
    }

    if (blob.size > MAX_SIZE_BYTES) {
      onError?.('TOO_LARGE');
      return;
    }

    // Convert to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip data URI prefix: "data:audio/webm;codecs=opus;base64,..."
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.substring(commaIdx + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    onComplete({
      blob,
      base64,
      durationMs,
      sizeBytes: blob.size,
    });
  };

  recorder.start(100);

  // Auto-stop after max duration
  const timeout = setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop();
  }, maxDurationMs);

  return {
    stop: () => {
      clearTimeout(timeout);
      if (recorder.state === 'recording') recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      clearTimeout(timeout);
      if (recorder.state === 'recording') recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/**
 * Upload an audio blob via server proxy or direct (for custom providers).
 * Returns the URL of the uploaded file, or null on failure.
 */
export async function uploadAudioBlob(
  blob: Blob,
  config: { url?: string; field?: string; headers?: Record<string, string>; useProxy?: boolean },
  fetchNuiFn?: <T>(event: string, data: unknown, fallback: T) => Promise<T>,
): Promise<string | null> {
  try {
    if (config.useProxy && fetchNuiFn) {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
        reader.readAsDataURL(blob);
      });
      const result = await fetchNuiFn<{ url?: string; error?: string }>(
        'proxyUpload', { base64, filename: 'voice.webm', contentType: 'audio/webm' }, { error: 'PROXY_FAILED' }
      );
      return result?.url || null;
    }

    if (!config.url) return null;

    const headers = new Headers();
    if (config.headers) {
      for (const [k, v] of Object.entries(config.headers)) headers.append(k, v);
    }

    const formData = new FormData();
    formData.append(config.field || 'file', blob, 'voice.webm');

    const resp = await fetch(config.url, { method: 'POST', headers, body: formData });
    if (!resp.ok) return null;

    const json = await resp.json();
    return json?.data?.url || json?.url || json?.link || null;
  } catch {
    return null;
  }
}
