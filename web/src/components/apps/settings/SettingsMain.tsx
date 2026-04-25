import { createSignal, For, Show } from 'solid-js';
import { t } from '../../../i18n';
import { ICONS, IconImage } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsMainProps {
  language: () => string;
  notifications: any;
  notificationsActions: any;
  liveLocationEnabled: () => boolean;
  phoneVersion?: string;
  playerName?: string;
  phoneNumber?: string;
  onNavigate: (section: string) => void;
}

interface SearchEntry {
  id: string;
  icon: string;
  iconBg: string;
  section: string;
  breadcrumb?: string;
}

const SEARCH_INDEX: SearchEntry[] = [
  { id: 'airplane',      icon: ICONS.airplane,      iconBg: 'iconOrange', section: 'main' },
  { id: 'dnd',           icon: ICONS.moon,           iconBg: 'iconPurple', section: 'main' },
  { id: 'silent',        icon: ICONS.mute,           iconBg: 'iconRed',    section: 'main' },
  { id: 'brightness',    icon: ICONS.brightness,     iconBg: 'iconBlue',   section: 'main' },
  { id: 'appearance',    icon: ICONS.appearance,     iconBg: 'iconBlue',   section: 'appearance' },
  { id: 'sound',         icon: ICONS.sound,          iconBg: 'iconPink',   section: 'sound' },
  { id: 'security',      icon: ICONS.security,       iconBg: 'iconRed',    section: 'security' },
  { id: 'notifications', icon: ICONS.notifications,  iconBg: 'iconRed',    section: 'notifications' },
  { id: 'appsandpermissions', icon: './img/icons_ios/ui-grid.svg', iconBg: 'iconBlue', section: 'appsandpermissions' },
  { id: 'system',        icon: ICONS.location,       iconBg: 'iconBlue',   section: 'system' },
  { id: 'about',         icon: ICONS.info,           iconBg: 'iconGray',   section: 'about' },
];

function getSearchName(id: string, lang: string): string {
  switch (id) {
    case 'airplane':      return t('settings.airplane', lang);
    case 'dnd':           return t('settings.dnd', lang);
    case 'silent':        return t('settings.silent', lang);
    case 'brightness':    return t('settings.brightness', lang);
    case 'appearance':    return t('settings.appearance', lang);
    case 'sound':         return t('settings.tab.sound', lang);
    case 'security':      return t('settings.tab.security', lang);
    case 'notifications': return t('control.notifications', lang);
    case 'appsandpermissions': return 'Apps y Permisos';
    case 'system':        return t('settings.system', lang);
    case 'about':         return t('settings.about_gcphone', lang);
    default:              return id;
  }
}

function getSectionLabel(section: string, lang: string): string {
  switch (section) {
    case 'appearance':    return t('settings.appearance', lang);
    case 'sound':         return t('settings.tab.sound', lang);
    case 'security':      return t('settings.tab.security', lang);
    case 'notifications': return t('control.notifications', lang);
    case 'appsandpermissions': return 'Apps y Permisos';
    case 'system':        return t('settings.system', lang);
    case 'about':         return t('settings.about_gcphone', lang);
    case 'main':          return t('settings.quick_controls', lang);
    default:              return section;
  }
}

function SettingsIcon(props: { icon: string; bg: string }) {
  return (
    <div class={`${styles.settingsIcon} ${styles[props.bg as keyof typeof styles] ?? ''}`}>
      <IconImage src={props.icon} class={styles.settingsIconImg} />
    </div>
  );
}

