import { For } from 'solid-js';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { APP_DEFINITIONS } from '../../../config/apps';
import { appName, t } from '../../../i18n';
import { Group, ICONS, IconImage } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsNotificationsProps {
  language: () => string;
  phoneState: any;
  notificationsActions: any;
}

export function SettingsNotifications(props: SettingsNotificationsProps) {
  return (
    <div class={styles.content}>
      <SectionHeader title={t('home.section_apps', props.language()).toUpperCase()} />
      <Group>
        <For each={APP_DEFINITIONS.filter((app) => props.phoneState.enabledApps.includes(app.id))}>
          {(app) => {
            const unread = () => props.notificationsActions.getUnreadCount(app.id);
            const muted = () => props.notificationsActions.isAppMuted(app.id);
            return (
              <div class={styles.appRow}>
                <div class={styles.appIcon}><img src={app.icon} alt={appName(app.id, app.name, props.language())} /></div>
                <div class={styles.appInfo}>
                  <div class={styles.appName}>{appName(app.id, app.name, props.language())}</div>
                  <div class={styles.appStatus}>{muted() ? 'Notificaciones desactivadas' : unread() > 0 ? t('settings.unread_count', props.language(), { count: unread() }) : t('settings.up_to_date', props.language())}</div>
                </div>
                <div class={`${styles.switch} ${!muted() ? styles.switchActive : ''}`} onClick={() => props.notificationsActions.toggleMuteApp(app.id)} role="switch" aria-checked={!muted()}>
                  <div class={styles.switchThumb} />
                </div>
                {unread() > 0
                  ? <div class={styles.badge}>{unread()}</div>
                  : <div class={styles.okIcon}><IconImage src={ICONS.check} class={styles.okIconImage} /></div>
                }
              </div>
            );
          }}
        </For>
      </Group>

      <button class={styles.clearBtn} onClick={() => { for (const app of APP_DEFINITIONS) props.notificationsActions.markAppAsRead(app.id); }}>
        {t('settings.mark_all_read', props.language())}
      </button>
    </div>
  );
}
