import { createSignal, For, Show, createEffect, onCleanup, createMemo } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhoneActions } from '../../../store/phone';
import { fetchNui } from '../../../utils/fetchNui';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { ScreenState } from '../../shared/ui/ScreenState';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import styles from './GalleryApp.module.scss';

export function GalleryApp() {
  const router = useRouter();
  const phoneActions = usePhoneActions();
  const [photos, setPhotos] = createSignal<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = createSignal<any>(null);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [loading, setLoading] = createSignal(true);
  const [showActions, setShowActions] = createSignal(false);
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

  const currentPhotoIndex = () => {
    const current = selectedPhoto();
    if (!current) return -1;
    return visiblePhotos().findIndex((photo) => photo.id === current.id);
  };
  
  return (
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>
          ‹
        </button>
        <div class="ios-nav-title">Galeria</div>
        <button class="ios-icon-btn" onClick={takePhoto}>
          📷
        </button>
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
          <button class={styles.closeBtn} onClick={() => setSelectedPhoto(null)}>
            ✕
          </button>
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
          { label: 'Usar como fondo', tone: 'primary', onClick: setAsWallpaper },
          { label: 'Eliminar foto', tone: 'danger', onClick: deletePhoto },
        ]}
      />
    </div>
  );
}
