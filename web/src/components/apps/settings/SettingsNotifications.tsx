import { For } from 'solid-js';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { APP_DEFINITIONS } from '../../../config/apps';
import { appName, t } from '../../../i18n';
import { ICONS } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsNotificationsProps {
  language: () => string;
  phoneState: any;
  notificationsActions: any;
}

export function SettingsNotifications(props: SettingsNotificationsProps) {
  const enabledApps = () => APP_DEFINITIONS.filter((app) => props.phoneState.enabledApps.includes(app.id));

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

      <SectionHeader title={(t('home.section_apps', props.language()) || 'APPS').toUpperCase()} />
      <div class="ios18-list">
        <For each={enabledApps()}>
          {(app, index) => {
            const muted = () => props.notificationsActions.isAppMuted(app.id);
            const unread = () => props.notificationsActions.getUnreadCount(app.id);
            return (
              <div
                class={styles.appRow}
                style={{ "animation-delay": `${index() * 30}ms` }}
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
          }}
        </For>
      </div>
    </div>
  );
}
