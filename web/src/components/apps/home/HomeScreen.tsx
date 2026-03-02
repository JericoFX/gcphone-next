import { createMemo, createSignal, For, Show, createEffect, onMount, onCleanup } from 'solid-js';
import { usePhone } from '../../../store/phone';
import { useNotifications } from '../../../store/notifications';
import { useRouter } from '../../Phone/PhoneFrame';
import { APP_BY_ID } from '../../../config/apps';
import styles from './HomeScreen.module.scss';

export function HomeScreen() {
  const [state, phoneActions] = usePhone();
  const [, notificationsActions] = useNotifications();
  const router = useRouter();
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [selectedApp, setSelectedApp] = createSignal(-1);
  const [editing, setEditing] = createSignal(false);
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [desktopPage, setDesktopPage] = createSignal(0);
  const [touchStartX, setTouchStartX] = createSignal<number | null>(null);
  const [pageTransition, setPageTransition] = createSignal<'next' | 'prev' | null>(null);

  const APPS_PER_PAGE = 12;

  const homeApps = createMemo(() =>
    state.appLayout.home
      .map((id) => APP_BY_ID[id])
      .filter((app): app is NonNullable<typeof app> => Boolean(app))
  );

  const pageCount = createMemo(() => Math.max(1, Math.ceil(homeApps().length / APPS_PER_PAGE)));

  const visibleApps = createMemo(() => {
    const start = desktopPage() * APPS_PER_PAGE;
    return homeApps().slice(start, start + APPS_PER_PAGE);
  });

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
          break;
      }
    };
    
    window.addEventListener('phone:keyUp', handleKeyUp as EventListener);
    
    onCleanup(() => {
      window.removeEventListener('phone:keyUp', handleKeyUp as EventListener);
    });
  });
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };
  
  const openApp = (app: { id: string; route: string }) => {
    if (editing()) return;
    notificationsActions.markAppAsRead(app.id);
    router.navigate(app.route);
  };

  const dropAt = (index: number) => {
    const id = draggingId();
    if (!id) return;

    const globalIndex = desktopPage() * APPS_PER_PAGE + index;
    phoneActions.reorderApp('home', id, globalIndex);

    setDraggingId(null);
  };
  
  return (
    <div class={styles.homeScreen} style={{ 'background-image': `url(${state.settings.wallpaper})` }}>
      <div class={styles.statusBar}>
        <div class={styles.time}>{formatTime(currentTime())}</div>
        <div class={styles.icons}>
          <button class={styles.editBtn} onClick={() => setEditing((v) => !v)}>
            {editing() ? 'OK' : 'Editar'}
          </button>

        </div>
      </div>
      
      <div class={styles.homeTime}>
        <div class={styles.timeLarge}>{formatTime(currentTime())}</div>
        <div class={styles.date}>{formatDate(currentTime())}</div>
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
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropAt(index())}
            >
              <button
                class={styles.appIcon}
                data-testid={`home-app-${app.id}`}
                classList={{ [styles.selected]: selectedApp() === index(), [styles.jiggle]: editing() }}
                draggable
                onDragStart={() => setDraggingId(app.id)}
                onDragEnd={() => setDraggingId(null)}
                onClick={() => openApp(app)}
              >
                <img src={app.icon} alt={app.name} />
                <span class={styles.appName}>{app.name}</span>
                <Show when={editing()}>
                  <span class={styles.unpinBadge}>⋮</span>
                </Show>
                <Show when={notificationsActions.getUnreadCount(app.id) > 0}>
                  <span class={styles.badge}>{notificationsActions.getUnreadCount(app.id)}</span>
                </Show>
              </button>
              <Show when={editing()}>
                <span class={styles.dragHint}>Arrastra</span>
              </Show>
            </div>
          )}
        </For>
        <Show when={editing()}>
          <div class={styles.homeDropZone} onDragOver={(e) => e.preventDefault()} onDrop={() => dropAt(visibleApps().length)} />
        </Show>
      </div>

      <div class={styles.desktopPager}>
        <button class={styles.pageBtn} data-testid="desktop-page-prev" onClick={() => goToPage(desktopPage() - 1)}>‹</button>
        <div class={styles.pageDots}>
          <For each={Array.from({ length: pageCount() })}>
            {(_, idx) => <span data-testid={`desktop-dot-${idx()}`} class={styles.dot} classList={{ [styles.activeDot]: desktopPage() === idx() }} />}
          </For>
        </div>
        <button class={styles.pageBtn} data-testid="desktop-page-next" onClick={() => goToPage(desktopPage() + 1)}>›</button>
      </div>
    </div>
  );
}
