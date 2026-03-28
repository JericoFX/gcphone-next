import { createMemo, createSignal, For, Show, createEffect, onCleanup } from 'solid-js';
import { usePhone } from '../../../store/phone';
import { useRouter } from '../../Phone/PhoneFrame';
import { APP_BY_ID } from '../../../config/apps';
import { appName, formatDate as formatDateI18n, formatTime as formatTimeI18n, t } from '../../../i18n';
import { timeAgo } from '../../../utils/misc';
import { useWindowEvent } from '../../../hooks';
import { useHomeSearch } from './hooks/useHomeSearch';
import { useHomeDesktopState } from './hooks/useHomeDesktopState';
import { IconPackProvider } from './IconPackProvider';
import { AppGrid } from './AppGrid';
import { FolderModal } from './FolderModal';
import { WidgetPage } from './WidgetPage';
import { DesktopPager } from './DesktopPager';
import type { Folder } from '../../../types/home';
import styles from './HomeScreen.module.scss';

const APPS_PER_PAGE = 12;

export function HomeScreen() {
  const [state] = usePhone();
  const router = useRouter();
  const [editing, setEditing] = createSignal(false);
  const [touchStartX, setTouchStartX] = createSignal<number | null>(null);
  const [pageTransition, setPageTransition] = createSignal<'next' | 'prev' | null>(null);
  const [openFolder, setOpenFolder] = createSignal<Folder | null>(null);

  const language = createMemo(() => state.settings.language || 'es');
  const { currentTime, desktopPage, setDesktopPage } = useHomeDesktopState(language);
  const {
    searchOpen,
    searchQuery,
    searchLoading,
    searchResults,
    setSearchQuery,
    openSearch,
    closeSearch,
  } = useHomeSearch(() => state.enabledApps, language);

  const homeItems = createMemo(() => {
    const enabled = new Set(state.enabledApps);
    return state.appLayout.home.filter((id) => {
      if (id.startsWith('folder:')) return true;
      const app = APP_BY_ID[id];
      return Boolean(app) && enabled.has(app.id);
    });
  });

  const pageCount = createMemo(() => Math.max(1, Math.ceil(homeItems().length / APPS_PER_PAGE)));

  const visibleItems = createMemo(() => {
    const page = desktopPage();
    if (page < 0) return [];
    const start = page * APPS_PER_PAGE;
    return homeItems().slice(start, start + APPS_PER_PAGE);
  });

  createEffect(() => {
    if (desktopPage() > pageCount() - 1) setDesktopPage(Math.max(0, pageCount() - 1));
  });

  let pageTransitionTimer: number | undefined;

  const goToPage = (nextPage: number) => {
    const clamped = Math.max(-1, Math.min(pageCount() - 1, nextPage));
    if (clamped === desktopPage()) return;
    const direction = clamped > desktopPage() ? 'next' : 'prev';
    setPageTransition(null);
    setDesktopPage(clamped);
    requestAnimationFrame(() => setPageTransition(direction));
    if (pageTransitionTimer) clearTimeout(pageTransitionTimer);
    pageTransitionTimer = window.setTimeout(() => setPageTransition(null), 340);
  };

  onCleanup(() => {
    if (pageTransitionTimer) clearTimeout(pageTransitionTimer);
  });

  useWindowEvent<CustomEvent<string>>('phone:keyUp', (event) => {
    const key = event.detail;

    switch (key) {
      case 'ArrowLeft':
        if (desktopPage() > -1) goToPage(desktopPage() - 1);
        break;
      case 'ArrowRight':
        if (desktopPage() < pageCount() - 1) goToPage(desktopPage() + 1);
        break;
      case 'Backspace':
        if (openFolder()) {
          setOpenFolder(null);
          break;
        }
        if (searchOpen()) {
          closeSearch();
        }
        break;
    }
  });

  function formatTime(date: Date) {
    return formatTimeI18n(date, language(), { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(date: Date) {
    return formatDateI18n(date, language(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  const openMessagesThread = (number: string) => {
    closeSearch();
    router.navigate('messages', { phoneNumber: number });
  };

  const handleSwipe = (e: TouchEvent) => {
    const start = touchStartX();
    const end = e.changedTouches[0]?.clientX;
    setTouchStartX(null);
    if (start === null || end === undefined) return;
    const delta = end - start;
    if (delta > 44) goToPage(desktopPage() - 1);
    if (delta < -44) goToPage(desktopPage() + 1);
  };

  return (
    <IconPackProvider>
      <div class={styles.homeScreen} style={{ 'background-image': `url(${state.settings.wallpaper})` }}>
        <div class={styles.statusBar}>
          <div class={styles.time}>{formatTime(currentTime())}</div>
          <div class={styles.icons}>
            <button class={styles.editBtn} onClick={() => setEditing((v) => !v)}>
              {editing() ? t('home.done', language()) : t('home.edit', language())}
            </button>
            <button class={styles.searchBtn} onClick={openSearch}>{t('home.search', language())}</button>
          </div>
        </div>

        <Show when={state.isStolen}>
          <div class={styles.stolenBanner}>
            <span class={styles.stolenIcon}>!</span>
            <div>
              <strong>{t('phone.stolen_title', language()) || 'Telefono reportado'}</strong>
              <Show when={state.stolenReason}>
                <span>{state.stolenReason}</span>
              </Show>
            </div>
          </div>
        </Show>

        <Show when={state.accessMode === 'foreign-readonly'}>
          <div class={styles.foreignBanner}>
            <span>{t('phone.foreign_readonly', language()) || 'Solo lectura'}</span>
            <Show when={state.accessOwnerName}>
              <span> &mdash; {state.accessOwnerName}</span>
            </Show>
          </div>
        </Show>

        <div class={styles.homeTime}>
          <div class={styles.timeLarge}>{formatTime(currentTime())}</div>
          <div class={styles.date}>{formatDate(currentTime())}</div>
        </div>

        <div
          style={{ flex: '1', position: 'relative', 'z-index': '2' }}
          onTouchStart={(e) => setTouchStartX(e.changedTouches[0]?.clientX ?? null)}
          onTouchEnd={handleSwipe}
        >
          <Show when={desktopPage() === -1} fallback={
            <div
              classList={{
                [styles.pageShiftNext]: pageTransition() === 'next',
                [styles.pageShiftPrev]: pageTransition() === 'prev',
              }}
              style={{ height: '100%' }}
            >
              <AppGrid
                items={() => visibleItems()}
                editing={editing()}
                language={language}
                onOpenFolder={(folder) => setOpenFolder(folder)}
                onPageEdge={(dir) => {
                  if (dir === 'left' && desktopPage() > -1) goToPage(desktopPage() - 1);
                  if (dir === 'right' && desktopPage() < pageCount() - 1) goToPage(desktopPage() + 1);
                }}
                onFolderCreated={() => {}}
              />
            </div>
          }>
            <WidgetPage editing={editing()} language={language} />
          </Show>
        </div>

        <DesktopPager
          currentPage={desktopPage}
          pageCount={pageCount}
          hasWidgetPage={true}
          onPageChange={goToPage}
        />

        <Show when={openFolder()}>
          {(folder) => (
            <FolderModal
              folder={folder()}
              language={language}
              onClose={() => setOpenFolder(null)}
            />
          )}
        </Show>

        <Show when={searchOpen()}>
          <div class={styles.searchOverlay} onClick={closeSearch}>
            <div class={styles.searchPanel} onClick={(e) => e.stopPropagation()}>
              <div class={styles.searchHeader}>
                <input
                  class={styles.searchInput}
                  type="text"
                  value={searchQuery()}
                  placeholder={t('home.search_placeholder', language())}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  autofocus
                />
                <button class={styles.searchClose} onClick={closeSearch}>{t('home.search_cancel', language())}</button>
              </div>

              <Show when={searchLoading()}>
                <div class={styles.searchEmpty}>{t('home.search_indexing', language())}</div>
              </Show>

              <Show when={!searchLoading() && searchQuery().trim() && searchResults().apps.length + searchResults().contacts.length + searchResults().conversations.length + searchResults().calls.length === 0}>
                <div class={styles.searchEmpty}>{t('home.search_empty', language())}</div>
              </Show>

              <div class={styles.searchResults}>
                <Show when={searchResults().apps.length > 0}>
                  <section>
                    <h4>{t('home.section_apps', language())}</h4>
                    <For each={searchResults().apps}>
                      {(app) => (
                        <button class={styles.searchItem} onClick={() => { closeSearch(); router.navigate(app.route); }}>
                          <img src={app.icon} alt={appName(app.id, app.name, language())} />
                          <div>
                            <strong>{appName(app.id, app.name, language())}</strong>
                            <span>{app.route}</span>
                          </div>
                        </button>
                      )}
                    </For>
                  </section>
                </Show>

                <Show when={searchResults().contacts.length > 0}>
                  <section>
                    <h4>{t('home.section_contacts', language())}</h4>
                    <For each={searchResults().contacts}>
                      {(entry) => (
                        <button class={styles.searchItem} onClick={() => { closeSearch(); router.navigate('contacts'); }}>
                          <div class={styles.searchDot}><img src="./img/icons_ios/ui-user.svg" alt="" draggable={false} /></div>
                          <div>
                            <strong>{entry.display}</strong>
                            <span>{entry.number}</span>
                          </div>
                        </button>
                      )}
                    </For>
                  </section>
                </Show>

                <Show when={searchResults().conversations.length > 0}>
                  <section>
                    <h4>{t('home.section_chats', language())}</h4>
                    <For each={searchResults().conversations}>
                      {(entry) => (
                        <button class={styles.searchItem} onClick={() => openMessagesThread(entry.number)}>
                          <div class={styles.searchDot}><img src="./img/icons_ios/ui-chat.svg" alt="" draggable={false} /></div>
                          <div>
                            <strong>{entry.number}</strong>
                            <span>{entry.preview}</span>
                          </div>
                        </button>
                      )}
                    </For>
                  </section>
                </Show>

                <Show when={searchResults().calls.length > 0}>
                  <section>
                    <h4>{t('home.section_calls', language())}</h4>
                    <For each={searchResults().calls}>
                      {(entry) => (
                        <button class={styles.searchItem} onClick={() => { closeSearch(); router.navigate('calls'); }}>
                          <div class={styles.searchDot}><img src="./img/icons_ios/ui-phone.svg" alt="" draggable={false} /></div>
                          <div>
                            <strong>{entry.num}</strong>
                            <span>{timeAgo(new Date(entry.time))}</span>
                          </div>
                        </button>
                      )}
                    </For>
                  </section>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </IconPackProvider>
  );
}
