import { createSignal, For, Show, createEffect, onCleanup, createMemo } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhoneActions } from '../../../store/phone';
import { useContacts } from '../../../store/contacts';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeMediaUrl, sanitizePhone } from '../../../utils/sanitize';
import { uiPrompt } from '../../../utils/uiDialog';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { ScreenState } from '../../shared/ui/ScreenState';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import styles from './GalleryApp.module.scss';

function PlainIconButton(props: {
  class?: string;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button class={props.class || 'ios-icon-btn'} onClick={props.onClick} aria-label={props.label}>
      <img src={props.icon} alt="" />
    </button>
  );
}

export function GalleryApp() {
  const router = useRouter();
  const phoneActions = usePhoneActions();
  const [contactsState] = useContacts();
  const [photos, setPhotos] = createSignal<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = createSignal<any>(null);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [loading, setLoading] = createSignal(true);
  const [showActions, setShowActions] = createSignal(false);
  const [shareChatApp, setShareChatApp] = createSignal<'messages' | 'wavechat' | null>(null);
  const [query, setQuery] = createSignal('');

  const openPhotoAt = (index: number) => {
    if (index < 0 || index >= visiblePhotos().length) return;
    setSelectedIndex(index);
    setSelectedPhoto(visiblePhotos()[index]);
  };

  const viewOffset = (offset: number) => {
    const current = selectedPhoto();
    if (!current) return;
    const list = visiblePhotos();
    const index = list.findIndex((photo) => photo.id === current.id);
    if (index < 0) return;
    const nextIndex = Math.max(0, Math.min(list.length - 1, index + offset));
    openPhotoAt(nextIndex);
  };

  const visiblePhotos = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return photos();
    return photos().filter((item) => String(item?.url || '').toLowerCase().includes(q));
  });

  const shareContacts = createMemo(() =>
    [...contactsState.contacts].sort((a, b) =>
      a.display.localeCompare(b.display, undefined, { sensitivity: 'base' })
    )
  );
  
  const loadPhotos = async () => {
    const result = await fetchNui('getGallery', undefined, []);
    setPhotos(result || []);
    setLoading(false);
  };
  
  createEffect(() => {
    loadPhotos();
  });
  
  createEffect(() => {
    const handleKeyUp = (e: CustomEvent<string>) => {
      const key = e.detail;
      
      if (selectedPhoto()) {
        if (key === 'Backspace') {
          setSelectedPhoto(null);
          return;
        }

        if (key === 'ArrowLeft') {
          viewOffset(-1);
          return;
        }

        if (key === 'ArrowRight') {
          viewOffset(1);
        }
        return;
      }
      
      switch (key) {
        case 'ArrowUp':
          setSelectedIndex(prev => Math.max(0, prev - 3));
          break;
        case 'ArrowDown':
          setSelectedIndex(prev => Math.min(visiblePhotos().length - 1, prev + 3));
          break;
        case 'Enter':
          if (selectedIndex() >= 0) {
            openPhotoAt(selectedIndex());
          }
          break;
        case 'Backspace':
          router.goBack();
          break;
      }
    };
    
    window.addEventListener('phone:keyUp', handleKeyUp as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', handleKeyUp as EventListener));
  });
  
  const takePhoto = async () => {
    await fetchNui('takePhoto', { url: '', field: '' });
    loadPhotos();
  };
  
  const setAsWallpaper = async () => {
    if (!selectedPhoto()) return;
    phoneActions.setWallpaper(selectedPhoto().url);
    setSelectedPhoto(null);
  };
  
  const deletePhoto = async () => {
    if (!selectedPhoto()) return;
    await fetchNui('deletePhoto', { photoId: selectedPhoto().id });
    setSelectedPhoto(null);
    loadPhotos();
  };

  const shareToMessages = async (app: 'messages' | 'wavechat') => {
    const mediaUrl = sanitizeMediaUrl(selectedPhoto()?.url);
    if (!mediaUrl) return;
    setShareChatApp(app);
    setShowActions(false);
  };

  const shareToChatNumber = (numberInput: string) => {
    const app = shareChatApp();
    const mediaUrl = sanitizeMediaUrl(selectedPhoto()?.url);
    const number = sanitizePhone(numberInput);
    if (!app || !mediaUrl || !number) return;
    setShareChatApp(null);
    setSelectedPhoto(null);
    router.navigate(app, { phoneNumber: number, attachmentUrl: mediaUrl });
  };

  const shareToChatManual = async () => {
    const app = shareChatApp();
    if (!app) return;
    const input = await uiPrompt('Numero para compartir', {
      title: app === 'messages' ? 'Compartir en Mensajes' : 'Compartir en WaveChat',
    });
    shareToChatNumber(typeof input === 'string' ? input : '');
  };

  const shareToFeedApp = (app: 'chirp' | 'snap') => {
    const mediaUrl = sanitizeMediaUrl(selectedPhoto()?.url);
    if (!mediaUrl) return;
    setShowActions(false);
    setSelectedPhoto(null);
    if (app === 'chirp') {
      router.navigate('chirp', { composeMedia: mediaUrl });
      return;
    }
    router.navigate('snap', { postMedia: mediaUrl, openComposer: '1' });
  };

  const currentPhotoIndex = () => {
    const current = selectedPhoto();
    if (!current) return -1;
    return visiblePhotos().findIndex((photo) => photo.id === current.id);
  };
  
  return (
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>‹</button>
        <div class="ios-nav-title">Galeria</div>
        <PlainIconButton onClick={takePhoto} label="Camara" icon="./img/icons_ios/camera.svg" />
      </div>
      
      <div class="ios-content">
      <div class={styles.toolbar}>
        <input
          class={styles.searchInput}
          type="text"
          placeholder="Buscar en galeria"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <div class={styles.counterPill}>{visiblePhotos().length}</div>
      </div>
      <div class={styles.grid}>
        <Show when={loading()} fallback={<ScreenState loading={false} empty={visiblePhotos().length === 0} emptyTitle="Sin fotos" emptyDescription="Toma tu primera foto con la camara.">
          <For each={visiblePhotos()}>
            {(photo, index) => (
              <div
                class={styles.photoItem}
                classList={{ [styles.selected]: selectedIndex() === index() }}
                onClick={() => openPhotoAt(index())}
              >
                <img src={photo.url} alt="Photo" />
              </div>
            )}
          </For>
        </ScreenState>}>
          <SkeletonList rows={9} />
        </Show>
      </div>
      </div>
      
      <Show when={selectedPhoto()}>
        <div class={styles.viewer}>
          <PlainIconButton class={styles.closeBtn} onClick={() => setSelectedPhoto(null)} label="Cerrar" icon="./img/icons_ios/ui-close.svg" />
          <button class={styles.navBtn} classList={{ [styles.disabled]: currentPhotoIndex() <= 0 }} onClick={() => viewOffset(-1)}>
            ‹
          </button>
          <button class={styles.navBtn} classList={{ [styles.next]: true, [styles.disabled]: currentPhotoIndex() >= photos().length - 1 }} onClick={() => viewOffset(1)}>
            ›
          </button>
          <img src={selectedPhoto().url} alt="Photo" />
          <div class={styles.counter}>{Math.max(0, currentPhotoIndex() + 1)} / {visiblePhotos().length}</div>
          <div class={styles.actions}>
            <button onClick={() => setShowActions(true)}>Opciones</button>
          </div>
        </div>
      </Show>

      <ActionSheet
        open={showActions()}
        title="Foto"
        onClose={() => setShowActions(false)}
        actions={[
          { label: 'Compartir en Mensajes', tone: 'primary', onClick: () => void shareToMessages('messages') },
          { label: 'Compartir en WaveChat', onClick: () => void shareToMessages('wavechat') },
          { label: 'Compartir en Chirp', onClick: () => shareToFeedApp('chirp') },
          { label: 'Compartir en Snap', onClick: () => shareToFeedApp('snap') },
          { label: 'Usar como fondo', tone: 'primary', onClick: setAsWallpaper },
          { label: 'Eliminar foto', tone: 'danger', onClick: deletePhoto },
        ]}
      />

      <ActionSheet
        open={!!shareChatApp()}
        title={shareChatApp() === 'messages' ? 'Compartir en Mensajes' : 'Compartir en WaveChat'}
        onClose={() => setShareChatApp(null)}
        actions={[
          ...shareContacts().map((contact) => ({
            label: `${contact.display} (${contact.number})`,
            onClick: () => shareToChatNumber(contact.number),
          })),
          { label: 'Ingresar numero', tone: 'primary' as const, onClick: () => void shareToChatManual() },
        ]}
      />
    </div>
  );
}
