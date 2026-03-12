import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { getStoredLanguage, t } from '../../../i18n';
import { uiPrompt } from '../../../utils/uiDialog';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useNuiEvent } from '../../../utils/useNui';
import styles from './CameraApp.module.scss';

type CameraEffect = 'normal' | 'noir' | 'vivid' | 'warm';
type CameraTarget = 'snap-post' | 'snap-story' | 'snap-avatar' | 'chirp' | 'chirp-avatar' | 'chirp-rechirp' | 'clips' | 'clips-avatar' | '';

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
    const capabilities = await fetchNui<{ quickZooms?: number[]; video?: boolean }>('cameraGetCapabilities', {}, { quickZooms: [30, 52, 78], video: false });
    setQuickZooms((capabilities?.quickZooms || [30, 52, 78]).map((value) => Number(value)).filter((value) => Number.isFinite(value)));
    setVideoSupported(capabilities?.video === true);

    await fetchNui('startCameraSession', {
      effect: effect(),
      fov: fov(),
      blur: blur(),
      flash: flash(),
      selfie: selfie(),
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
      landscape: landscape(),
    }, true);
  });

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
      router.navigate('chirp', { rechirpMedia: mediaUrl, openRechirp: '1', rechirpTweetId: String(router.params().rechirpTweetId || '') });
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
    const input = await uiPrompt(t('camera.prompt.video_url', language()), { title: t('camera.publish_clip', language()) });
    const videoUrl = sanitizeMediaUrl(input);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      if (input && input.trim()) {
        setError(t('camera.error.invalid_url', language()));
      }
      return false;
    }

    await fetchNui('storeMediaUrl', { url: videoUrl }, { success: false });
    const result = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: videoUrl,
    }, { success: false });

    if (result?.success) {
      router.navigate('clips');
      return true;
    }

    setError(t('camera.error.publish_failed', language()));
    return false;
  };

  const publishClipFromGallery = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>('getGallery', undefined, []);
    const picked = (gallery || []).find((entry) => {
      const mediaUrl = sanitizeMediaUrl(entry?.url);
      return mediaUrl && resolveMediaType(mediaUrl) === 'video';
    });

    const videoUrl = sanitizeMediaUrl(picked?.url);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      return false;
    }

    const result = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: videoUrl,
    }, { success: false });

    if (result?.success) {
      router.navigate('clips');
      return true;
    }

    setError(t('camera.error.publish_failed', language()));
    return false;
  };

  const publishClipFromRecording = async () => {
    setIsRecording(true);
    const storage = await fetchNui<{ uploadUrl?: string; uploadField?: string; customUploadUrl?: string; customUploadField?: string; maxVideoDurationSeconds?: number }>('getStorageConfig', undefined, {
      uploadUrl: '',
      uploadField: 'files[]',
      customUploadUrl: '',
      customUploadField: 'files[]',
    });
    const maxDuration = Math.max(5, Math.min(30, Number(storage?.maxVideoDurationSeconds || 30)));

    const result = await fetchNui<{ url?: string; error?: string }>('captureCameraVideoSession', {
      url: storage?.uploadUrl || storage?.customUploadUrl || '',
      field: storage?.uploadField || storage?.customUploadField || 'files[]',
      durationSeconds: maxDuration,
    }, { url: '', error: 'video_not_supported' });

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
    const publish = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: videoUrl,
    }, { success: false });

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
    const nearest = values.reduce((acc, value) => Math.abs(value - fov()) < Math.abs(acc - fov()) ? value : acc, values[0]);
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
      <div class={styles.preview} classList={{ [styles.previewLandscapeShell]: landscape() }}>
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

        <div class={styles.topBar}>
          <div class={styles.topLeft}>
            <button
              class={styles.iconBtn}
              onClick={() => void closeCamera()}
              title={t('control.close', language())}
            >
              ✕
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
              🖼
            </button>
          </div>
        </div>

        <div class={styles.minimalRow}>
          <button class={styles.minimalBtn} classList={{ [styles.minimalBtnActive]: flash() }} onClick={() => setFlash((v) => !v)}>
            {t('camera.flash', language())}
          </button>
          <button class={styles.minimalBtn} classList={{ [styles.minimalBtnActive]: selfie() }} onClick={() => setSelfie((v) => !v)}>
            {t('camera.selfie', language())}
          </button>
          <button class={styles.minimalBtn} onClick={() => void cycleZoom()}>{currentZoomLabel()}</button>
          <button class={styles.minimalBtn} onClick={cycleEffect}>{EFFECTS.find((item) => item.id === effect())?.label || 'Normal'}</button>
        </div>

        <Show when={target() === 'clips'}>
          <div class={styles.clipsRow}>
            <Show when={videoSupported()} fallback={<button class={styles.clipsBtn} disabled>{t('camera.video_unavailable', language())}</button>}>
              <button class={`${styles.clipsBtn} ${styles.clipsBtnPrimary}`} onClick={() => void publishClipFromRecording()}>
                {t('camera.record_clip', language())}
              </button>
            </Show>
            <button class={styles.clipsBtn} onClick={() => void publishClipFromGallery()}>
              {t('camera.gallery_video', language())}
            </button>
            <button class={styles.clipsBtn} onClick={() => void publishClipFromUrl()}>
              {t('camera.publish_clip', language())}
            </button>
          </div>
        </Show>
      </div>

      <div class={styles.bottomControls}>
        <button
          class={styles.shutterBtn}
          onClick={() => void takePhoto()}
          disabled={busy()}
        >
          <div class={styles.shutterInner} />
        </button>
      </div>

      <Show when={error()}>
        <div class={styles.error}>{error()}</div>
      </Show>

      <Show when={lastUrl()}>
        <div class={styles.lastRow}>
          <img src={lastUrl()} alt={t('camera.last_capture', language())} />
          <div class={styles.lastActions}>
            <button onClick={() => void shareSnapPost()}>{t('camera.snap_post', language())}</button>
            <button onClick={() => void shareSnapStory()}>{t('camera.snap_story', language())}</button>
            <button onClick={() => void shareChirp()}>Chirp</button>
          </div>
        </div>
      </Show>
    </div>
  );
}
