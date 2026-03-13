import { For, Show } from 'solid-js';
import { formatPhoneNumber } from '../../utils/misc';
import styles from './LockScreen.module.scss';

interface MusicSessionState {
  isPlaying: boolean;
  isPaused: boolean;
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5C8 5.72 8.85 5.24 9.52 5.64L18.1 10.64C18.76 11.03 18.76 11.97 18.1 12.36L9.52 17.36C8.85 17.76 8 17.28 8 16.5V6.5Z" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

interface LockScreenWidgetsProps {
  compact: boolean;
  hasNotifications: boolean;
  activeWidget: number;
  visibleNotifications: Array<{ id: string; title: string; appId: string; message: string; route?: string; data?: Record<string, unknown> }>;
  totalCarouselItems: number;
  onSelectWidget: (index: number) => void;
  onNotificationClick: (route?: string, data?: Record<string, unknown>) => void;
  deviceOwnerName?: string;
  phoneNumber?: string;
  imei?: string;
  framework?: 'esx' | 'qbcore' | 'qbox' | 'unknown';
  isStolen?: boolean;
  musicState: MusicSessionState;
  musicStatusLabel: string;
  musicVolumePercent: number;
  onPauseResume: () => void;
  onStop: () => void;
  onVolumeDown: () => void;
  onVolumeUp: () => void;
}

function NotificationPanel(props: Pick<LockScreenWidgetsProps, 'visibleNotifications' | 'onNotificationClick'>) {
  return (
    <>
      <div class={styles.notificationCenterHeader}>
        <span class={styles.widgetLabel}>Notificaciones</span>
        <span class={styles.widgetMeta}>{props.visibleNotifications.length}</span>
      </div>
      <div class={styles.notificationList}>
        <For each={props.visibleNotifications}>
          {(item) => (
            <button
              class={styles.notificationCard}
              classList={{ [styles.notificationCardInteractive]: !!item.route }}
              onClick={() => props.onNotificationClick(item.route, item.data)}
              disabled={!item.route}
            >
              <div class={styles.notificationTop}>
                <strong>{item.title}</strong>
                <span>{item.appId}</span>
              </div>
              <p>{item.message}</p>
            </button>
          )}
        </For>
      </div>
    </>
  );
}

function DevicePanel(props: Pick<LockScreenWidgetsProps, 'deviceOwnerName' | 'phoneNumber' | 'imei' | 'framework' | 'isStolen'>) {
  return (
    <>
      <div class={styles.widgetHeader}>
        <span class={styles.widgetLabel}>Device Info</span>
        <Show when={props.isStolen}>
          <span class={styles.widgetFlag}>Reportado</span>
        </Show>
      </div>
      <div class={styles.deviceInfoRows}>
        <Show when={props.deviceOwnerName}>
          <div class={styles.deviceIdentityRow}>
            <span>Propietario</span>
            <strong>{props.deviceOwnerName}</strong>
          </div>
        </Show>
        <Show when={props.phoneNumber}>
          <div class={styles.deviceIdentityRow}>
            <span>Numero</span>
            <strong>{formatPhoneNumber(props.phoneNumber!, props.framework || 'unknown')}</strong>
          </div>
        </Show>
        <Show when={props.imei}>
          <div class={styles.deviceIdentityRow}>
            <span>IMEI</span>
            <strong>{props.imei}</strong>
          </div>
        </Show>
      </div>
    </>
  );
}

function MusicPanel(props: Pick<LockScreenWidgetsProps, 'musicState' | 'musicStatusLabel' | 'musicVolumePercent' | 'onPauseResume' | 'onStop' | 'onVolumeDown' | 'onVolumeUp'>) {
  return (
    <>
      <div class={styles.widgetHeader}>
        <span class={styles.widgetLabel}>Musica</span>
        <span class={styles.widgetMeta}>{props.musicVolumePercent}%</span>
      </div>
      <strong class={styles.widgetTitle}>{props.musicStatusLabel}</strong>
      <div class={styles.musicControls}>
        <button class={styles.musicIconBtn} type="button" onClick={props.onPauseResume} disabled={!props.musicState.isPlaying} aria-label={props.musicState.isPaused ? 'Reanudar musica' : 'Pausar musica'}>
          <Show when={props.musicState.isPaused} fallback={<PauseIcon />}>
            <PlayIcon />
          </Show>
        </button>
        <button class={styles.musicIconBtn} type="button" onClick={props.onStop} disabled={!props.musicState.isPlaying} aria-label="Detener musica">
          <StopIcon />
        </button>
      </div>
      <div class={styles.volumeControls}>
        <button class={styles.volumeBtn} type="button" onClick={props.onVolumeDown} disabled={!props.musicState.isPlaying}>-</button>
        <div class={styles.volumeBar}><span style={{ width: `${props.musicVolumePercent}%` }} /></div>
        <button class={styles.volumeBtn} type="button" onClick={props.onVolumeUp} disabled={!props.musicState.isPlaying}>+</button>
      </div>
    </>
  );
}

export function LockScreenWidgets(props: LockScreenWidgetsProps) {
  const compactNotificationListClass = `${styles.notificationList} ${styles.notificationListCompact}`;

  if (props.compact) {
    return (
      <div class={styles.widgetStack}>
        <Show when={props.hasNotifications}>
          <section class={`${styles.notificationCenter} ${styles.primaryPanel}`}>
            <NotificationPanel visibleNotifications={props.visibleNotifications} onNotificationClick={props.onNotificationClick} />
          </section>
        </Show>

        <section class={styles.widgetPanel}>
          <DevicePanel
            deviceOwnerName={props.deviceOwnerName}
            phoneNumber={props.phoneNumber}
            imei={props.imei}
            framework={props.framework}
            isStolen={props.isStolen}
          />
        </section>

        <section class={`${styles.widgetPanel} ${styles.musicPanel}`}>
          <MusicPanel
            musicState={props.musicState}
            musicStatusLabel={props.musicStatusLabel}
            musicVolumePercent={props.musicVolumePercent}
            onPauseResume={props.onPauseResume}
            onStop={props.onStop}
            onVolumeDown={props.onVolumeDown}
            onVolumeUp={props.onVolumeUp}
          />
        </section>
      </div>
    );
  }

  return (
    <div class={styles.widgetCarousel}>
      <div class={styles.widgetViewport}>
        <Show when={props.hasNotifications && props.activeWidget === 0}>
          <section class={`${styles.widgetPanel} ${styles.primaryPanel}`}>
            <div class={styles.notificationCenterHeader}>
              <span class={styles.widgetLabel}>Notificaciones</span>
              <span class={styles.widgetMeta}>{props.visibleNotifications.length}</span>
            </div>
            <div class={compactNotificationListClass}>
              <For each={props.visibleNotifications}>
                {(item) => (
                  <button
                    class={styles.notificationCard}
                    classList={{ [styles.notificationCardInteractive]: !!item.route }}
                    onClick={() => props.onNotificationClick(item.route, item.data)}
                    disabled={!item.route}
                  >
                    <div class={styles.notificationTop}>
                      <strong>{item.title}</strong>
                      <span>{item.appId}</span>
                    </div>
                    <p>{item.message}</p>
                  </button>
                )}
              </For>
            </div>
          </section>
        </Show>

        <Show when={props.activeWidget === (props.hasNotifications ? 1 : 0)}>
          <section class={styles.widgetPanel}>
            <DevicePanel
              deviceOwnerName={props.deviceOwnerName}
              phoneNumber={props.phoneNumber}
              imei={props.imei}
              framework={props.framework}
              isStolen={props.isStolen}
            />
          </section>
        </Show>

        <Show when={props.activeWidget === (props.hasNotifications ? 2 : 1)}>
          <section class={`${styles.widgetPanel} ${styles.musicPanel}`}>
            <MusicPanel
              musicState={props.musicState}
              musicStatusLabel={props.musicStatusLabel}
              musicVolumePercent={props.musicVolumePercent}
              onPauseResume={props.onPauseResume}
              onStop={props.onStop}
              onVolumeDown={props.onVolumeDown}
              onVolumeUp={props.onVolumeUp}
            />
          </section>
        </Show>
      </div>
      <div class={styles.carouselDots}>
        <For each={Array.from({ length: props.totalCarouselItems }, (_, index) => index)}>
          {(index) => (
            <button class={styles.dotBtn} type="button" classList={{ [styles.dotBtnActive]: props.activeWidget === index }} onClick={() => props.onSelectWidget(index)} aria-label={`Widget ${index + 1}`} />
          )}
        </For>
      </div>
    </div>
  );
}
