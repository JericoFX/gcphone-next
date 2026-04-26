import { createSignal, createEffect, For, Show, createMemo, onMount } from 'solid-js';
import { Motion } from '@motionone/solid';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhoneActions } from '../../../store/phone';
import { usePhoneState } from '../../../store/phone';
import { useContacts } from '../../../store/contacts';
import { useNotifications } from '../../../store/notifications';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { useNfcShare } from '../../../hooks/useNfcShare';
import { fetchKnownNui, fetchNui } from '../../../utils/fetchNui';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { resolveMediaType, sanitizeMediaUrl, sanitizePhone } from '../../../utils/sanitize';
import { uiPrompt } from '../../../utils/uiDialog';
import { SearchInput } from '../../shared/ui/SearchInput';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { NfcShareSheet } from '../../shared/ui/NfcShareSheet';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { InlineNotice } from '../../shared/ui/InlineNotice';
import { ScreenState } from '../../shared/ui/ScreenState';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { AppScaffold } from '../../shared/layout';
import { t } from '../../../i18n';
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
  const { data: photos, loading, setData: setPhotos, execute: loadPhotos } = useAsyncData(
    () => fetchKnownNui('getGallery', undefined, []),
    { initialData: [] as any[] }
  );
  const [selectedPhoto, setSelectedPhoto] = createSignal<any>(null);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [showActions, setShowActions] = createSignal(false);
  const [showShareSheet, setShowShareSheet] = createSignal(false);
  const [shareChatApp, setShareChatApp] = createSignal<'messages' | 'wavechat' | null>(null);
  const [, notificationsActions] = useNotifications();
  const [receivedPhotoUrl, setReceivedPhotoUrl] = createSignal<string | null>(null);
  const [lastNfcRouteKey, setLastNfcRouteKey] = createSignal('');

  // Albums
  const [albums, setAlbums] = createSignal<{ id: number; name: string; color: string }[]>([]);
  const [activeAlbum, setActiveAlbum] = createSignal<number | null>(null);
  const [showAlbumCreate, setShowAlbumCreate] = createSignal(false);
  const [albumName, setAlbumName] = createSignal('');
  const [albumColor, setAlbumColor] = createSignal('#007aff');
  const [showMoveToAlbum, setShowMoveToAlbum] = createSignal(false);

  const loadAlbums = async () => {
    const result = await fetchKnownNui('galleryGetAlbums', undefined, []);
    setAlbums(result || []);
  };

  const createAlbum = async () => {
    const name = albumName().trim();
    if (!name) return;
    const result = await fetchKnownNui(
      'galleryCreateAlbum',
      { name, color: albumColor() },
      { success: true, id: Date.now(), name, color: albumColor() }
    );
    if (result?.success) {
      setAlbumName('');
      setAlbumColor('#007aff');
      setShowAlbumCreate(false);
      await loadAlbums();
    }
  };

  const deleteAlbum = async (albumId: number) => {
    await fetchKnownNui('galleryDeleteAlbum', { albumId }, { success: true });
    if (activeAlbum() === albumId) setActiveAlbum(null);
    await loadAlbums();
    await loadPhotos();
  };

  const movePhotoToAlbum = async (albumId: number | null) => {
    const photo = selectedPhoto();
    if (!photo) return;
    await fetchKnownNui('galleryMoveToAlbum', { photoId: photo.id, albumId }, { success: true });
    setShowMoveToAlbum(false);
    setSelectedPhoto(null);
    await loadPhotos();
  };

  const nfcShare = useNfcShare({
    onShare: async (targetServerId) => {
      const photo = selectedPhoto();
      if (!photo) return { success: false, error: 'INVALID_DATA' };
      return fetchKnownNui('galleryShareNfc', { photoId: photo.id, targetServerId }, { success: false });
    },
    successMessage: 'Foto compartida por NFC',
  });
  const language = () => phoneState.settings.language || 'es';
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
    let list = photos();
    const album = activeAlbum();
    if (album !== null) {
      list = list.filter((item) => item.album_id === album);
    }
    const q = query().trim().toLowerCase();
    if (q) {
      list = list.filter((item) => String(item?.url || '').toLowerCase().includes(q));
    }
    return list;
  });

  const shareContacts = createMemo(() =>
    [...contactsState.contacts].sort((a, b) =>
      a.display.localeCompare(b.display, undefined, { sensitivity: 'base' })
    )
  );
  const isReadOnly = createMemo(() => phoneState.accessMode === 'foreign-readonly');
  
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
    const input = await uiPrompt(t('contacts.share_number_prompt', language()), {
      title: app === 'messages' ? t('gallery.share_messages', language()) : t('gallery.share_wavechat', language()),
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

  const publishAsSnapStory = async () => {
    if (isReadOnly()) return;
    const mediaUrl = sanitizeMediaUrl(selectedPhoto()?.url);
    if (!mediaUrl) return;
    setShowShareSheet(false);
    const result = await fetchNui<{ success?: boolean }>('snapPublishStory', {
      mediaUrl,
      mediaType: resolveMediaType(mediaUrl),
    });
    if (result?.success) {
      setSelectedPhoto(null);
    }
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
      attachmentName: t('gallery.photo_caption', language()),
    });
  };

  const saveReceivedPhoto = async (url: string) => {
    await fetchNui('storeMediaUrl', { url, type: 'image' }, { success: false });
    setReceivedPhotoUrl(null);
    void loadPhotos();
    notificationsActions.receive({
      appId: 'gallery',
      title: t('app.gallery', language()),
      message: t('gallery.photo_saved', language()),
      priority: 'normal',
    });
  };

  createEffect(() => {
    const params = router.params() as {
      nfcAction?: string;
      targetServerId?: number;
      requestId?: number;
      sharedPhoto?: { url?: string; from?: string };
    };

    const key = `${params?.requestId || 0}:${params?.nfcAction || 'none'}`;
    if (key === lastNfcRouteKey()) return;
    setLastNfcRouteKey(key);

    if (params?.nfcAction === 'share_photo' && typeof params?.targetServerId === 'number') {
      nfcShare.open();
    }

    if (params?.nfcAction === 'received_photo' && params.sharedPhoto?.url) {
      setReceivedPhotoUrl(params.sharedPhoto.url);
    }
  });

  onMount(() => {
    void loadAlbums();
  });

  const currentPhotoIndex = () => {
    const current = selectedPhoto();
    if (!current) return -1;
    return visiblePhotos().findIndex((photo) => photo.id === current.id);
  };

  return (
    <AppScaffold
      title={t('app.gallery', language())}
      subtitle={t('gallery.subtitle', language())}
      onBack={() => router.goBack()}
      action={isReadOnly() ? undefined : { onClick: takePhoto, label: t('chirp.camera', language()), icon: './img/icons_ios/camera.svg' }}
    >
      <div class={styles.page}>
        <Show when={isReadOnly()}>
          <InlineNotice title={t('contacts.readonly_title', language())} message={t('gallery.readonly_message', language(), { name: phoneState.accessOwnerName || t('common.other_person', language()) })} />
        </Show>
        <div class={styles.toolbar}>
          <SearchInput
            class={styles.searchWrap}
            inputClass={styles.searchInput}
            value={query()}
            onInput={setQuery}
            placeholder={t('gallery.search', language())}
          />
          <div class={styles.counterPill}>{visiblePhotos().length}</div>
        </div>
        <Show when={albums().length > 0 || !isReadOnly()}>
          <div class={styles.albumBar}>
            <button class={styles.albumChip} classList={{ [styles.active]: activeAlbum() === null }} onClick={() => setActiveAlbum(null)}>
              Todas
            </button>
            <For each={albums()}>
              {(album) => (
                <button
                  class={styles.albumChip}
                  classList={{ [styles.active]: activeAlbum() === album.id }}
                  style={{ '--chip-color': album.color }}
                  onClick={() => setActiveAlbum(activeAlbum() === album.id ? null : album.id)}
                  onContextMenu={(e: MouseEvent) => { e.preventDefault(); void deleteAlbum(album.id); }}
                >
                  {album.name}
                </button>
              )}
            </For>
            <Show when={!isReadOnly()}>
              <button class={styles.albumChipAdd} onClick={() => setShowAlbumCreate(true)}>+</button>
            </Show>
          </div>
        </Show>
        <div class={styles.grid}>
          <Show when={loading()} fallback={<ScreenState loading={false} empty={visiblePhotos().length === 0} emptyTitle={t('gallery.empty_title', language())} emptyDescription={t('gallery.empty_desc', language())}>
            <For each={visiblePhotos()}>
              {(photo, index) => (
                <Motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.22, delay: Math.min(index(), 9) * 0.04 }}
                >
                  <div
                    class={styles.photoItem}
                    classList={{ [styles.selected]: selectedIndex() === index() }}
                    onClick={() => openPhotoAt(index())}
                    onContextMenu={(e: MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openPhotoAt(index());
                      setShowActions(true);
                    }}
                  >
                    <img src={photo.url} alt="Photo" />
                  </div>
                </Motion.div>
              )}
            </For>
          </ScreenState>}>
            <SkeletonList rows={9} />
          </Show>
        </div>
      </div>

      <Show when={selectedPhoto()}>
        <div class={styles.viewer}>
          <PlainIconButton class={styles.closeBtn} onClick={() => setSelectedPhoto(null)} label={t('control.close', language())} icon={GALLERY_ICONS.close} />
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
              <span>{t('gallery.options', language())}</span>
            </button>
          </div>
        </div>
      </Show>

      <ActionSheet
        open={!isReadOnly() && showActions()}
        title={t('app.gallery', language())}
        onClose={() => setShowActions(false)}
        actions={[
          { label: t('garage.share', language()), tone: 'primary' as const, onClick: () => { setShowActions(false); setShowShareSheet(true); } },
          ...(albums().length > 0 ? [{ label: t('gallery.move_album', language()) || 'Mover a album', onClick: () => { setShowActions(false); setShowMoveToAlbum(true); } }] : []),
          { label: t('gallery.use_wallpaper', language()), onClick: setAsWallpaper },
          { label: t('gallery.delete_photo', language()), tone: 'danger' as const, onClick: deletePhoto },
        ]}
      />

      <ActionSheet
        open={showShareSheet()}
        title={t('garage.share', language())}
        onClose={() => setShowShareSheet(false)}
        actions={[
          { label: 'NFC', tone: 'primary' as const, onClick: () => { setShowShareSheet(false); nfcShare.open(); } },
          { label: 'Messages', onClick: () => { setShowShareSheet(false); void shareToMessages('messages'); } },
          { label: 'WaveChat', onClick: () => { setShowShareSheet(false); void shareToMessages('wavechat'); } },
          { label: 'Mail', onClick: () => { setShowShareSheet(false); shareToMail(); } },
          { label: 'Chirp', onClick: () => { setShowShareSheet(false); shareToFeedApp('chirp'); } },
          { label: 'Snap', onClick: () => { setShowShareSheet(false); shareToFeedApp('snap'); } },
          { label: 'Snap Story', onClick: () => void publishAsSnapStory() },
        ]}
      />

      <ActionSheet
        open={!!shareChatApp()}
        title={shareChatApp() === 'messages' ? t('gallery.share_messages', language()) : t('gallery.share_wavechat', language())}
        onClose={() => setShareChatApp(null)}
        actions={[
          ...shareContacts().map((contact) => ({
            label: `${contact.display} (${contact.number})`,
            onClick: () => shareToChatNumber(contact.number),
          })),
          { label: t('contacts.enter_number', language()), tone: 'primary' as const, onClick: () => void shareToChatManual() },
        ]}
      />

      <NfcShareSheet
        open={nfcShare.isOpen()}
        onClose={nfcShare.close}
        onSelect={(id) => void nfcShare.handleSelect(id)}
        title="Compartir foto"
        disabled={nfcShare.sharing()}
      />

      <Show when={receivedPhotoUrl()}>
        <MediaLightbox
          url={receivedPhotoUrl()}
          onClose={() => setReceivedPhotoUrl(null)}
        />
        <div class={styles.nfcSaveBar}>
          <button class={styles.nfcSaveBtn} onClick={() => void saveReceivedPhoto(receivedPhotoUrl()!)}>
            Guardar en galeria
          </button>
          <button class={styles.nfcDismissBtn} onClick={() => setReceivedPhotoUrl(null)}>
            Cerrar
          </button>
        </div>
      </Show>

      {/* Move to album */}
      <ActionSheet
        open={showMoveToAlbum()}
        title={t('gallery.move_album', language()) || 'Mover a album'}
        onClose={() => setShowMoveToAlbum(false)}
        actions={[
          { label: t('gallery.no_album', language()) || 'Sin album', onClick: () => void movePhotoToAlbum(null) },
          ...albums().map((album) => ({
            label: album.name,
            onClick: () => void movePhotoToAlbum(album.id),
          })),
        ]}
      />

      {/* Create album modal */}
      <Modal
        open={showAlbumCreate()}
        title="Nuevo album"
        onClose={() => { setShowAlbumCreate(false); setAlbumName(''); }}
        size="sm"
      >
        <div class={styles.albumForm}>
          <input
            type="text"
            class={styles.albumInput}
            placeholder="Nombre del album"
            value={albumName()}
            onInput={(e) => setAlbumName(e.currentTarget.value)}
            maxlength={64}
            autofocus
          />
          <div class={styles.albumColors}>
            <For each={['#007aff', '#ff3b30', '#30d158', '#ff9f0a', '#af52de', '#5856d6', '#ff2d55']}>
              {(color) => (
                <button
                  class={styles.colorDot}
                  classList={{ [styles.active]: albumColor() === color }}
                  style={{ background: color }}
                  onClick={() => setAlbumColor(color)}
                />
              )}
            </For>
          </div>
        </div>
        <ModalActions>
          <ModalButton label={t('action.cancel', language())} onClick={() => { setShowAlbumCreate(false); setAlbumName(''); }} />
          <ModalButton label={t('gallery.create', language())} tone="primary" onClick={() => void createAlbum()} disabled={!albumName().trim()} />
        </ModalActions>
      </Modal>
    </AppScaffold>
  );
}