export function SettingsMain(props: SettingsMainProps) {
  const [query, setQuery] = createSignal('');

  const filtered = () => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX.filter((entry) =>
      getSearchName(entry.id, props.language()).toLowerCase().includes(q)
    );
  };

  const isSearching = () => query().trim().length > 0;

  return (
    <div class={styles.content}>
      {/* Search bar */}
      <div class={styles.searchBar}>
        <input
          class={styles.searchInput}
          type="search"
          placeholder={t('settings.search', props.language())}
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
      </div>

      <Show when={isSearching()}>
        <Show
          when={filtered().length > 0}
          fallback={
            <div class={`ios18-list ${styles.searchResults}`}>
              <div class={styles.searchEmpty}>{t('settings.search.no_results', props.language())}</div>
            </div>
          }
        >
          <div class={`ios18-list ${styles.searchResults}`}>
            <For each={filtered()}>
              {(entry) => (
                <button
                  class={styles.searchItem}
                  onClick={() => props.onNavigate(entry.section)}
                >
                  <div class={`${styles.searchItemIcon} ${styles[entry.iconBg as keyof typeof styles] ?? ''}`}>
                    <img class={styles.searchItemIconImg} src={entry.icon} alt="" draggable={false} />
                  </div>
                  <div class={styles.searchItemText}>
                    <div class={styles.searchItemName}>{getSearchName(entry.id, props.language())}</div>
                    <div class={styles.searchItemBreadcrumb}>{getSectionLabel(entry.section, props.language())}</div>
                  </div>
                  <div class={styles.chevron} />
                </button>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={!isSearching()}>
        {/* Profile card */}
        <div class="ios18-list">
          <button
            class="ios18-cell"
            style={{ cursor: 'pointer', width: '100%', 'text-align': 'left', background: 'transparent', border: 'none' }}
            onClick={() => props.onNavigate('about')}
          >
            <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', flex: '1' }}>
              <div class={styles.profileAvatar}>
                <span>{(props.playerName || 'U').charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <div class="ios18-cell__title" style={{ 'font-size': 'var(--fs-headline)' }}>
                  {props.playerName || t('settings.citizen', props.language())}
                </div>
                <div class="ios18-cell__subtitle">
                  {props.phoneNumber || t('settings.phone_settings', props.language())}
                </div>
              </div>
            </div>
            <div class={styles.chevron} />
          </button>
        </div>

        {/* Quick controls group */}
        <div class="ios18-list">
          {/* Airplane mode */}
          <div class="ios18-cell">
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon={ICONS.airplane} bg="iconOrange" />
              <span class="ios18-cell__title">{t('settings.airplane', props.language())}</span>
            </div>
            <div
              class="ios18-switch"
              role="switch"
              aria-checked={props.notifications.airplaneMode}
              style={{ cursor: 'pointer' }}
              onClick={() => props.notificationsActions.setAirplaneMode(!props.notifications.airplaneMode)}
            >
              <div class="ios18-switch__thumb" />
            </div>
          </div>

          {/* Do Not Disturb */}
          <div class="ios18-cell">
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon={ICONS.moon} bg="iconPurple" />
              <span class="ios18-cell__title">{t('settings.dnd', props.language())}</span>
            </div>
            <div
              class="ios18-switch"
              role="switch"
              aria-checked={props.notifications.doNotDisturb}
              style={{ cursor: 'pointer' }}
              onClick={() => props.notificationsActions.setDoNotDisturb(!props.notifications.doNotDisturb)}
            >
              <div class="ios18-switch__thumb" />
            </div>
          </div>

          {/* Silent mode */}
          <div class="ios18-cell">
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon={ICONS.mute} bg="iconRed" />
              <span class="ios18-cell__title">{t('settings.silent', props.language())}</span>
            </div>
            <div
              class="ios18-switch"
              role="switch"
              aria-checked={props.notifications.silentMode}
              style={{ cursor: 'pointer' }}
              onClick={() => props.notificationsActions.setSilentMode(!props.notifications.silentMode)}
            >
              <div class="ios18-switch__thumb" />
            </div>
          </div>

          {/* Brightness */}
          <div class="ios18-cell" style={{ 'flex-direction': 'column', 'align-items': 'stretch', gap: '6px' }}>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
              <SettingsIcon icon={ICONS.brightness} bg="iconBlue" />
              <span class="ios18-cell__title">{t('settings.brightness', props.language())}</span>
            </div>
            <input
              class={styles.slider}
              type="range"
              min={40}
              max={120}
              value={Math.round(props.notifications.brightness * 100)}
              onInput={(e) => props.notificationsActions.setBrightness(Number(e.currentTarget.value) / 100)}
            />
          </div>
        </div>

        {/* Settings group */}
        <div class="ios18-list">
          <button
            class="ios18-cell"
            style={{ cursor: 'pointer', width: '100%', 'text-align': 'left', background: 'transparent', border: 'none' }}
            onClick={() => props.onNavigate('appearance')}
          >
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon={ICONS.appearance} bg="iconBlue" />
              <span class="ios18-cell__title">{t('settings.appearance', props.language())}</span>
            </div>
            <div class={styles.chevron} />
          </button>

          <button
            class="ios18-cell"
            style={{ cursor: 'pointer', width: '100%', 'text-align': 'left', background: 'transparent', border: 'none' }}
            onClick={() => props.onNavigate('sound')}
          >
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon={ICONS.sound} bg="iconPink" />
              <span class="ios18-cell__title">{t('settings.tab.sound', props.language())}</span>
            </div>
            <div class={styles.chevron} />
          </button>

          <button
            class="ios18-cell"
            style={{ cursor: 'pointer', width: '100%', 'text-align': 'left', background: 'transparent', border: 'none' }}
            onClick={() => props.onNavigate('security')}
          >
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon={ICONS.security} bg="iconRed" />
              <span class="ios18-cell__title">{t('settings.tab.security', props.language())}</span>
            </div>
            <div class={styles.chevron} />
          </button>

          <button
            class="ios18-cell"
            style={{ cursor: 'pointer', width: '100%', 'text-align': 'left', background: 'transparent', border: 'none' }}
            onClick={() => props.onNavigate('notifications')}
          >
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon={ICONS.notifications} bg="iconRed" />
              <span class="ios18-cell__title">{t('control.notifications', props.language())}</span>
            </div>
            <div class={styles.chevron} />
          </button>

          <button
            class="ios18-cell"
            style={{ cursor: 'pointer', width: '100%', 'text-align': 'left', background: 'transparent', border: 'none' }}
            onClick={() => props.onNavigate('appsandpermissions')}
          >
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon="./img/icons_ios/ui-grid.svg" bg="iconBlue" />
              <span class="ios18-cell__title">Apps y Permisos</span>
            </div>
            <div class={styles.chevron} />
          </button>
        </div>

        {/* System group */}
        <div class="ios18-list">
          <button
            class="ios18-cell"
            style={{ cursor: 'pointer', width: '100%', 'text-align': 'left', background: 'transparent', border: 'none' }}
            onClick={() => props.onNavigate('system')}
          >
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon={ICONS.location} bg="iconBlue" />
              <span class="ios18-cell__title">{t('settings.system', props.language())}</span>
            </div>
            <div class={styles.chevron} />
          </button>

          <button
            class="ios18-cell"
            style={{ cursor: 'pointer', width: '100%', 'text-align': 'left', background: 'transparent', border: 'none' }}
            onClick={() => props.onNavigate('about')}
          >
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <SettingsIcon icon={ICONS.info} bg="iconGray" />
              <span class="ios18-cell__title">{t('settings.about_gcphone', props.language())}</span>
            </div>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
              <Show when={props.phoneVersion}>
                <span class="ios18-cell__subtitle">{props.phoneVersion}</span>
              </Show>
              <div class={styles.chevron} />
            </div>
          </button>
        </div>
      </Show>
    </div>
  );
}
