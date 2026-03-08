import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { getStoredLanguage, t } from '../../../i18n';
import { uiPrompt } from '../../../utils/uiDialog';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useNuiEvent } from '../../../utils/useNui';
import styles from './CameraApp.module.scss';

type CameraEffect = 'normal' | 'noir' | 'vivid' | 'warm';
type CameraTarget = 'snap-post' | 'snap-story' | 'snap-avatar' | 'chirp' | 'chirp-avatar' | 'clips' | 'clips-avatar' | '';

interface EffectConfig {
  id: CameraEffect;
  label: string;
  className: string;
}

const EFFECTS: EffectConfig[] = [
  { id: 'normal', label: 'Normal', className: styles.filterNormal },
  { id: 'noir', label: 'Noir', className: styles.filterNoir },
  { id: 'vivid', label: 'Vivid', className: styles.filterVivid },
  { id: 'warm', label: 'Warm', className: styles.filterWarm },
];

function targetLabel(target: CameraTarget) {
  if (target === 'snap-post') return 'Snap Post';
  if (target === 'snap-story') return 'Snap Story';
  if (target === 'snap-avatar') return 'Avatar';
  if (target === 'chirp') return 'Chirp';
  if (target === 'chirp-avatar') return 'Avatar';
  if (target === 'clips') return 'Clips';
  if (target === 'clips-avatar') return 'Avatar';
  return 'Foto';
}

