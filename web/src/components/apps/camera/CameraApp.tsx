import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { getStoredLanguage, t } from '../../../i18n';
import { uiPrompt } from '../../../utils/uiDialog';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import styles from './CameraApp.module.scss';

type CameraEffect = 'normal' | 'noir' | 'vivid' | 'warm';
type CameraTarget = 'snap-post' | 'snap-story' | 'chirp' | 'clips' | '';

const EFFECTS: Array<{ id: CameraEffect; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'noir', label: 'Noir' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'warm', label: 'Warm' },
];

function targetLabel(target: CameraTarget) {
  if (target === 'snap-post') return 'Snap post';
  if (target === 'snap-story') return 'Snap story';
  if (target === 'chirp') return 'Chirp';
  if (target === 'clips') return 'Clips';
  return 'Sin destino';
}

export function CameraApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const [effect, setEffect] = createSignal<CameraEffect>('normal');
  const [fov, setFov] = createSignal(52);
  const [blur, setBlur] = createSignal(0);
  const [caption, setCaption] = createSignal('');
  const [lastUrl, setLastUrl] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [target, setTarget] = createSignal<CameraTarget>('');
  const [flash, setFlash] = createSignal(true);
  const [selfie, setSelfie] = createSignal(false);
  const [sessionReady, setSessionReady] = createSignal(false);

  createEffect(() => {
    const params = router.params();
    const nextTarget = sanitizeText(String(params.target || ''), 24);
    if (nextTarget === 'snap-post' || nextTarget === 'snap-story' || nextTarget === 'chirp' || nextTarget === 'clips') {
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

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') void closeCamera();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  onMount(async () => {
    await fetchNui('startCameraSession', {
      effect: effect(),
      fov: fov(),
      blur: blur(),
      flash: flash(),
      selfie: selfie(),
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
    }, true);
  });

  const fovPercent = createMemo(() => Math.round(((fov() - 25) / 65) * 100));

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
        setError('Subida no configurada en el servidor');
      } else {
        setError('Captura cancelada o invalida');
      }
      return;
    }

    setLastUrl(mediaUrl);

    if (target() === 'snap-post') {
      await fetchNui('snapPublishPost', {
        mediaUrl,
        mediaType: resolveMediaType(mediaUrl) === 'video' ? 'video' : 'image',
        caption: sanitizeText(caption(), 500),
      });
      router.navigate('snap');
    } else if (target() === 'snap-story') {
      await fetchNui('snapPublishStory', {
        mediaUrl,
        mediaType: resolveMediaType(mediaUrl) === 'video' ? 'video' : 'image',
      });
      router.navigate('snap');
    } else if (target() === 'chirp') {
      await fetchNui('chirpPublishTweet', {
        content: sanitizeText(caption(), 280) || 'Nueva captura',
        mediaUrl,
      });
      router.navigate('chirp');
    } else if (target() === 'clips') {
      setError('Clips requiere video. Usa "Publicar clip" con URL de video.');
    }

    setBusy(false);
  };

  const shareSnapPost = async () => {
    const mediaUrl = sanitizeMediaUrl(lastUrl());
    if (!mediaUrl) return;
    await fetchNui('snapPublishPost', {
      mediaUrl,
      mediaType: resolveMediaType(mediaUrl) === 'video' ? 'video' : 'image',
      caption: sanitizeText(caption(), 500),
    });
    router.navigate('snap');
  };

  const shareSnapStory = async () => {
    const mediaUrl = sanitizeMediaUrl(lastUrl());
    if (!mediaUrl) return;
    await fetchNui('snapPublishStory', {
      mediaUrl,
      mediaType: resolveMediaType(mediaUrl) === 'video' ? 'video' : 'image',
    });
    router.navigate('snap');
  };

  const shareChirp = async () => {
    const mediaUrl = sanitizeMediaUrl(lastUrl());
    if (!mediaUrl) return;
    await fetchNui('chirpPublishTweet', {
      content: sanitizeText(caption(), 280) || 'Nueva captura',
      mediaUrl,
    });
    router.navigate('chirp');
  };

  const publishClipFromUrl = async () => {
    const input = await uiPrompt('Pega URL de video para Clips (mp4/webm/mov/m3u8)', { title: 'Publicar clip' });
    const videoUrl = sanitizeMediaUrl(input);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      if (input && input.trim()) {
        setError('URL de video invalida para Clips');
      }
      return;
    }

    await fetchNui('storeMediaUrl', { url: videoUrl }, { success: false });
    const result = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: videoUrl,
      caption: sanitizeText(caption(), 500),
    }, { success: false });

    if (result?.success) {
      router.navigate('clips');
      return;
    }

    setError('No se pudo publicar el clip');
  };

  const publishClipFromGallery = async () => {
    const gallery = await fetchNui<Array<{ url?: string }>>('getGallery', undefined, []);
    const picked = (gallery || []).find((entry) => {
      const mediaUrl = sanitizeMediaUrl(entry?.url);
      return mediaUrl && resolveMediaType(mediaUrl) === 'video';
    });

    const videoUrl = sanitizeMediaUrl(picked?.url);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      setError('No hay videos en galeria para publicar');
      return;
    }

    const result = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: videoUrl,
      caption: sanitizeText(caption(), 500),
    }, { success: false });

    if (result?.success) {
      router.navigate('clips');
      return;
    }

    setError('No se pudo publicar el clip');
  };

  const publishClipFromRecording = async () => {
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

    const videoUrl = sanitizeMediaUrl(result?.url);
    if (!videoUrl || resolveMediaType(videoUrl) !== 'video') {
      if (result?.error === 'video_not_supported') {
        setError('Grabacion de video no disponible en este servidor');
      } else {
        setError('No se pudo grabar o subir el video');
      }
      return;
    }

    await fetchNui('storeMediaUrl', { url: videoUrl }, { success: false });
    const publish = await fetchNui<{ success?: boolean }>('clipsPublish', {
      mediaUrl: videoUrl,
      caption: sanitizeText(caption(), 500),
    }, { success: false });

    if (publish?.success) {
      router.navigate('clips');
      return;
    }

    setError('No se pudo publicar el clip');
  };

  return (
    <div class={styles.app}>
      <div class={styles.preview}>
        <div
          class={styles.feedLayer}
          classList={{
            [styles.previewNoir]: effect() === 'noir',
            [styles.previewVivid]: effect() === 'vivid',
            [styles.previewWarm]: effect() === 'warm',
            [styles.previewSelfie]: selfie(),
          }}
        />
        <div class={styles.topBar}>
          <button class={styles.iconBtn} onClick={() => void closeCamera()}>×</button>
          <div class={styles.topCenter}>
            <div class={styles.brandPill}>CineCam</div>
            <div class={styles.targetPill}>{targetLabel(target())}</div>
          </div>
          <div class={styles.topActions}>
            <button class={styles.iconBtn} classList={{ [styles.iconBtnActive]: flash() }} onClick={() => setFlash((v) => !v)} title={t('camera.flash', language())}>
              ⚡
            </button>
            <button class={styles.iconBtn} classList={{ [styles.iconBtnActive]: selfie() }} onClick={() => setSelfie((v) => !v)} title={t('camera.switch', language())}>
              ⇄
            </button>
            <button class={styles.iconBtn} onClick={() => router.navigate('gallery')} title={t('camera.gallery', language())}>
              🖼
            </button>
          </div>
        </div>

        <div class={styles.filterRail}>
          <For each={EFFECTS}>
            {(item) => (
              <button
                class={styles.filterChip}
                classList={{ [styles.filterChipActive]: effect() === item.id }}
                onClick={() => setEffect(item.id)}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>

        <div class={styles.controlsCard}>
          <div class={styles.effectBadge}>FX: {effect().toUpperCase()}</div>
          <div class={styles.sliderRow}>
            <span>FOV</span>
            <input 
              class="ios-slider-dark" 
              type="range" 
              min="25" 
              max="90" 
              step="1" 
              value={fov()} 
              style={{ '--value-percent': `${((fov() - 25) / (90 - 25)) * 100}%` }}
              onInput={(e) => {
                const val = Number(e.currentTarget.value);
                e.currentTarget.style.setProperty('--value-percent', `${((val - 25) / (90 - 25)) * 100}%`);
                setFov(val);
              }} 
            />
            <strong>{fovPercent()}%</strong>
          </div>
          <div class={styles.sliderRow}>
            <span>Blur</span>
            <input 
              class="ios-slider-dark" 
              type="range" 
              min="0" 
              max="70" 
              step="1" 
              value={blur()} 
              style={{ '--value-percent': `${(blur() / 70) * 100}%` }}
              onInput={(e) => {
                const val = Number(e.currentTarget.value);
                e.currentTarget.style.setProperty('--value-percent', `${(val / 70) * 100}%`);
                setBlur(val);
              }} 
            />
            <strong>{blur()}%</strong>
          </div>
          <input class={styles.captionInput} maxlength="140" placeholder={t('camera.caption_placeholder', language())} value={caption()} onInput={(e) => setCaption(e.currentTarget.value)} />
        </div>

        <div class={styles.shutterWrap}>
          <button class={styles.shutterBtn} onClick={() => void takePhoto()} disabled={busy()} data-testid="camera-capture-btn">
            <span class={styles.shutterInner} />
          </button>
        </div>

        <Show when={target() === 'clips'}>
          <div class={styles.clipsRow}>
            <button class="ios-btn" onClick={() => void publishClipFromRecording()}>{t('camera.record_clip', language())}</button>
            <button class="ios-btn" onClick={() => void publishClipFromGallery()}>{t('camera.gallery_video', language())}</button>
            <button class="ios-btn ios-btn-primary" onClick={() => void publishClipFromUrl()}>{t('camera.publish_clip', language())}</button>
          </div>
        </Show>
      </div>

      <Show when={error()}>
        <div class={styles.error}>{error()}</div>
      </Show>

      <Show when={lastUrl()}>
        <div class={styles.lastRow}>
          <img src={lastUrl()} alt="ultima captura" />
          <div class={styles.lastActions}>
            <button class="ios-btn" onClick={() => void shareSnapPost()}>{t('camera.snap_post', language())}</button>
            <button class="ios-btn" onClick={() => void shareSnapStory()}>{t('camera.snap_story', language())}</button>
            <button class="ios-btn" onClick={() => void shareChirp()}>Chirp</button>
          </div>
        </div>
      </Show>
    </div>
  );
}
