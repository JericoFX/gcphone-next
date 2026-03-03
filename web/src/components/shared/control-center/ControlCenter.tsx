import { For, Show, createEffect, createMemo, onCleanup } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { useNotifications } from '../../../store/notifications';
import { usePhone } from '../../../store/phone';
import { APP_BY_ID } from '../../../config/apps';
import styles from './ControlCenter.module.scss';

type TileId = 'airplane' | 'dnd' | 'data' | 'silent' | 'gps' | 'preview';


export function ControlCenter() {
  const [notifications, notificationsActions] = useNotifications();
  const [phoneState, phoneActions] = usePhone();
  
  let sheetGestureStartX = 0;
  let sheetGestureStartY = 0;

  const volumePercent = () => Math.round(phoneState.settings.volume * 100);

  const groupedNotifications = createMemo(() => {
    const groups = new Map<string, Array<{ id: string; title: string; message: string; route?: string; data?: Record<string, unknown>; createdAt?: number }>>();
    for (const item of notifications.history) {
      const key = item.appId || 'system';
      const list = groups.get(key) || [];
      list.push({ id: item.id, title: item.title, message: item.message, route: item.route, data: item.data, createdAt: item.createdAt });
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  });

  function previewNotification() {
    notificationsActions.receive({
      id: `preview-${Date.now()}`,
      appId: 'wavechat',
      title: 'WaveChat',
      message: 'Mensaje nuevo de Alex: Estoy en Legion Square',
      icon: '💬',
      route: 'wavechat',
      durationMs: 4200,
      priority: 'high',
    });
  }

  const controlTiles = createMemo(() => {
    const handlers: Record<TileId, { label: string; glyph: string; active?: boolean; onClick: () => void; testId?: string }> = {
      airplane: {
        label: 'Modo avion',
        glyph: '✈',
        active: notifications.airplaneMode,
        onClick: () => notificationsActions.setAirplaneMode(!notifications.airplaneMode),
      },
      dnd: {
        label: 'No molestar',
        glyph: '☾',
        active: notifications.doNotDisturb,
        onClick: () => notificationsActions.setDoNotDisturb(!notifications.doNotDisturb),
      },
      data: {
        label: 'Datos moviles',
        glyph: '◉',
        active: notifications.mobileData,
        onClick: () => notificationsActions.setMobileData(!notifications.mobileData),
      },
      silent: {
        label: 'Silencio',
        glyph: '🔕',
        active: notifications.silentMode,
        onClick: () => notificationsActions.setSilentMode(!notifications.silentMode),
      },
      gps: {
        label: 'GPS',
        glyph: '⌖',
        onClick: () => fetchNui('setGPS', { x: 0, y: 0 }),
      },
      preview: {
        label: 'Probar noti',
        glyph: '◎',
        onClick: previewNotification,
        testId: 'preview-notification-btn',
      },
    };

    return notifications.controlTileOrder
      .map((id) => handlers[id as TileId])
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  });

  const visibleItemsForGroup = (items: Array<{ id: string; title: string; message: string; route?: string; data?: Record<string, unknown>; createdAt?: number }>) => {
    if (notifications.notificationCompactMode) return items.slice(0, 2);
    return items;
  };

  const formatTime = (unix?: number) => {
    if (!unix || unix <= 0) return 'Ahora';
    const diffSeconds = Math.max(0, Math.floor((Date.now() - unix) / 1000));
    if (diffSeconds < 60) return 'Ahora';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
    return `${Math.floor(diffSeconds / 86400)}d`;
  };

  const handleSheetPointerDown = (e: PointerEvent) => {
    sheetGestureStartX = e.clientX;
    sheetGestureStartY = e.clientY;
  };

  const handleSheetPointerUp = (e: PointerEvent, sheet: 'notifications' | 'control') => {
    const deltaX = e.clientX - sheetGestureStartX;
    const deltaY = e.clientY - sheetGestureStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const startedNearBottom = sheetGestureStartY > rect.bottom - rect.height * 0.28;

    if (startedNearBottom && deltaY < -80 && absY > absX) {
      if (sheet === 'notifications') notificationsActions.setNotificationCenterOpen(false);
      if (sheet === 'control') notificationsActions.setControlCenterOpen(false);
      return;
    }

    if (absX > 72 && absX > absY) {
      if (sheet === 'notifications' && deltaX < 0) {
        notificationsActions.setNotificationCenterOpen(false);
        notificationsActions.setControlCenterOpen(true);
      }
      if (sheet === 'control' && deltaX > 0) {
        notificationsActions.setControlCenterOpen(false);
        notificationsActions.setNotificationCenterOpen(true);
      }
    }
  };

  const openRoute = (route?: string, data?: Record<string, unknown>) => {
    if (!route) return;
    window.dispatchEvent(new CustomEvent('phone:openRoute', { detail: { route, data: data || {} } }));
  };

  const ControlToggle = (props: { label: string; active: boolean; onChange: (next: boolean) => void }) => (
    <button class={styles.switchRow} onClick={() => props.onChange(!props.active)}>
      <span>{props.label}</span>
      <span class={styles.switch} classList={{ [styles.switchOn]: props.active }}>
        <span class={styles.switchThumb} />
      </span>
    </button>
  );

  createEffect(() => {
    const onOpenControl = () => notificationsActions.setControlCenterOpen(true);
    const onOpenNotifications = () => notificationsActions.setNotificationCenterOpen(true);

    window.addEventListener('phone:openControlCenter', onOpenControl);
    window.addEventListener('phone:openNotificationCenter', onOpenNotifications);

    onCleanup(() => {
      window.removeEventListener('phone:openControlCenter', onOpenControl);
      window.removeEventListener('phone:openNotificationCenter', onOpenNotifications);
    });
  });

  return (
    <>
      <Show when={notifications.notificationCenterOpen}>
        <div class={styles.overlay} data-testid="notification-center-sheet" onClick={() => notificationsActions.setNotificationCenterOpen(false)}>
          <div
            class={`${styles.sheet} ${styles.notificationSheet}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handleSheetPointerDown}
            onPointerUp={(e) => handleSheetPointerUp(e, 'notifications')}
          >
            <div class={styles.sheetHeader}>
              <div class={styles.grabber} />
              <h3>Notificaciones</h3>
              <button
                class={styles.compactBtn}
                onClick={() => notificationsActions.toggleNotificationCompactMode()}
                data-testid="notification-compact-toggle"
              >
                {notifications.notificationCompactMode ? 'Expandido' : 'Compacto'}
              </button>
            </div>

            <div class={styles.notificationList}>
              <Show when={groupedNotifications().length > 0} fallback={<div class={styles.empty}>Sin notificaciones</div>}>
                <For each={groupedNotifications()}>
                  {([appId, items]) => (
                    <div class={styles.notificationGroup}>
                      <div class={styles.groupTitle}>
                        <img src={APP_BY_ID[appId]?.icon || './img/icons_ios/settings.svg'} alt={appId} />
                        <span>{(APP_BY_ID[appId]?.name || appId).toUpperCase()}</span>
                      </div>
                      <For each={visibleItemsForGroup(items)}>
                        {(item) => (
                          <button
                            class={styles.notificationItem}
                            onClick={() => {
                              notificationsActions.markAppAsRead(appId);
                              notificationsActions.setNotificationCenterOpen(false);
                              openRoute(item.route, item.data);
                            }}
                          >
                            <strong>
                              <span>{item.title}</span>
                              <small>{formatTime(item.createdAt)}</small>
                            </strong>
                            <span>{item.message}</span>
                          </button>
                        )}
                      </For>
                      <Show when={notifications.notificationCompactMode && items.length > 2}>
                        <div class={styles.moreCount}>+{items.length - 2} mas</div>
                      </Show>
                    </div>
                  )}
                </For>
              </Show>
            </div>

            <div class={styles.sheetFooter}>
              <button class={styles.clearBtn} onClick={() => notificationsActions.clear()}>Limpiar</button>
              <button class={styles.closeBtn} onClick={() => notificationsActions.setNotificationCenterOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={notifications.controlCenterOpen}>
        <div class={styles.overlay} data-testid="control-center-sheet" onClick={() => notificationsActions.setControlCenterOpen(false)}>
          <div
            class={`${styles.sheet} ${styles.controlSheet}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handleSheetPointerDown}
            onPointerUp={(e) => handleSheetPointerUp(e, 'control')}
          >
            <div class={styles.sheetHeader}>
              <div class={styles.grabber} />
              <h3>Centro de control</h3>
            </div>

            <div class={styles.presetRow}>
              <button class={styles.presetBtn} classList={{ [styles.activePreset]: notifications.controlTilePreset === 'compact' }} onClick={() => notificationsActions.setControlTilePreset('compact')}>Compacto</button>
              <button class={styles.presetBtn} classList={{ [styles.activePreset]: notifications.controlTilePreset === 'default' }} onClick={() => notificationsActions.setControlTilePreset('default')}>Normal</button>
              <button class={styles.presetBtn} classList={{ [styles.activePreset]: notifications.controlTilePreset === 'large' }} onClick={() => notificationsActions.setControlTilePreset('large')}>Grande</button>
            </div>

            <div class={styles.presetRow}>
              <button class={styles.presetBtn} onClick={() => notificationsActions.applyControlTileOrderPreset('default')}>Orden base</button>
              <button class={styles.presetBtn} onClick={() => notificationsActions.applyControlTileOrderPreset('commute')}>Traslado</button>
              <button class={styles.presetBtn} onClick={() => notificationsActions.applyControlTileOrderPreset('focus')}>Foco</button>
            </div>

            <div
              class={styles.systemGrid}
              classList={{
                [styles.systemGridCompact]: notifications.controlTilePreset === 'compact',
                [styles.systemGridLarge]: notifications.controlTilePreset === 'large',
              }}
            >
              <For each={controlTiles()}>
                {(tile) => (
                  <button class={styles.systemTile} classList={{ [styles.activeTile]: !!tile.active }} onClick={tile.onClick} data-testid={tile.testId}>
                    <span class={styles.glyph}>{tile.glyph}</span>
                    <strong>{tile.label}</strong>
                  </button>
                )}
              </For>
            </div>

            <div class={styles.switchCard}>
              <ControlToggle label="Bloqueo de rotacion" active={notifications.rotationLock} onChange={notificationsActions.setRotationLock} />
              <ControlToggle label="No molestar" active={notifications.doNotDisturb} onChange={notificationsActions.setDoNotDisturb} />
              <ControlToggle label="Modo avion" active={notifications.airplaneMode} onChange={notificationsActions.setAirplaneMode} />
            </div>

            <div class={styles.sliderCard}>
              <span>Brillo</span>
              <input 
                class={`${styles.slider} ios-slider`}
                type="range" 
                min="40" 
                max="120" 
                value={Math.round(notifications.brightness * 100)} 
                onInput={(e) => notificationsActions.setBrightness(Number(e.currentTarget.value) / 100)} 
              />
              <strong>{Math.round(notifications.brightness * 100)}%</strong>
            </div>

            <div class={styles.sliderCard}>
              <span>Volumen</span>
              <input 
                class={`${styles.slider} ios-slider`}
                type="range" 
                min="0" 
                max="100" 
                value={volumePercent()} 
                onInput={(e) => phoneActions.setVolume(Number(e.currentTarget.value) / 100)} 
              />
              <strong>{volumePercent()}%</strong>
            </div>

            <div class={styles.sheetFooter}>
              <button class={styles.closeBtn} onClick={() => notificationsActions.setControlCenterOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
