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
import { t } from '../../../i18n';
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
  const phoneState = usePhoneState();
  const phoneActions = usePhoneActions();
  const [contactsState] = useContacts();
  const [photos, setPhotos] = createSignal<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = createSignal<any>(null);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [loading, setLoading] = createSignal(true);
  const [showActions, setShowActions] = createSignal(false);
  const [shareChatApp, setShareChatApp] = createSignal<'messages' | 'wavechat' | null>(null);
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
        <div class={styles.grid}>
          <Show when={loading()} fallback={<ScreenState loading={false} empty={visiblePhotos().length === 0} emptyTitle={t('gallery.empty_title', language())} emptyDescription={t('gallery.empty_desc', language())}>
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
          <PlainIconButton class={styles.closeBtn} onClick={() => setSelectedPhoto(null)} label={t('control.close', language())} icon="./img/icons_ios/ui-close.svg" />
          <button class={styles.navBtn} classList={{ [styles.disabled]: currentPhotoIndex() <= 0 }} onClick={() => viewOffset(-1)}>
            ‹
          </button>
          <button class={styles.navBtn} classList={{ [styles.next]: true, [styles.disabled]: currentPhotoIndex() >= photos().length - 1 }} onClick={() => viewOffset(1)}>
            ›
          </button>
          <img src={selectedPhoto().url} alt="Photo" />
          <div class={styles.counter}>{Math.max(0, currentPhotoIndex() + 1)} / {visiblePhotos().length}</div>
          <div class={styles.actions}>
            <button onClick={() => setShowActions(true)}>{t('gallery.options', language())}</button>
          </div>
        </div>
      </Show>

      <ActionSheet
        open={!isReadOnly() && showActions()}
        title={t('app.gallery', language())}
        onClose={() => setShowActions(false)}
        actions={[
          { label: t('gallery.share_messages', language()), tone: 'primary', onClick: () => void shareToMessages('messages') },
          { label: t('gallery.share_wavechat', language()), onClick: () => void shareToMessages('wavechat') },
          { label: t('gallery.share_mail', language()), onClick: shareToMail },
          { label: t('gallery.share_chirp', language()), onClick: () => shareToFeedApp('chirp') },
          { label: t('gallery.share_snap', language()), onClick: () => shareToFeedApp('snap') },
          { label: t('gallery.use_wallpaper', language()), tone: 'primary', onClick: setAsWallpaper },
          { label: t('gallery.delete_photo', language()), tone: 'danger', onClick: deletePhoto },
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
    </AppScaffold>
  );
}
