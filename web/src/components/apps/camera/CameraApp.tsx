import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { getStoredLanguage, t } from '../../../i18n';
import { uiPrompt } from '../../../utils/uiDialog';
import {
  resolveMediaType,
  sanitizeMediaUrl,
  sanitizeText,
} from '../../../utils/sanitize';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useNuiEvent } from '../../../utils/useNui';
import { createGameView, type GameView } from '../../../utils/gameRender';
import { isEnvBrowser } from '../../../utils/misc';
import styles from './CameraApp.module.scss';

type CameraEffect = 'normal' | 'noir' | 'vivid' | 'warm';
type CameraTarget =
  | 'snap-post'
  | 'snap-story'
  | 'snap-avatar'
  | 'chirp'
  | 'chirp-avatar'
  | 'chirp-rechirp'
  | 'clips'
  | 'clips-avatar'
  | '';

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
  if (target === 'chirp-rechirp') return 'ReChirp';
  if (target === 'clips') return 'Clips';
  if (target === 'clips-avatar') return 'Avatar';
  return 'Foto';
}

export function CameraApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const [effect, setEffect] = createSignal<CameraEffect>('normal');
  const [fov, setFov] = createSignal(52);
  const blur = () => 0;
  const [lastUrl, setLastUrl] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [target, setTarget] = createSignal<CameraTarget>('');
  const [flash, setFlash] = createSignal(true);
  const [selfie, setSelfie] = createSignal(false);
  const [landscape, setLandscape] = createSignal(false);
  const [quickZooms, setQuickZooms] = createSignal<number[]>([30, 52, 78]);
  const [videoSupported, setVideoSupported] = createSignal(false);
  const [sessionReady, setSessionReady] = createSignal(false);
  const [isRecording, setIsRecording] = createSignal(false);
  const [blurLevel, setBlurLevel] = createSignal(0);
  const [brightness, setBrightness] = createSignal(100);
  const [contrast, setContrast] = createSignal(100);
  const [controlsOpen, setControlsOpen] = createSignal(false);
  const [videoMode, setVideoMode] = createSignal(false);
  const [renderer, setRenderer] = createSignal<'webgl' | 'css'>('webgl');
  const [fovRange, setFovRange] = createSignal({ min: 25, max: 90, default_: 52 });
  let canvasRef: HTMLCanvasElement | undefined;
  let gameViewRef: GameView | null = null;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

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
      nextTarget === 'chirp-avatar' ||
      nextTarget === 'clips' ||
      nextTarget === 'clips-avatar'
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
    const capabilities = await fetchNui<{
      quickZooms?: number[];
      video?: boolean;
      renderer?: string;
      fov?: { min?: number; max?: number; default_?: number };
    }>('cameraGetCapabilities', {}, { quickZooms: [30, 52, 78], video: false, renderer: 'webgl' });
    setQuickZooms(
      (capabilities?.quickZooms || [30, 52, 78])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value)),
    );
    setVideoSupported(capabilities?.video === true);
    setRenderer(capabilities?.renderer === 'css' ? 'css' : 'webgl');
    if (capabilities?.fov) {
      setFovRange({
        min: capabilities.fov.min ?? 25,
        max: capabilities.fov.max ?? 90,
        default_: capabilities.fov.default_ ?? 52,
      });
    }

    await fetchNui(
      'startCameraSession',
      {
        effect: effect(),
        fov: fov(),
        blur: blur(),
        flash: flash(),
        selfie: selfie(),
        landscape: landscape(),
      },
      true,
    );
    setSessionReady(true);

    if (canvasRef && !isEnvBrowser()) {
      try {
        gameViewRef = createGameView(canvasRef);
        gameViewRef.resize(canvasRef.clientWidth, canvasRef.clientHeight);
      } catch (e) {
        console.warn('[CameraApp] GameRender init failed:', e);
      }
    }
  });

  onCleanup(() => {
    void fetchNui('stopCameraSession', {}, true);
    setSessionReady(false);
    if (gameViewRef) {
      gameViewRef.destroy();
      gameViewRef = null;
    }
    if (longPressTimer) clearTimeout(longPressTimer);
  });

  // Sync WebGL shader uniforms when controls change
  createEffect(() => {
    if (!gameViewRef || renderer() !== 'webgl') return;
    gameViewRef.setBlur(blurLevel() / 100);
    gameViewRef.setBrightness(brightness() / 100);
    gameViewRef.setContrast(contrast() / 100);
    const effectMap: Record<CameraEffect, number> = { normal: 0, noir: 1, vivid: 2, warm: 3 };
    gameViewRef.setEffect(effectMap[effect()] ?? 0);
  });

  // CSS filter fallback string
  const cssFilter = () => {
    if (renderer() !== 'css') return undefined;
    const parts: string[] = [];
    if (blurLevel() > 0) parts.push(`blur(${(blurLevel() / 100) * 4}px)`);
    if (brightness() !== 100) parts.push(`brightness(${brightness() / 100})`);
    if (contrast() !== 100) parts.push(`contrast(${contrast() / 100})`);
    if (effect() === 'noir') parts.push('grayscale(1) contrast(1.08)');
    else if (effect() === 'vivid') parts.push('saturate(1.3) contrast(1.08)');
    else if (effect() === 'warm') parts.push('sepia(0.24) saturate(1.15)');
    return parts.length ? parts.join(' ') : undefined;
  };

  const resetControls = () => {
    setBlurLevel(0);
    setBrightness(100);
    setContrast(100);
    setEffect('normal');
    setFov(fovRange().default_);
    void fetchNui('updateCameraSession', { effect: 'normal', fov: fovRange().default_, blur: 0, flash: flash(), selfie: selfie(), landscape: landscape() }, true);
  };

  // Long press shutter to toggle video mode
  const onShutterDown = () => {
    longPressTimer = setTimeout(() => {
      setVideoMode((v) => !v);
      longPressTimer = null;
    }, 600);
  };

  const onShutterUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      // Short press — take photo or toggle recording
      if (videoMode()) {
        if (isRecording()) {
          gameViewRef?.stopRecording();
          setIsRecording(false);
        } else if (gameViewRef) {
          setIsRecording(true);
          void gameViewRef.startRecording(async (blob, durationMs) => {
            setIsRecording(false);
            setBusy(true);
            try {
              // Get upload config from server (URL, headers, field name)
              const uploadCfg = await fetchNui<{
                url?: string; field?: string; headers?: Record<string, string>;
                successPath?: string; errorPath?: string;
              }>('getVideoUploadConfig', {}, { url: '', field: 'file' });

              if (!uploadCfg?.url) {
                setError(t('camera.error.upload_not_configured', language()));
                setBusy(false);
                return;
              }

              // Upload directly from NUI to the external API
              const headers = new Headers();
              if (uploadCfg.headers) {
                for (const [k, v] of Object.entries(uploadCfg.headers)) headers.append(k, v);
              }
              const formData = new FormData();
              formData.append(uploadCfg.field || 'file', blob, 'video.webm');

              const resp = await fetch(uploadCfg.url, { method: 'POST', headers, body: formData });
              if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
              const json = await resp.json();

              // Extract URL from response using configured path
              let videoUrl: string | undefined;
              if (uploadCfg.successPath) {
                let obj: unknown = json;
                for (const key of uploadCfg.successPath.split('.')) {
                  obj = (obj as Record<string, unknown>)?.[key];
                }
                videoUrl = typeof obj === 'string' ? obj : undefined;
              } else {
                videoUrl = json?.url || json?.data?.url || json?.link;
              }

              if (videoUrl) {
                setLastUrl(videoUrl);
                await fetchNui('storeMediaUrl', { url: videoUrl, type: 'video' }, { success: false });
              } else {
                setError(t('camera.error.record_failed', language()));
              }
            } catch {
              setError(t('camera.error.record_failed', language()));
            }
            setBusy(false);
          });
        }
      } else {
        void takePhoto();
      }
    }
  };

  createEffect(() => {
    if (!sessionReady()) return;
    void fetchNui(
      'updateCameraSession',
      {
        effect: effect(),
        fov: fov(),
        blur: blur(),
        flash: flash(),
        selfie: selfie(),
        landscape: landscape(),
      },
      true,
    );
  });

  const toggleLandscape = async () => {
    const result = await fetchNui<{ success?: boolean; landscape?: boolean }>(
      'cameraSetLandscape',
      { enabled: !landscape() },
      { success: true, landscape: !landscape() },
    );
    if (result?.success) {
      setLandscape(result.landscape === true);
    }
  };

  const applyQuickZoom = async (index: number) => {
    const values = quickZooms();
    const mockIndex = Math.max(0, Math.min(index - 1, values.length - 1));
    const mockFov = values[mockIndex] ?? fov();
    const result = await fetchNui<{ success?: boolean; fov?: number }>(
      'cameraSetQuickZoom',
      { index },
      { success: true, fov: mockFov },
    );
    if (result?.success && typeof result.fov === 'number') {
      setFov(Math.round(result.fov));
    }
  };

  const takePhoto = async () => {
    if (busy()) return;
    setBusy(true);
    setError('');

    const storage = await fetchNui<{
      provider?: string;
      uploadUrl?: string;
      uploadField?: string;
      customUploadUrl?: string;
      customUploadField?: string;
    }>('getStorageConfig', undefined, {
      provider: 'custom',
      uploadUrl: '',
      uploadField: 'files[]',
    });

    const provider = String(storage?.provider || 'custom');

    const result = await fetchNui<{ url?: string; error?: string }>(
      'captureCameraSession',
      {
        provider,
        url: storage?.uploadUrl || storage?.customUploadUrl || '',
        field: storage?.uploadField || storage?.customUploadField || 'files[]',
      },
      { url: '' },
    );

    const mediaUrl = sanitizeMediaUrl(result?.url);
    if (!mediaUrl) {
      setBusy(false);
      if (result?.error === 'upload_not_configured') {
        setError(t('camera.error.upload_not_configured', language()));
      } else {
        setError(t('camera.error.capture_cancelled', language()));
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
        content: t('camera.new_photo', language()),
        mediaUrl,
      });
      router.navigate('chirp');
    } else if (target() === 'chirp-rechirp') {
      router.navigate('chirp', {
        rechirpMedia: mediaUrl,
        openRechirp: '1',
        rechirpTweetId: String(router.params().rechirpTweetId || ''),
      });
    } else if (target() === 'clips') {
      setError(t('camera.error.clips_requires_video', language()));
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
      content: t('camera.new_photo', language()),
      mediaUrl,
    });
    router.navigate('chirp');
  };

  const publishClipFromUrl = async () => {
    const input = await uiPrompt(t('camera.prompt.video_url', language()), {
      title: t('camera.publish_clip', language()),
    });
    const videoUrl = sanitizeMediaUrl(input);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      if (input && input.trim()) {
        setError(t('camera.error.invalid_url', language()));
      }
      return false;
    }

    await fetchNui('storeMediaUrl', { url: videoUrl }, { success: false });
    const result = await fetchNui<{ success?: boolean }>(
      'clipsPublish',
      {
        mediaUrl: videoUrl,
      },
      { success: false },
    );

    if (result?.success) {
      router.navigate('clips');
      return true;
    }

    setError(t('camera.error.publish_failed', language()));
    return false;
  };

  const publishClipFromGallery = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>(
      'getGallery',
      undefined,
      [],
    );
    const picked = (gallery || []).find((entry) => {
      const mediaUrl = sanitizeMediaUrl(entry?.url);
      return mediaUrl && resolveMediaType(mediaUrl) === 'video';
    });

    const videoUrl = sanitizeMediaUrl(picked?.url);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      return false;
    }

    const result = await fetchNui<{ success?: boolean }>(
      'clipsPublish',
      {
        mediaUrl: videoUrl,
      },
      { success: false },
    );

    if (result?.success) {
      router.navigate('clips');
      return true;
    }

    setError(t('camera.error.publish_failed', language()));
    return false;
  };

  const publishClipFromRecording = async () => {
    setIsRecording(true);
    const storage = await fetchNui<{
      uploadUrl?: string;
      uploadField?: string;
      customUploadUrl?: string;
      customUploadField?: string;
      maxVideoDurationSeconds?: number;
    }>('getStorageConfig', undefined, {
      uploadUrl: '',
      uploadField: 'files[]',
      customUploadUrl: '',
      customUploadField: 'files[]',
    });
    const maxDuration = Math.max(
      5,
      Math.min(30, Number(storage?.maxVideoDurationSeconds || 30)),
    );

    const result = await fetchNui<{ url?: string; error?: string }>(
      'captureCameraVideoSession',
      {
        url: storage?.uploadUrl || storage?.customUploadUrl || '',
        field: storage?.uploadField || storage?.customUploadField || 'files[]',
        durationSeconds: maxDuration,
      },
      { url: '', error: 'video_not_supported' },
    );

    setIsRecording(false);

    const videoUrl = sanitizeMediaUrl(result?.url);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      if (result?.error === 'video_not_supported') {
        const galleryOk = await publishClipFromGallery();
        if (!galleryOk) {
          const urlOk = await publishClipFromUrl();
          if (!urlOk) {
            setError(t('camera.error.recording_unavailable', language()));
          }
        }
      } else {
        setError(t('camera.error.record_failed', language()));
      }
      return;
    }

    await fetchNui('storeMediaUrl', { url: videoUrl }, { success: false });
    const publish = await fetchNui<{ success?: boolean }>(
      'clipsPublish',
      {
        mediaUrl: videoUrl,
      },
      { success: false },
    );

    if (publish?.success) {
      router.navigate('clips');
      return;
    }

    setError(t('camera.error.publish_failed', language()));
  };

  const cycleEffect = () => {
    const order: CameraEffect[] = ['normal', 'noir', 'vivid', 'warm'];
    const current = order.indexOf(effect());
    const next = order[(current + 1) % order.length];
    setEffect(next);
  };

  const currentZoomLabel = createMemo(() => {
    const values = quickZooms();
    if (!values.length) return '1x';
    const nearest = values.reduce(
      (acc, value) =>
        Math.abs(value - fov()) < Math.abs(acc - fov()) ? value : acc,
      values[0],
    );
    return `${(52 / nearest).toFixed(1).replace('.0', '')}x`;
  });

  const cycleZoom = async () => {
    const values = quickZooms();
    if (!values.length) return;
    let nearestIndex = 0;
    let nearestDelta = Number.POSITIVE_INFINITY;
    for (let index = 0; index < values.length; index += 1) {
      const delta = Math.abs(values[index] - fov());
      if (delta < nearestDelta) {
        nearestDelta = delta;
        nearestIndex = index;
      }
    }
    const nextIndex = (nearestIndex + 1) % values.length;
    await applyQuickZoom(nextIndex + 1);
  };

  return (
    <div class={styles.app}>
      <div
        class={styles.preview}
        classList={{ [styles.previewLandscapeShell]: landscape() }}
      >
        <canvas
          ref={canvasRef}
          class={styles.feedLayer}
          classList={{
            [styles.previewSelfie]: selfie(),
          }}
          style={renderer() === 'css' ? { filter: cssFilter() } : undefined}
          width={window.innerWidth}
          height={window.innerHeight}
        />

        {/* Recording indicator */}
        <Show when={isRecording()}>
          <div class={styles.recordingIndicator}>
            <div class={styles.recordingDot} />
            <span class={styles.recordingText}>REC</span>
          </div>
        </Show>

        <div class={styles.topBar}>
          <div class={styles.topLeft}>
            <button
              class={styles.iconBtn}
              onClick={() => void closeCamera()}
              title={t('control.close', language())}
            >
              <img
                src='./img/icons_ios/ui-close.svg'
                alt=''
                draggable={false}
              />
            </button>
          </div>

          <div class={styles.topCenter}>
            <span class={styles.brandLabel}>CineCam</span>
            <span class={styles.modeLabel}>{targetLabel(target())}</span>
          </div>

          <div class={styles.topRight}>
            <button
              class={styles.iconBtn}
              onClick={() => router.navigate('gallery')}
              title={t('camera.gallery', language())}
            >
              <img src='./img/icons_ios/gallery.svg' alt='' draggable={false} />
            </button>
          </div>
        </div>

        <div class={styles.minimalRow}>
          <button
            class={styles.minimalBtn}
            classList={{ [styles.minimalBtnActive]: flash() }}
            onClick={() => setFlash((v) => !v)}
          >
            {t('camera.flash', language())}
          </button>
          <button
            class={styles.minimalBtn}
            classList={{ [styles.minimalBtnActive]: selfie() }}
            onClick={() => setSelfie((v) => !v)}
          >
            {t('camera.selfie', language())}
          </button>
          <button class={styles.minimalBtn} onClick={() => void cycleZoom()}>
            {currentZoomLabel()}
          </button>
          <button
            class={styles.minimalBtn}
            classList={{ [styles.minimalBtnActive]: controlsOpen() }}
            onClick={() => setControlsOpen((v) => !v)}
          >
            {t('camera.controls', language())}
          </button>
        </div>

        {/* Mode indicator */}
        <div class={styles.modeIndicator} classList={{ [styles.modeVideo]: videoMode() }}>
          {videoMode() ? t('camera.video', language()) : t('camera.photo', language())}
        </div>

        {/* Controls panel */}
        <Show when={controlsOpen()}>
          <div class={styles.controlsPanel}>
            <div class={styles.controlsHeader}>
              <span class={styles.controlsTitle}>{t('camera.controls', language())}</span>
              <button class={styles.controlsResetBtn} onClick={resetControls}>
                {t('camera.reset', language())}
              </button>
            </div>

            {/* Filter strip */}
            <div class={styles.controlsFilterStrip}>
              {EFFECTS.map((fx) => (
                <button
                  class={styles.filterChip}
                  classList={{ [styles.filterChipActive]: effect() === fx.id }}
                  onClick={() => setEffect(fx.id)}
                >
                  <span class={`${styles.filterChipDot} ${fx.className}`} />
                  <span class={styles.filterChipLabel}>
                    {t(`camera.filter.${fx.id}`, language())}
                  </span>
                </button>
              ))}
            </div>

            {/* FOV slider */}
            <div class={styles.sliderRow}>
              <span class={styles.sliderRowLabel}>{t('camera.fov', language())}</span>
              <input
                type="range"
                class={styles.horizontalSlider}
                min={fovRange().min}
                max={fovRange().max}
                step={1}
                value={fov()}
                onInput={(e) => {
                  const val = Number(e.currentTarget.value);
                  setFov(val);
                  void fetchNui('updateCameraSession', { effect: effect(), fov: val, blur: blurLevel(), flash: flash(), selfie: selfie(), landscape: landscape() }, true);
                }}
              />
              <span class={styles.sliderRowValue}>{fov()}</span>
            </div>

            {/* Blur slider */}
            <div class={styles.sliderRow}>
              <span class={styles.sliderRowLabel}>{t('camera.blur', language())}</span>
              <input
                type="range"
                class={styles.horizontalSlider}
                min={0}
                max={100}
                step={1}
                value={blurLevel()}
                onInput={(e) => setBlurLevel(Number(e.currentTarget.value))}
              />
              <span class={styles.sliderRowValue}>{blurLevel()}</span>
            </div>

            {/* Brightness slider */}
            <div class={styles.sliderRow}>
              <span class={styles.sliderRowLabel}>{t('camera.brightness', language())}</span>
              <input
                type="range"
                class={styles.horizontalSlider}
                min={20}
                max={200}
                step={1}
                value={brightness()}
                onInput={(e) => setBrightness(Number(e.currentTarget.value))}
              />
              <span class={styles.sliderRowValue}>{brightness()}</span>
            </div>

            {/* Contrast slider */}
            <div class={styles.sliderRow}>
              <span class={styles.sliderRowLabel}>{t('camera.contrast', language())}</span>
              <input
                type="range"
                class={styles.horizontalSlider}
                min={20}
                max={200}
                step={1}
                value={contrast()}
                onInput={(e) => setContrast(Number(e.currentTarget.value))}
              />
              <span class={styles.sliderRowValue}>{contrast()}</span>
            </div>
          </div>
        </Show>

        <Show when={target() === 'clips'}>
          <div class={styles.clipsRow}>
            <Show
              when={videoSupported()}
              fallback={
                <button class={styles.clipsBtn} disabled>
                  {t('camera.video_unavailable', language())}
                </button>
              }
            >
              <button
                class={`${styles.clipsBtn} ${styles.clipsBtnPrimary}`}
                onClick={() => void publishClipFromRecording()}
              >
                {t('camera.record_clip', language())}
              </button>
            </Show>
            <button
              class={styles.clipsBtn}
              onClick={() => void publishClipFromGallery()}
            >
              {t('camera.gallery_video', language())}
            </button>
            <button
              class={styles.clipsBtn}
              onClick={() => void publishClipFromUrl()}
            >
              {t('camera.publish_clip', language())}
            </button>
          </div>
        </Show>
      </div>

      <div class={styles.bottomControls}>
        <button
          class={styles.shutterBtn}
          classList={{
            [styles.shutterVideo]: videoMode() && !isRecording(),
            [styles.shutterRecording]: isRecording(),
          }}
          onPointerDown={onShutterDown}
          onPointerUp={onShutterUp}
          onPointerLeave={() => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } }}
          disabled={busy()}
        >
          <div class={styles.shutterInner}>
            <Show when={videoMode()} fallback={
              <svg class={styles.shutterIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" fill="currentColor"/>
                <path d="M9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9Zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" fill="currentColor"/>
              </svg>
            }>
              <Show when={!isRecording()} fallback={
                <svg class={styles.shutterIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
                </svg>
              }>
                <svg class={styles.shutterIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" fill="currentColor"/>
                </svg>
              </Show>
            </Show>
          </div>
        </button>
      </div>

      <Show when={error()}>
        <div class={styles.error}>{error()}</div>
      </Show>

      <Show when={lastUrl()}>
        <div class={styles.lastRow}>
          <img src={lastUrl()} alt={t('camera.last_capture', language())} />
          <div class={styles.lastActions}>
            <button onClick={() => void shareSnapPost()}>
              {t('camera.snap_post', language())}
            </button>
            <button onClick={() => void shareSnapStory()}>
              {t('camera.snap_story', language())}
            </button>
            <button onClick={() => void shareChirp()}>Chirp</button>
          </div>
        </div>
      </Show>
    </div>
  );
}
