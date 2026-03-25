import {
  Show,
  createEffect,
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
  | 'contact-avatar'
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
  if (target === 'contact-avatar') return 'Avatar';
  return 'Foto';
}

export function CameraApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const [effect, setEffect] = createSignal<CameraEffect>('normal');
  const [lastUrl, setLastUrl] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [target, setTarget] = createSignal<CameraTarget>('');
  const [sessionReady, setSessionReady] = createSignal(false);
  const [isRecording, setIsRecording] = createSignal(false);
  const [blurLevel, setBlurLevel] = createSignal(0);
  const [brightness, setBrightness] = createSignal(100);
  const [contrast, setContrast] = createSignal(100);
  const [saturation, setSaturation] = createSignal(100);
  const [temperature, setTemperature] = createSignal(0);
  const [vignette, setVignette] = createSignal(0);
  const [controlsOpen, setControlsOpen] = createSignal(false);
  const [videoMode, setVideoMode] = createSignal(false);
  const [renderer, setRenderer] = createSignal<'webgl' | 'css'>('webgl');
  const videoSupported = () => true;
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
      nextTarget === 'clips-avatar' ||
      nextTarget === 'contact-avatar'
    ) {
      setTarget(nextTarget as CameraTarget);
    } else {
      setTarget('');
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
      renderer?: string;
    }>('cameraGetCapabilities', {}, { renderer: 'webgl' });
    setRenderer(capabilities?.renderer === 'css' ? 'css' : 'webgl');

    await fetchNui('startCameraSession', {}, true);
    setSessionReady(true);

    if (canvasRef && !isEnvBrowser()) {
      try {
        gameViewRef = createGameView(canvasRef);
        gameViewRef.resizeByAspect(3 / 4);
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

  // Sync WebGL shader uniforms when controls change.
  // Read all signals FIRST so SolidJS always subscribes, then check gameViewRef.
  createEffect(() => {
    const b = blurLevel();
    const br = brightness();
    const co = contrast();
    const sa = saturation();
    const te = temperature();
    const vi = vignette();
    const ef = effect();
    const r = renderer();
    if (!gameViewRef || r !== 'webgl') return;
    gameViewRef.setBlur(b / 100);
    gameViewRef.setBrightness(br / 100);
    gameViewRef.setContrast(co / 100);
    gameViewRef.setSaturation(sa / 100);
    gameViewRef.setTemperature(te / 100);
    gameViewRef.setVignette(vi / 100);
    const effectMap: Record<CameraEffect, number> = { normal: 0, noir: 1, vivid: 2, warm: 3 };
    gameViewRef.setEffect(effectMap[ef] ?? 0);
  });

  // CSS filter fallback string
  const cssFilter = () => {
    if (renderer() !== 'css') return undefined;
    const parts: string[] = [];
    if (blurLevel() > 0) parts.push(`blur(${(blurLevel() / 100) * 4}px)`);
    if (brightness() !== 100) parts.push(`brightness(${brightness() / 100})`);
    if (contrast() !== 100) parts.push(`contrast(${contrast() / 100})`);
    if (saturation() !== 100) parts.push(`saturate(${saturation() / 100})`);
    if (temperature() > 0) parts.push(`sepia(${temperature() / 200})`);
    else if (temperature() < 0) parts.push(`hue-rotate(${temperature() * 0.3}deg)`);
    if (effect() === 'noir') parts.push('grayscale(1) contrast(1.08)');
    else if (effect() === 'vivid') parts.push('saturate(1.3) contrast(1.08)');
    else if (effect() === 'warm') parts.push('sepia(0.24) saturate(1.15)');
    return parts.length ? parts.join(' ') : undefined;
  };

  const resetControls = () => {
    setBlurLevel(0);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setTemperature(0);
    setVignette(0);
    setEffect('normal');
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
    } else if (target() === 'contact-avatar') {
      router.navigate('contacts', { avatarMedia: mediaUrl });
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

  return (
    <div class={styles.app}>
      <div
        class={styles.preview}
        classList={{}}
      >
        <canvas
          ref={canvasRef}
          class={styles.feedLayer}
          classList={{
          }}
          style={renderer() === 'css' ? { filter: cssFilter() } : undefined}
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
            classList={{ [styles.minimalBtnActive]: controlsOpen() }}
            onClick={() => setControlsOpen((v) => !v)}
          >
            {t('camera.controls', language())}
          </button>
        </div>

        {/* Key hint */}
        <div class={styles.keyHint}>Alt: Caminar</div>

        {/* Mode indicator */}
        <div class={styles.modeIndicator} classList={{ [styles.modeVideo]: videoMode() }}>
          {videoMode() ? t('camera.video', language()) : t('camera.photo', language())}
        </div>

        {/* Controls panel */}
        <Show when={controlsOpen()}>
          <div class={styles.controlsPanel}>
            <div class={styles.controlsHeader}>
              <div class={styles.controlsHeaderLeft}>
                <svg class={styles.controlsChevron} viewBox="0 0 24 24" fill="none" onClick={() => setControlsOpen(false)}><path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span class={styles.controlsTitle}>{t('camera.controls', language())}</span>
              </div>
              <button class={styles.controlsResetBtn} onClick={() => resetControls()}>
                {t('camera.reset', language())}
              </button>
            </div>

              <div class={styles.controlsBody}>
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

                {/* Blur */}
                <div class={styles.sliderRow}>
                  <svg class={styles.sliderRowIcon} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/></svg>
                  <input type="range" class={styles.horizontalSlider} min={0} max={100} step={1} value={blurLevel()} onInput={(e) => setBlurLevel(Number(e.currentTarget.value))} />
                  <span class={styles.sliderRowValue}>{blurLevel()}</span>
                </div>

                {/* Brightness */}
                <div class={styles.sliderRow}>
                  <svg class={styles.sliderRowIcon} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  <input type="range" class={styles.horizontalSlider} min={20} max={200} step={1} value={brightness()} onInput={(e) => setBrightness(Number(e.currentTarget.value))} />
                  <span class={styles.sliderRowValue}>{brightness()}</span>
                </div>

                {/* Contrast */}
                <div class={styles.sliderRow}>
                  <svg class={styles.sliderRowIcon} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 2a10 10 0 0 1 0 20V2z" fill="currentColor"/></svg>
                  <input type="range" class={styles.horizontalSlider} min={20} max={200} step={1} value={contrast()} onInput={(e) => setContrast(Number(e.currentTarget.value))} />
                  <span class={styles.sliderRowValue}>{contrast()}</span>
                </div>

                {/* Saturation */}
                <div class={styles.sliderRow}>
                  <svg class={styles.sliderRowIcon} viewBox="0 0 24 24" fill="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                  <input type="range" class={styles.horizontalSlider} min={0} max={300} step={1} value={saturation()} onInput={(e) => setSaturation(Number(e.currentTarget.value))} />
                  <span class={styles.sliderRowValue}>{saturation()}</span>
                </div>

                {/* Temperature */}
                <div class={styles.sliderRow}>
                  <svg class={styles.sliderRowIcon} viewBox="0 0 24 24" fill="none"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <input type="range" class={styles.horizontalSlider} min={-100} max={100} step={1} value={temperature()} onInput={(e) => setTemperature(Number(e.currentTarget.value))} />
                  <span class={styles.sliderRowValue}>{temperature()}</span>
                </div>

                {/* Vignette */}
                <div class={styles.sliderRow}>
                  <svg class={styles.sliderRowIcon} viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="12" rx="6" ry="6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/></svg>
                  <input type="range" class={styles.horizontalSlider} min={0} max={100} step={1} value={vignette()} onInput={(e) => setVignette(Number(e.currentTarget.value))} />
                  <span class={styles.sliderRowValue}>{vignette()}</span>
                </div>
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
