import { For, Show } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { t } from '../../../i18n';
import { CheckIcon, Group, IconImage, ICONS, languages, wallpapers } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsAppearanceProps {
  language: () => string;
  phoneState: any;
  phoneActions: any;
  urlInput: () => string;
  setUrlInput: (v: string) => void;
}

export function SettingsAppearance(props: SettingsAppearanceProps) {
  const themes = [
    { id: 'light', name: 'Claro', icon: ICONS.brightness },
    { id: 'dark', name: 'Oscuro', icon: ICONS.moon },
    { id: 'auto', name: 'Automatico', icon: ICONS.shuffle },
  ];

  const randomWallpaper = () => {
    const random = Math.floor(Math.random() * 1000);
    props.phoneActions.setWallpaper(`https://picsum.photos/seed/${random}/326/742`);
  };

  const applyUrlWallpaper = () => {
    const value = props.urlInput().trim();
    if (!value) return;
    props.phoneActions.setWallpaper(value);
    props.setUrlInput('');
  };

  return (
    <div class={styles.content}>
      <SectionHeader title={t('settings.appearance', props.language()).toUpperCase()} />
      <Group>
        <div class={styles.themeList}>
          <For each={themes}>
            {(theme) => (
              <button class={styles.themeOption} classList={{ [styles.selected]: props.phoneState.settings.theme === theme.id }} onClick={() => props.phoneActions.setTheme(theme.id as 'light' | 'dark' | 'auto')}>
                <span class={styles.themeIcon}><IconImage src={theme.icon} class={styles.themeIconImage} /></span>
                <span class={styles.themeName}>{theme.name}</span>
                {props.phoneState.settings.theme === theme.id && <CheckIcon />}
              </button>
            )}
          </For>
        </div>
      </Group>

      <SectionHeader title={t('settings.wallpapers', props.language()).toUpperCase()} />
      <Group>
        <Show when={props.phoneState.settings.wallpaper}>
          <div class={styles.wallpaperPreview}><img src={props.phoneState.settings.wallpaper} alt="Current wallpaper" /></div>
        </Show>
        <div class={styles.wallpaperGrid}>
          <For each={wallpapers}>
            {(wallpaper) => (
              <button class={styles.wallpaperItem} classList={{ [styles.selected]: props.phoneState.settings.wallpaper === wallpaper }} onClick={() => props.phoneActions.setWallpaper(wallpaper)}>
                <img src={wallpaper} alt="Wallpaper" />
              </button>
            )}
          </For>
        </div>
      </Group>

      <div class={styles.quickActions}>
        <button class={styles.actionBtn} onClick={() => fetchNui('openGallery', { selectWallpaper: true })}>
          <IconImage src={ICONS.gallery} class={styles.actionIcon} /><span>{t('camera.gallery', props.language())}</span>
        </button>
        <button class={styles.actionBtn} onClick={randomWallpaper}>
          <IconImage src={ICONS.shuffle} class={styles.actionIcon} /><span>{t('settings.random_api', props.language())}</span>
        </button>
      </div>

      <div class={styles.customUrl}>
        <input type="url" placeholder="https://example.com/wallpaper.jpg" value={props.urlInput()} onInput={(e) => props.setUrlInput(e.currentTarget.value)} />
        <button onClick={applyUrlWallpaper}>{t('settings.apply', props.language())}</button>
      </div>

      <SectionHeader title={t('settings.language', props.language()).toUpperCase()} />
      <Group>
        <div class={styles.langList}>
          <For each={languages}>
            {(lang) => (
              <button class={styles.langOption} classList={{ [styles.selected]: props.language() === lang.code }} onClick={() => props.phoneActions.setLanguage(lang.code as 'es' | 'en' | 'pt' | 'fr')}>
                <span class={styles.langFlag}>{lang.label}</span>
                <span class={styles.langName}>{lang.name}</span>
                {props.language() === lang.code && <CheckIcon />}
              </button>
            )}
          </For>
        </div>
      </Group>
    </div>
  );
}
