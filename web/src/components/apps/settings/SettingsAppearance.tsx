import { For, Show } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { t, type AppLanguage } from '../../../i18n';
import { CheckIcon, Group, IconImage, ICONS, languages, wallpapers } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsAppearanceProps {
  language: () => string;
  phoneState: any;
  phoneActions: any;
  urlInput: () => string;
  setUrlInput: (v: string) => void;
  onStatus?: (msg: string) => void;
}

export function SettingsAppearance(props: SettingsAppearanceProps) {
  const themes = [
    { id: 'light', name: 'Claro', icon: ICONS.brightness },
    { id: 'dark', name: 'Oscuro', icon: ICONS.moon },
    { id: 'auto', name: 'Automatico', icon: ICONS.shuffle },
  ];

  const setWallpaperWithFeedback = (url: string) => {
    props.phoneActions.setWallpaper(url);
    props.onStatus?.(t('settings.wallpaper_changed', props.language()) || 'Fondo actualizado');
  };

  const randomWallpaper = () => {
    const random = Math.floor(Math.random() * 1000);
    setWallpaperWithFeedback(`https://picsum.photos/seed/${random}/326/742`);
  };

  const applyUrlWallpaper = () => {
    const value = props.urlInput().trim();
    if (!value) return;
    setWallpaperWithFeedback(value);
    props.setUrlInput('');
  };

  return (
    <div class={styles.content}>
      <SectionHeader title={t('settings.wallpapers', props.language()).toUpperCase()} />
      <Group>
        <Show when={props.phoneState.settings.wallpaper}>
          <div class={styles.wallpaperPreview}><img src={props.phoneState.settings.wallpaper} alt="Current wallpaper" /></div>
        </Show>
        <div class={styles.wallpaperGrid}>
          <For each={wallpapers}>
            {(wallpaper) => (
              <button class={styles.wallpaperItem} classList={{ [styles.selected]: props.phoneState.settings.wallpaper === wallpaper }} onClick={() => setWallpaperWithFeedback(wallpaper)}>
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
              <button class={styles.langOption} classList={{ [styles.selected]: props.language() === lang.code }} onClick={() => props.phoneActions.setLanguage(lang.code as AppLanguage)}>
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
