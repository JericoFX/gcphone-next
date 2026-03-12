import { createMemo, createSelector, createSignal, For, Show, createEffect, onMount, onCleanup, untrack } from 'solid-js';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { useRouter } from '../../Phone/PhoneFrame';
import { APP_BY_ID } from '../../../config/apps';
import { appName, formatDate as formatDateI18n, formatTime as formatTimeI18n, t } from '../../../i18n';
import { fetchNui } from '../../../utils/fetchNui';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { timeAgo } from '../../../utils/misc';
import styles from './HomeScreen.module.scss';

export function HomeScreen() {
  const [state, phoneActions] = usePhone();
  const [, notificationsActions] = useNotifications();
  const router = useRouter();
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [selectedApp, setSelectedApp] = createSignal(-1);
  const [editing, setEditing] = createSignal(false);
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);
  const [desktopPage, setDesktopPage] = createSignal(0);
  const [touchStartX, setTouchStartX] = createSignal<number | null>(null);
  const [pageTransition, setPageTransition] = createSignal<'next' | 'prev' | null>(null);
  const [openFolderId, setOpenFolderId] = createSignal<string | null>(null);
  const [musicNowPlaying, setMusicNowPlaying] = createSignal('');
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [searchContacts, setSearchContacts] = createSignal<Array<{ number: string; display: string }>>([]);
  const [searchConversations, setSearchConversations] = createSignal<Array<{ number: string; preview: string; time: string }>>([]);
  const [searchCalls, setSearchCalls] = createSignal<Array<{ num: string; time: string }>>([]);

  const APPS_PER_PAGE = 12;

  const homeApps = createMemo(() => {
    const enabled = new Set(state.enabledApps);
    const ordered = state.appLayout.home
      .map((id) => APP_BY_ID[id])
      .filter((app): app is NonNullable<typeof app> => Boolean(app) && enabled.has(app.id));

    const required = (['contacts', 'messages', 'mail'] as const).filter((id) => enabled.has(id));
    const present = new Set(ordered.map((app) => app.id));
    const pinned = required
      .map((id) => APP_BY_ID[id])
      .filter((app): app is NonNullable<typeof app> => Boolean(app) && !present.has(app.id));

    return [...pinned, ...ordered];
  });

  const pageCount = createMemo(() => Math.max(1, Math.ceil(homeApps().length / APPS_PER_PAGE)));
  const isSelected = createSelector(selectedApp);
  const isDragOverIndex = createSelector(dragOverIndex);
  const isDraggingApp = createSelector(draggingId);
  const language = createMemo(() => state.settings.language || 'es');

  const folderGroups = createMemo(() => {
    const socialSet = new Set(['messages', 'wavechat', 'chirp', 'snap', 'clips', 'darkrooms']);
    const utilitySet = new Set(['camera', 'gallery', 'maps', 'notes', 'settings']);

    const socialApps = homeApps().filter((app) => socialSet.has(app.id));
    const utilityApps = homeApps().filter((app) => utilitySet.has(app.id));

    return [
      { id: 'social', name: t('home.folder.social', language()), icon: './img/icons_ios/ui-chat.svg', apps: socialApps },
      { id: 'utility', name: t('home.folder.utility', language()), icon: './img/icons_ios/settings.svg', apps: utilityApps },
    ].filter((group) => group.apps.length > 0);
  });

  const visibleApps = createMemo(() => {
    const start = desktopPage() * APPS_PER_PAGE;
    return homeApps().slice(start, start + APPS_PER_PAGE);
  });

  const openFolder = createMemo(() => {
    const id = openFolderId();
    if (!id) return null;
    return folderGroups().find((group) => group.id === id) || null;
  });

  const formattedTime = createMemo(() => formatTime(currentTime()));
  const formattedDate = createMemo(() => formatDate(currentTime()));
  const formattedWidgetDate = createMemo(() => formatDateI18n(currentTime(), language(), { day: '2-digit', month: 'short' }));

  const searchResults = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    if (!q) {
      return {
        apps: [] as Array<{ id: string; name: string; icon: string; route: string }>,
        contacts: [] as Array<{ number: string; display: string }>,
        conversations: [] as Array<{ number: string; preview: string; time: string }>,
        calls: [] as Array<{ num: string; time: string }>,
      };
    }

    const apps = state.enabledApps
      .map((id) => APP_BY_ID[id])
      .filter((app): app is NonNullable<typeof app> => Boolean(app))
      .filter((app) => {
        const label = appName(app.id, app.name, language()).toLowerCase();
        return label.includes(q) || app.id.toLowerCase().includes(q);
      })
      .slice(0, 6);

    const contacts = searchContacts()
      .filter((entry) => entry.display.toLowerCase().includes(q) || entry.number.toLowerCase().includes(q))
      .slice(0, 6);

    const conversations = searchConversations()
      .filter((entry) => entry.number.toLowerCase().includes(q) || entry.preview.toLowerCase().includes(q))
      .slice(0, 6);

    const calls = searchCalls()
      .filter((entry) => entry.num.toLowerCase().includes(q))
      .slice(0, 6);

    return { apps, contacts, conversations, calls };
  });

  const hasSearchMatches = createMemo(() => {
    const results = searchResults();
    return results.apps.length + results.contacts.length + results.conversations.length + results.calls.length > 0;
  });

  const loadSearchIndex = async () => {
    setSearchLoading(true);
    const [contacts, messages, calls] = await Promise.all([
      fetchNui<Array<{ number: string; display: string }>>('getContacts', undefined, []),
      fetchNui<Array<{ owner: number; receiver: string; transmitter: string; message: string; time: string }>>('getMessages', undefined, []),
      fetchNui<Array<{ num: string; time: string }>>('getCallHistory', undefined, []),
    ]);

    setSearchContacts((contacts || []).slice(0, 300));

    const byNumber = new Map<string, { number: string; preview: string; time: string }>();
    for (const msg of messages || []) {
      const number = msg.owner === 1 ? msg.receiver : msg.transmitter;
      if (!number || byNumber.has(number)) continue;
      byNumber.set(number, {
        number,
        preview: msg.message || t('home.section_chats', language()),
        time: msg.time,
      });
      if (byNumber.size >= 300) break;
    }
    setSearchConversations(Array.from(byNumber.values()));
    setSearchCalls((calls || []).slice(0, 300));
    setSearchLoading(false);
  };

  const openSearch = () => {
    setSearchOpen(true);
    if (searchContacts().length === 0 && !searchLoading()) {
      void loadSearchIndex();
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  const openMessagesThread = (number: string) => {
    closeSearch();
    router.navigate('messages', { phoneNumber: number });
  };

  createEffect(() => {
    if (desktopPage() > pageCount() - 1) setDesktopPage(Math.max(0, pageCount() - 1));
  });

  createEffect(() => {
    window.localStorage.setItem('gcphone:desktopPage', String(desktopPage()));
  });
  
  let timer: number | undefined;
  let pageTransitionTimer: number | undefined;

  const goToPage = (nextPage: number) => {
    const clamped = Math.max(0, Math.min(pageCount() - 1, nextPage));
    if (clamped === desktopPage()) return;
    const direction = clamped > desktopPage() ? 'next' : 'prev';
    setPageTransition(null);
    setDesktopPage(clamped);
    requestAnimationFrame(() => setPageTransition(direction));
    if (pageTransitionTimer) clearTimeout(pageTransitionTimer);
    pageTransitionTimer = window.setTimeout(() => setPageTransition(null), 340);
  };
  
  onMount(() => {
    const savedPage = Number(window.localStorage.getItem('gcphone:desktopPage') || '0');
    if (Number.isFinite(savedPage) && savedPage >= 0) setDesktopPage(savedPage);

    timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    setMusicNowPlaying(window.localStorage.getItem('gcphone:musicNowPlaying') || t('home.music_idle', language()));

    const onMusicStorage = () => {
      setMusicNowPlaying(window.localStorage.getItem('gcphone:musicNowPlaying') || t('home.music_idle', language()));
    };

    window.addEventListener('storage', onMusicStorage);
    onCleanup(() => window.removeEventListener('storage', onMusicStorage));
  });
  
  onCleanup(() => {
    if (timer) clearInterval(timer);
    if (pageTransitionTimer) clearTimeout(pageTransitionTimer);
  });
  
  createEffect(() => {
    const handleKeyUp = (e: CustomEvent<string>) => {
      const key = e.detail;
      
      switch (key) {
        case 'ArrowUp':
          setSelectedApp(prev => Math.max(0, prev - 4));
          break;
        case 'ArrowDown':
          setSelectedApp(prev => Math.min(visibleApps().length - 1, prev + 4));
          break;
        case 'ArrowLeft':
          if (selectedApp() === 0 && desktopPage() > 0) {
            goToPage(desktopPage() - 1);
            setSelectedApp(0);
          } else {
            setSelectedApp(prev => Math.max(0, prev - 1));
          }
          break;
        case 'ArrowRight':
          if (selectedApp() === visibleApps().length - 1 && desktopPage() < pageCount() - 1) {
            goToPage(desktopPage() + 1);
            setSelectedApp(0);
          } else {
            setSelectedApp(prev => Math.min(visibleApps().length - 1, prev + 1));
          }
          break;
        case 'Enter':
          if (selectedApp() >= 0 && selectedApp() < visibleApps().length) {
            router.navigate(visibleApps()[selectedApp()].route);
          }
          break;
        case 'Backspace':
          if (openFolderId()) {
            setOpenFolderId(null);
            break;
          }
          if (searchOpen()) {
            closeSearch();
          }
          break;
      }
    };
    
    window.addEventListener('phone:keyUp', handleKeyUp as EventListener);
    
    onCleanup(() => {
      window.removeEventListener('phone:keyUp', handleKeyUp as EventListener);
    });
  });
  
  function formatTime(date: Date) {
    return formatTimeI18n(date, language(), { hour: '2-digit', minute: '2-digit' });
  }
  
  function formatDate(date: Date) {
    return formatDateI18n(date, language(), {
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  }
  
  const openApp = (app: { id: string; route: string }) => {
    if (untrack(editing)) return;
    notificationsActions.markAppAsRead(app.id);
    router.navigate(app.route);
  };

  const dropAt = (index: number) => {
    const id = draggingId();
    if (!id) return;

    const globalIndex = desktopPage() * APPS_PER_PAGE + index;
    phoneActions.reorderApp('home', id, globalIndex);

    setDraggingId(null);
    setDragOverIndex(null);
  };
  
  return (
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
      
      <div class={styles.homeTime}>
        <div class={styles.timeLarge}>{formatTime(currentTime())}</div>
        <div class={styles.date}>{formatDate(currentTime())}</div>
      </div>

      <div class={styles.widgetsRow}>
        <button class={styles.widgetCard} onClick={() => router.navigate('maps')}>
          <span class={styles.widgetLabel}>{t('home.widget_maps', language())}</span>
          <strong>{formatDateI18n(currentTime(), language(), { day: '2-digit', month: 'short' })}</strong>
          <small>{t('home.widget_maps_hint', language())}</small>
        </button>
        <button class={styles.widgetCard} onClick={() => router.navigate('music')}>
          <span class={styles.widgetLabel}>{t('home.now_playing', language())}</span>
          <strong>{musicNowPlaying()}</strong>
          <small>{t('home.widget_music_hint', language())}</small>
        </button>
      </div>

      <div class={styles.foldersRow}>
        <For each={folderGroups()}>
          {(group) => (
            <button class={styles.folderPill} onClick={() => setOpenFolderId(group.id)}>
              <img src={group.icon} alt="" draggable={false} />
              <strong>{group.name}</strong>
              <em>{group.apps.length}</em>
            </button>
          )}
        </For>
      </div>
      
      <div
        class={styles.homeApps}
        classList={{ [styles.pageShiftNext]: pageTransition() === 'next', [styles.pageShiftPrev]: pageTransition() === 'prev' }}
        onTouchStart={(e) => setTouchStartX(e.changedTouches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchStartX();
          const end = e.changedTouches[0]?.clientX;
          setTouchStartX(null);
          if (start === null || end === undefined) return;
          const delta = end - start;
          if (delta > 44) goToPage(desktopPage() - 1);
          if (delta < -44) goToPage(desktopPage() + 1);
        }}
      >
        <For each={visibleApps()}>
          {(app, index) => (
            <div
              class={styles.appSlot}
              classList={{ [styles.appSlotDropTarget]: isDragOverIndex(index()) }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setDragOverIndex(index())}
              onDragLeave={() => setDragOverIndex((current) => (current === index() ? null : current))}
              onDrop={() => dropAt(index())}
            >
              <button
                class={styles.appIcon}
                data-testid={`home-app-${app.id}`}
                classList={{ [styles.selected]: isSelected(index()), [styles.jiggle]: editing(), [styles.appIconDragging]: isDraggingApp(app.id) }}
                draggable
                onDragStart={() => setDraggingId(app.id)}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverIndex(null);
                }}
                onClick={() => openApp(app)}
              >
                <img src={app.icon} alt={appName(app.id, app.name, language())} />
                <span class={styles.appName}>{appName(app.id, app.name, language())}</span>
                <Show when={editing()}>
                  <span class={styles.unpinBadge}>⋮</span>
                </Show>
                <Show when={notificationsActions.getUnreadCount(app.id) > 0}>
                  <span class={styles.badge}>{notificationsActions.getUnreadCount(app.id)}</span>
                </Show>
              </button>
              <Show when={editing()}>
                <span class={styles.dragHint}>{t('home.drag', language())}</span>
              </Show>
            </div>
          )}
        </For>
        <Show when={editing()}>
          <div
            class={styles.homeDropZone}
            classList={{ [styles.appSlotDropTarget]: isDragOverIndex(visibleApps().length) }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOverIndex(visibleApps().length)}
            onDragLeave={() => setDragOverIndex((current) => (current === visibleApps().length ? null : current))}
            onDrop={() => dropAt(visibleApps().length)}
          />
        </Show>
      </div>

      <div class={styles.desktopPager}>
        <button class={styles.pageBtn} data-testid="desktop-page-prev" onClick={() => goToPage(desktopPage() - 1)}><img src="./img/icons_ios/ui-chevron-left.svg" alt="" draggable={false} /></button>
        <div class={styles.pageDots}>
          <For each={Array.from({ length: pageCount() })}>
            {(_, idx) => <span data-testid={`desktop-dot-${idx()}`} class={styles.dot} classList={{ [styles.activeDot]: desktopPage() === idx() }} />}
          </For>
        </div>
        <button class={styles.pageBtn} data-testid="desktop-page-next" onClick={() => goToPage(desktopPage() + 1)}><img src="./img/icons_ios/ui-chevron-right.svg" alt="" draggable={false} /></button>
      </div>

      <Show when={openFolderId()}>
        {(folderId) => {
          const folder = () => folderGroups().find((group) => group.id === folderId()) || null;
          return (
            <div class={styles.folderOverlay} onClick={() => setOpenFolderId(null)}>
              <div class={styles.folderPanel} onClick={(e) => e.stopPropagation()}>
                <div class={styles.folderHeader}>
                  <strong>{folder()?.name || t('home.folder_default', language())}</strong>
                  <button onClick={() => setOpenFolderId(null)}>{t('home.close', language())}</button>
                </div>
                <div class={styles.folderGrid}>
                  <For each={folder()?.apps || []}>
                    {(app) => (
                      <button
                        class={styles.folderApp}
                        onClick={() => {
                          setOpenFolderId(null);
                          openApp(app);
                        }}
                      >
                        <img src={app.icon} alt={appName(app.id, app.name, language())} />
                        <span>{appName(app.id, app.name, language())}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
          );
        }}
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
  );
}
