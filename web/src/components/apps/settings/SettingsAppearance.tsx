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
  const themeNames: Record<string, Record<string, string>> = {
    light: { es_ES: 'Claro', en_US: 'Light', fr_FR: 'Clair', de_DE: 'Hell', pt_BR: 'Claro', ru_RU: 'Светлая', pl_PL: 'Jasny', it_IT: 'Chiaro' },
    dark:  { es_ES: 'Oscuro', en_US: 'Dark', fr_FR: 'Sombre', de_DE: 'Dunkel', pt_BR: 'Escuro', ru_RU: 'Тёмная', pl_PL: 'Ciemny', it_IT: 'Scuro' },
    auto:  { es_ES: 'Automático', en_US: 'Automatic', fr_FR: 'Automatique', de_DE: 'Automatisch', pt_BR: 'Automático', ru_RU: 'Авто', pl_PL: 'Automatyczny', it_IT: 'Automatico' },
  };

  const themes = [
    { id: 'light' as const, icon: ICONS.brightness },
    { id: 'dark' as const, icon: ICONS.moon },
    { id: 'auto' as const, icon: ICONS.shuffle },
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

      <SectionHeader title={t('settings.theme', props.language()).toUpperCase()} />
      <Group>
        <div class={styles.themeList}>
          <For each={themes}>
            {(theme) => (
              <button
                class={styles.themeOption}
                classList={{ [styles.selected]: props.phoneState.settings.theme === theme.id }}
                onClick={() => props.phoneActions.setTheme(theme.id)}
              >
                <span class={styles.themeIcon}>
                  <IconImage src={theme.icon} class={styles.themeIconImage} />
                </span>
                <span class={styles.themeName}>{themeNames[theme.id][props.language()] || themeNames[theme.id].en_US}</span>
                {props.phoneState.settings.theme === theme.id && <CheckIcon />}
              </button>
            )}
          </For>
        </div>
      </Group>

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
