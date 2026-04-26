import { For, Show, createMemo } from 'solid-js';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { APP_DEFINITIONS } from '../../../config/apps';
import { appName, t } from '../../../i18n';
import { ICONS } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsNotificationsProps {
  language: () => string;
  phoneState: any;
  notifications: any;
  notificationsActions: any;
  focus?: 'all' | 'muted';
}

export function SettingsNotifications(props: SettingsNotificationsProps) {
  const enabledApps = () => APP_DEFINITIONS.filter((app) => props.phoneState.enabledApps.includes(app.id));
  const mutedApps = createMemo(() => {
    const mutedIds = Array.isArray(props.notifications.mutedApps) ? props.notifications.mutedApps : [];
    return mutedIds
      .map((appId: string) => APP_DEFINITIONS.find((app) => app.id === appId))
      .filter(Boolean);
  });

  const renderAppRow = (app: (typeof APP_DEFINITIONS)[number], index: number) => {
    const muted = () => props.notificationsActions.isAppMuted(app.id);
    const unread = () => props.notificationsActions.getUnreadCount(app.id);
    return (
      <div
        class={styles.appRow}
        classList={{ [styles.appRowMuted]: muted() }}
        style={{ "animation-delay": `${index * 30}ms` }}
      >
        <div class={styles.appIcon}><img src={app.icon} alt="" /></div>
        <div class={styles.appInfo}>
          <div class={styles.appName} classList={{ [styles.muted]: muted() }}>
            {appName(app.id, app.name, props.language())}
          </div>
          <div class={styles.appStatus}>
            {muted()
              ? (t('settings.notifications_disabled', props.language()) || 'Silenciada')
              : unread() > 0
                ? t('settings.unread_count', props.language(), { count: unread() })
                : (t('settings.up_to_date', props.language()) || 'Al dia')}
          </div>
        </div>
        <div
          class="ios18-switch"
          role="switch"
          aria-checked={!muted()}
          onClick={() => props.notificationsActions.toggleMuteApp(app.id)}
        >
          <div class="ios18-switch__thumb" />
        </div>
        {unread() > 0 && <div class={styles.badge}>{unread()}</div>}
      </div>
    );
  };

  return (
    <div class={styles.content}>
      <div class="ios18-list">
        <button
          class="ios18-cell"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            for (const app of APP_DEFINITIONS) props.notificationsActions.markAppAsRead(app.id);
          }}
        >
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
            <div class={`${styles.settingsIcon} ${styles.iconBlue}`}>
              <img src={ICONS.check} class={styles.settingsIconImg} alt="" draggable={false} />
            </div>
            <span class="ios18-cell__title">{t('settings.mark_all_read', props.language())}</span>
          </div>
          <div class={styles.chevron} />
        </button>
      </div>

      <Show when={props.focus === 'muted'}>
        <SectionHeader title="SILENCIADAS" />
        <div class="ios18-list">
          <Show when={mutedApps().length > 0} fallback={
            <div class={`${styles.appRow} ${styles.emptyMutedRow}`}>
              <div class={styles.appInfo}>
                <div class={styles.appName}>Sin apps silenciadas</div>
                <div class={styles.appStatus}>Las apps que silencies desde el centro de notificaciones apareceran aca.</div>
              </div>
            </div>
          }>
            <For each={mutedApps()}>
              {(app, index) => renderAppRow(app, index())}
            </For>
          </Show>
        </div>
      </Show>

      <SectionHeader title={(t('home.section_apps', props.language()) || 'APPS').toUpperCase()} />
      <div class="ios18-list">
        <For each={enabledApps()}>
          {(app, index) => renderAppRow(app, index())}
        </For>
      </div>
    </div>
  );
}
