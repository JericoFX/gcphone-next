import { For } from 'solid-js';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { APP_DEFINITIONS } from '../../../config/apps';
import { appName, t } from '../../../i18n';
import { Cell, Group, ICONS } from './settingsShared';
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
      <Group>
        <Cell
          icon={ICONS.check} iconBg="iconBlue"
          title={t('settings.mark_all_read', props.language())}
          right="chevron"
          onClick={() => {
            for (const app of APP_DEFINITIONS) props.notificationsActions.markAppAsRead(app.id);
          }}
        />
      </Group>

      <SectionHeader title={(t('home.section_apps', props.language()) || 'APPS').toUpperCase()} />
      <Group>
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
                  class={`${styles.switch} ${!muted() ? styles.switchActive : ''}`}
                  onClick={() => props.notificationsActions.toggleMuteApp(app.id)}
                  role="switch"
                  aria-checked={!muted()}
                >
                  <div class={styles.switchThumb} />
                </div>
                {unread() > 0 && <div class={styles.badge}>{unread()}</div>}
              </div>
            );
          }}
        </For>
      </Group>
    </div>
  );
}