export function CameraApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const [effect, setEffect] = createSignal<CameraEffect>('normal');
  const [fov, setFov] = createSignal(52);
  const [blur, setBlur] = createSignal(0);
  const [lastUrl, setLastUrl] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [target, setTarget] = createSignal<CameraTarget>('');
  const [flash, setFlash] = createSignal(true);
  const [selfie, setSelfie] = createSignal(false);
  const [frozen, setFrozen] = createSignal(false);
  const [landscape, setLandscape] = createSignal(false);
  const [flashlight, setFlashlight] = createSignal(false);
  const [flashlightSupported, setFlashlightSupported] = createSignal(false);
  const [quickZooms, setQuickZooms] = createSignal<number[]>([30, 52, 78]);
  const [videoSupported, setVideoSupported] = createSignal(false);
  const [sessionReady, setSessionReady] = createSignal(false);
  const [isRecording, setIsRecording] = createSignal(false);

  useNuiEvent('cameraSessionClosed', () => {
    setSessionReady(false);
    router.goBack();
  });

  createEffect(() => {
    const params = router.params();
    const nextTarget = sanitizeText(String(params.target || ''), 24);
    if (
      nextTarget === 'snap-post' ||
      nextTarget === 'snap-story' ||
      nextTarget === 'snap-avatar' ||
      nextTarget === 'chirp' ||
      nextTarget === 'clips'
    ) {
      setTarget(nextTarget as CameraTarget);
    } else {
      setTarget('');
    }
  });

  createEffect(() => {
    if (target() === 'clips' && !landscape()) {
      setLandscape(true);
    }
  });

  const closeCamera = async () => {
    await fetchNui('stopCameraSession', {}, true);
    setSessionReady(false);
    router.goBack();
  };

  usePhoneKeyHandler({
    Backspace: () => {
      void closeCamera();
    },
  });

  onMount(async () => {
    const capabilities = await fetchNui<{ flashlight?: boolean; quickZooms?: number[]; video?: boolean }>('cameraGetCapabilities', {}, { flashlight: false, quickZooms: [30, 52, 78], video: false });
    setFlashlightSupported(capabilities?.flashlight === true);
    setQuickZooms((capabilities?.quickZooms || [30, 52, 78]).map((value) => Number(value)).filter((value) => Number.isFinite(value)));
    setVideoSupported(capabilities?.video === true);

    await fetchNui('startCameraSession', {
      effect: effect(),
      fov: fov(),
      blur: blur(),
      flash: flash(),
      selfie: selfie(),
      frozen: frozen(),
      landscape: landscape(),
    }, true);
    setSessionReady(true);
  });

  onCleanup(() => {
    void fetchNui('stopCameraSession', {}, true);
    setSessionReady(false);
  });

  createEffect(() => {
    if (!sessionReady()) return;
    void fetchNui('updateCameraSession', {
      effect: effect(),
      fov: fov(),
      blur: blur(),
      flash: flash(),
      selfie: selfie(),
      frozen: frozen(),
      landscape: landscape(),
    }, true);
  });

  const toggleFreeze = async () => {
    const result = await fetchNui<{ success?: boolean; frozen?: boolean }>('cameraSetFreeze', { enabled: !frozen() }, { success: true, frozen: !frozen() });
    if (result?.success) {
      setFrozen(result.frozen === true);
    }
  };

  const toggleLandscape = async () => {
    const result = await fetchNui<{ success?: boolean; landscape?: boolean }>('cameraSetLandscape', { enabled: !landscape() }, { success: true, landscape: !landscape() });
    if (result?.success) {
      setLandscape(result.landscape === true);
    }
  };

  const applyQuickZoom = async (index: number) => {
    const result = await fetchNui<{ success?: boolean; fov?: number }>('cameraSetQuickZoom', { index }, { success: true, fov: fov() });
    if (result?.success && typeof result.fov === 'number') {
      setFov(Math.round(result.fov));
    }
  };

  const toggleFlashlight = async () => {
    if (!flashlightSupported()) return;
    const nextState = !flashlight();
    const result = await fetchNui<{ success?: boolean; enabled?: boolean }>('cameraToggleFlashlight', { enabled: nextState }, { success: true, enabled: nextState });
    if (result?.success) {
      setFlashlight(result.enabled === true);
    }
  };

  const takePhoto = async () => {
    if (busy()) return;
    setBusy(true);
    setError('');

    const storage = await fetchNui<{ provider?: string; uploadUrl?: string; uploadField?: string; customUploadUrl?: string; customUploadField?: string }>('getStorageConfig', undefined, {
      provider: 'custom',
      uploadUrl: '',
      uploadField: 'files[]',
    });

    const provider = String(storage?.provider || 'custom');

    const result = await fetchNui<{ url?: string; error?: string }>('captureCameraSession', {
      provider,
      url: storage?.uploadUrl || storage?.customUploadUrl || '',
      field: storage?.uploadField || storage?.customUploadField || 'files[]',
    }, { url: '' });

    const mediaUrl = sanitizeMediaUrl(result?.url);
    if (!mediaUrl) {
      setBusy(false);
      if (result?.error === 'upload_not_configured') {
        setError('Subida no configurada');
      } else {
        setError('Captura cancelada');
      }
      return;
    }

    setLastUrl(mediaUrl);

    if (target() === 'snap-post') {
      await fetchNui('snapPublishPost', {
        mediaUrl,
        mediaType: 'image',
      });
      router.navigate('snap');
    } else if (target() === 'snap-story') {
      await fetchNui('snapPublishStory', {
        mediaUrl,
        mediaType: 'image',
      });
      router.navigate('snap');
    } else if (target() === 'snap-avatar') {
      router.navigate('snap', { avatarMedia: mediaUrl, openProfile: '1' });
    } else if (target() === 'chirp-avatar') {
      router.navigate('chirp', { avatarMedia: mediaUrl, openProfile: '1' });
    } else if (target() === 'clips-avatar') {
      router.navigate('clips', { avatarMedia: mediaUrl, openProfile: '1' });
    } else if (target() === 'chirp') {
      await fetchNui('chirpPublishTweet', {
        content: 'Nueva foto',
        mediaUrl,
      });
      router.navigate('chirp');
    } else if (target() === 'clips') {
      setError('Clips requiere video');
    }

    setBusy(false);
  };

  const shareSnapPost = async () => {
    const mediaUrl = sanitizeMediaUrl(lastUrl());
    if (!mediaUrl) return;
    await fetchNui('snapPublishPost', {
      mediaUrl,
      mediaType: 'image',
    });
    router.navigate('snap');
  };

  const shareSnapStory = async () => {
    const mediaUrl = sanitizeMediaUrl(lastUrl());
    if (!mediaUrl) return;
    await fetchNui('snapPublishStory', {
      mediaUrl,
      mediaType: 'image',
    });
    router.navigate('snap');
  };

  const shareChirp = async () => {
    const mediaUrl = sanitizeMediaUrl(lastUrl());
    if (!mediaUrl) return;
    await fetchNui('chirpPublishTweet', {
      content: 'Nueva foto',
      mediaUrl,
    });
    router.navigate('chirp');
  };

  const publishClipFromUrl = async () => {
    const input = await uiPrompt('URL del video (mp4/webm/mov)', { title: 'Publicar clip' });
    const videoUrl = sanitizeMediaUrl(input);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      if (input && input.trim()) {
        setError('URL invalida');
      }
      return;
    }

    await fetchNui('storeMediaUrl', { url: videoUrl }, { success: false });
    const result = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: videoUrl,
    }, { success: false });

    if (result?.success) {
      router.navigate('clips');
      return;
    }

    setError('No se pudo publicar');
  };

  const publishClipFromGallery = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>('getGallery', undefined, []);
    const picked = (gallery || []).find((entry) => {
      const mediaUrl = sanitizeMediaUrl(entry?.url);
      return mediaUrl && resolveMediaType(mediaUrl) === 'video';
    });

    const videoUrl = sanitizeMediaUrl(picked?.url);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      setError('No hay videos');
      return;
    }

    const result = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: videoUrl,
    }, { success: false });

    if (result?.success) {
      router.navigate('clips');
      return;
    }

    setError('No se pudo publicar');
  };

  const publishClipFromRecording = async () => {
    setIsRecording(true);
    const storage = await fetchNui<{ uploadUrl?: string; uploadField?: string; customUploadUrl?: string; customUploadField?: string }>('getStorageConfig', undefined, {
      uploadUrl: '',
      uploadField: 'files[]',
      customUploadUrl: '',
      customUploadField: 'files[]',
    });

    const result = await fetchNui<{ url?: string; error?: string }>('captureCameraVideoSession', {
      url: storage?.uploadUrl || storage?.customUploadUrl || '',
      field: storage?.uploadField || storage?.customUploadField || 'files[]',
      durationSeconds: 20,
    }, { url: '', error: 'video_not_supported' });

    setIsRecording(false);

    const videoUrl = sanitizeMediaUrl(result?.url);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      if (result?.error === 'video_not_supported') {
        setError('Video no disponible');
      } else {
        setError('Error al grabar');
      }
      return;
    }

    await fetchNui('storeMediaUrl', { url: videoUrl }, { success: false });
    const publish = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: videoUrl,
    }, { success: false });

    if (publish?.success) {
      router.navigate('clips');
      return;
    }

    setError('No se pudo publicar');
  };

  // Vertical slider handlers
  const handleFovChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value);
    setFov(value);
  };

  const handleBlurChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value);
    setBlur(value);
  };

  return (
    <div class={styles.app}>
      {/* Left vertical slider - FOV */}
      <div class={styles.leftSlider}>
        <span class={styles.sliderLabel}>FOV</span>
        <input
          type="range"
          min="25"
          max="90"
          value={fov()}
          onInput={handleFovChange}
          class={styles.verticalSlider}
        />
        <span class={styles.sliderValue}>{fov()}°</span>
      </div>

      {/* Right vertical slider - Blur */}
      <div class={styles.rightSlider}>
        <span class={styles.sliderLabel}>BLUR</span>
        <input
          type="range"
          min="0"
          max="70"
          value={blur()}
          onInput={handleBlurChange}
          class={styles.verticalSlider}
        />
        <span class={styles.sliderValue}>{blur()}</span>
      </div>

      <div class={styles.preview} classList={{ [styles.previewLandscapeShell]: landscape() }}>
        {/* Feed layer with effects */}
        <div
          class={styles.feedLayer}
          classList={{
            [styles.previewNoir]: effect() === 'noir',
            [styles.previewVivid]: effect() === 'vivid',
            [styles.previewWarm]: effect() === 'warm',
            [styles.previewSelfie]: selfie(),
          }}
        />

        {/* Recording indicator */}
        <Show when={isRecording()}>
          <div class={styles.recordingIndicator}>
            <div class={styles.recordingDot} />
            <span class={styles.recordingText}>REC</span>
          </div>
        </Show>

        {/* Top bar - compact */}
        <div class={styles.topBar}>
          <div class={styles.topLeft}>
            <button
              class={styles.iconBtn}
              classList={{ [styles.iconBtnActive]: flash() }}
              onClick={() => setFlash((v) => !v)}
              title={t('camera.flash', language())}
            >
              ⚡
            </button>
            <Show when={flashlightSupported()}>
              <button
                class={styles.iconBtn}
                classList={{ [styles.iconBtnActive]: flashlight() }}
                onClick={() => void toggleFlashlight()}
                title="Linterna"
              >
                🔦
              </button>
            </Show>
            <button
              class={styles.iconBtn}
              classList={{ [styles.iconBtnActive]: frozen() }}
              onClick={() => void toggleFreeze()}
              title="Congelar"
            >
              🧊
            </button>
          </div>

          <div class={styles.topCenter}>
            <span class={styles.brandLabel}>CineCam</span>
            <span class={styles.modeLabel}>{targetLabel(target())}</span>
          </div>

          <div class={styles.topRight}>
            <button
              class={styles.iconBtn}
              classList={{ [styles.iconBtnActive]: selfie() }}
              onClick={() => setSelfie((v) => !v)}
              title="Selfie"
            >
              🔄
            </button>
            <button
              class={styles.iconBtn}
              classList={{ [styles.iconBtnActive]: landscape() }}
              onClick={() => void toggleLandscape()}
              title="Landscape"
            >
              ▭
            </button>
            <button
              class={styles.iconBtn}
              onClick={() => router.navigate('gallery')}
              title={t('camera.gallery', language())}
            >
              🖼
            </button>
            <button
              class={styles.iconBtn}
              onClick={() => void closeCamera()}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Compact filter row at top */}
        <div class={styles.filterRow}>
          <For each={EFFECTS}>
            {(item) => (
              <button
                class={styles.filterChip}
                classList={{ [styles.filterChipActive]: effect() === item.id }}
                onClick={() => setEffect(item.id)}
              >
                <span class={styles.filterChipDot} classList={{ [item.className]: true }} />
                <span class={styles.filterChipLabel}>{item.label}</span>
              </button>
            )}
          </For>
        </div>

        <div class={styles.quickZoomRow}>
          <For each={quickZooms()}>
            {(zoom, index) => {
              const label = `${(52 / zoom).toFixed(1).replace('.0', '')}x`;
              return (
                <button
                  class={styles.quickZoomBtn}
                  classList={{ [styles.quickZoomBtnActive]: Math.abs(fov() - zoom) <= 2 }}
                  onClick={() => void applyQuickZoom(index() + 1)}
                >
                  {label}
                </button>
              );
            }}
          </For>
        </div>

        {/* Clips row (conditional) */}
        <Show when={target() === 'clips'}>
          <div class={styles.clipsRow}>
            <Show when={videoSupported()} fallback={<button class="ios-btn" disabled>Video no disponible</button>}>
              <button class="ios-btn" onClick={() => void publishClipFromRecording()}>
                {t('camera.record_clip', language())}
              </button>
            </Show>
            <button class="ios-btn" onClick={() => void publishClipFromGallery()}>
              {t('camera.gallery_video', language())}
            </button>
            <button class="ios-btn ios-btn-primary" onClick={() => void publishClipFromUrl()}>
              {t('camera.publish_clip', language())}
            </button>
          </div>
        </Show>
      </div>

      {/* Bottom controls */}
      <div class={styles.bottomControls}>
        {/* Shutter button */}
        <button
          class={styles.shutterBtn}
          onClick={() => void takePhoto()}
          disabled={busy()}
        >
          <div class={styles.shutterInner} />
        </button>
      </div>

      {/* Error display */}
      <Show when={error()}>
        <div class={styles.error}>{error()}</div>
      </Show>

      {/* Last capture preview */}
      <Show when={lastUrl()}>
        <div class={styles.lastRow}>
          <img src={lastUrl()} alt="Última" />
          <div class={styles.lastActions}>
            <button onClick={() => void shareSnapPost()}>Snap Post</button>
            <button onClick={() => void shareSnapStory()}>Snap Story</button>
            <button onClick={() => void shareChirp()}>Chirp</button>
          </div>
        </div>
      </Show>
    </div>
  );
}
