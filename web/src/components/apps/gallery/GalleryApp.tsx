import { createSignal, For, Show, createMemo, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhoneActions } from '../../../store/phone';
import { usePhoneState } from '../../../store/phone';
import { useContacts } from '../../../store/contacts';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeMediaUrl, sanitizePhone } from '../../../utils/sanitize';
import { uiPrompt } from '../../../utils/uiDialog';
import { SearchInput } from '../../shared/ui/SearchInput';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { ScreenState } from '../../shared/ui/ScreenState';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { AppScaffold } from '../../shared/layout';
import styles from './GalleryApp.module.scss';

const GALLERY_ICONS = {
  close: './img/icons_ios/ui-close.svg',
  left: './img/icons_ios/ui-chevron-left.svg',
  right: './img/icons_ios/ui-chevron-right.svg',
  options: './img/icons_ios/ui-more.svg',
} as const;

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
  const phoneState = usePhoneState();
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
  const isReadOnly = createMemo(() => phoneState.accessMode === 'foreign-readonly');
  
  const loadPhotos = async () => {
    const result = await fetchNui('getGallery', undefined, []);
    setPhotos(result || []);
    setLoading(false);
  };
  
  onMount(() => {
    void loadPhotos();
  });

  usePhoneKeyHandler({
    ArrowLeft: () => {
      if (!selectedPhoto()) return;
      viewOffset(-1);
    },
    ArrowRight: () => {
      if (!selectedPhoto()) return;
      viewOffset(1);
    },
    ArrowUp: () => {
      if (selectedPhoto()) return;
      setSelectedIndex((prev) => Math.max(0, prev - 3));
    },
    ArrowDown: () => {
      if (selectedPhoto()) return;
      setSelectedIndex((prev) => Math.min(visiblePhotos().length - 1, prev + 3));
    },
    Enter: () => {
      if (selectedPhoto()) return;
      if (selectedIndex() >= 0) {
        openPhotoAt(selectedIndex());
      }
    },
    Backspace: () => {
      if (selectedPhoto()) {
        setSelectedPhoto(null);
        return;
      }
      router.goBack();
    },
  });
  
  const takePhoto = async () => {
    if (isReadOnly()) return;
    await fetchNui('takePhoto', { url: '', field: '' });
    loadPhotos();
  };
  
  const setAsWallpaper = async () => {
    if (isReadOnly()) return;
    if (!selectedPhoto()) return;
    phoneActions.setWallpaper(selectedPhoto().url);
    setSelectedPhoto(null);
  };
  
  const deletePhoto = async () => {
    if (isReadOnly()) return;
    if (!selectedPhoto()) return;
    await fetchNui('deletePhoto', { photoId: selectedPhoto().id });
    setSelectedPhoto(null);
    loadPhotos();
  };

  const shareToMessages = async (app: 'messages' | 'wavechat') => {
    if (isReadOnly()) return;
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
    if (isReadOnly()) return;
    const app = shareChatApp();
    if (!app) return;
    const input = await uiPrompt('Numero para compartir', {
      title: app === 'messages' ? 'Compartir en Mensajes' : 'Compartir en WaveChat',
    });
    shareToChatNumber(typeof input === 'string' ? input : '');
  };

  const shareToFeedApp = (app: 'chirp' | 'snap') => {
    if (isReadOnly()) return;
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

  const shareToMail = () => {
    if (isReadOnly()) return;
    const mediaUrl = sanitizeMediaUrl(selectedPhoto()?.url);
    if (!mediaUrl) return;
    setShowActions(false);
    setSelectedPhoto(null);
    router.navigate('mail', {
      compose: '1',
      subject: 'Foto adjunta',
      attachmentUrl: mediaUrl,
      attachmentType: 'image',
      attachmentName: 'Foto de galeria',
    });
  };

  const currentPhotoIndex = () => {
    const current = selectedPhoto();
    if (!current) return -1;
    return visiblePhotos().findIndex((photo) => photo.id === current.id);
  };
  
  return (
    <AppScaffold
      title="Galeria"
      subtitle="Fotos y videos"
      onBack={() => router.goBack()}
      action={isReadOnly() ? undefined : { onClick: takePhoto, label: 'Camara', icon: './img/icons_ios/camera.svg' }}
    >
      <div class={styles.page}>
        <Show when={isReadOnly()}>
          <InlineNotice title="Solo lectura" message={`Estas viendo la galeria de ${phoneState.accessOwnerName || 'otra persona'}.`} />
        </Show>
        <div class={styles.toolbar}>
          <SearchInput
            class={styles.searchWrap}
            inputClass={styles.searchInput}
            value={query()}
            onInput={setQuery}
            placeholder="Buscar en galeria"
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
          <PlainIconButton class={styles.closeBtn} onClick={() => setSelectedPhoto(null)} label="Cerrar" icon={GALLERY_ICONS.close} />
          <button class={styles.navBtn} classList={{ [styles.disabled]: currentPhotoIndex() <= 0 }} onClick={() => viewOffset(-1)}>
            <img src={GALLERY_ICONS.left} alt="" draggable={false} />
          </button>
          <button class={styles.navBtn} classList={{ [styles.next]: true, [styles.disabled]: currentPhotoIndex() >= photos().length - 1 }} onClick={() => viewOffset(1)}>
            <img src={GALLERY_ICONS.right} alt="" draggable={false} />
          </button>
          <img src={selectedPhoto().url} alt="Photo" />
          <div class={styles.counter}>{Math.max(0, currentPhotoIndex() + 1)} / {visiblePhotos().length}</div>
          <div class={styles.actions}>
            <button onClick={() => setShowActions(true)}>
              <img src={GALLERY_ICONS.options} alt="" draggable={false} />
              <span>Opciones</span>
            </button>
          </div>
        </div>
      </Show>

      <ActionSheet
        open={!isReadOnly() && showActions()}
        title="Foto"
        onClose={() => setShowActions(false)}
        actions={[
          { label: 'Compartir en Mensajes', tone: 'primary', onClick: () => void shareToMessages('messages') },
          { label: 'Compartir en WaveChat', onClick: () => void shareToMessages('wavechat') },
          { label: 'Compartir por Mail', onClick: shareToMail },
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
    </AppScaffold>
  );
}
