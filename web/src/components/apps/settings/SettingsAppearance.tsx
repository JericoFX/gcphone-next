import { For, Show, createSignal } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { t, type AppLanguage } from '../../../i18n';
import { CheckIcon, IconImage, ICONS, languages, wallpapers } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsAppearanceProps {
  language: () => string;
  phoneState: any;
  phoneActions: any;
  urlInput: () => string;
  setUrlInput: (v: string) => void;
  onStatus?: (msg: string) => void;
}

const themeOptions = [
  { id: 'auto', icon: '' },
  { id: 'light', icon: '' },
  { id: 'dark', icon: '' },
] as const;

const themeNames: Record<string, Record<string, string>> = {
  light: { es: 'Claro', en: 'Light', fr: 'Clair', de: 'Hell', pt: 'Claro', ru: 'Светлая', pl: 'Jasny', it: 'Chiaro' },
  dark:  { es: 'Oscuro', en: 'Dark', fr: 'Sombre', de: 'Dunkel', pt: 'Escuro', ru: 'Тёмная', pl: 'Ciemny', it: 'Scuro' },
  auto:  { es: 'Automatico', en: 'Automatic', fr: 'Automatique', de: 'Automatisch', pt: 'Automatico', ru: 'Авто', pl: 'Automatyczny', it: 'Automatico' },
};

export function SettingsAppearance(props: SettingsAppearanceProps) {
  const [showUrl, setShowUrl] = createSignal(false);

  const setWallpaper = (url: string) => props.phoneActions.setWallpaper(url);

  const randomWallpaper = () => {
    const seed = Math.floor(Math.random() * 1000);
    setWallpaper(`https://picsum.photos/seed/${seed}/326/742`);
  };

  const applyUrlWallpaper = () => {
    const value = props.urlInput().trim();
    if (!value) return;
    setWallpaper(value);
    props.setUrlInput('');
    setShowUrl(false);
  };

  return (
    <div class={styles.content}>
      {/* Wallpaper grid */}
      <div class={styles.wpGrid}>
        <For each={wallpapers}>
          {(wp) => (
            <button
              class={styles.wpCard}
              classList={{ [styles.wpCardActive]: props.phoneState.settings.wallpaper === wp }}
              onClick={() => setWallpaper(wp)}
            >
              <img src={wp} alt="" draggable={false} />
            </button>
          )}
        </For>
      </div>

      {/* Action buttons */}
      <div class={styles.wpActions}>
        <button class={styles.wpActionBtn} onClick={randomWallpaper}>
          <img src={ICONS.shuffle} alt="" draggable={false} />
          <span>Random</span>
        </button>
        <button class={styles.wpActionBtn} onClick={() => fetchNui('openGallery', { selectWallpaper: true })}>
          <img src={ICONS.gallery} alt="" draggable={false} />
          <span>{t('camera.gallery', props.language()) || 'Galeria'}</span>
        </button>
        <button class={styles.wpActionBtn} onClick={() => setShowUrl(!showUrl())}>
          <span style={{ "font-size": "14px" }}>+</span>
          <span>URL</span>
        </button>
      </div>

      <Show when={showUrl()}>
        <div class={styles.customUrlInline}>
          <input
            type="url"
            placeholder="https://..."
            value={props.urlInput()}
            onInput={(e) => props.setUrlInput(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyUrlWallpaper()}
          />
          <button onClick={applyUrlWallpaper}>{t('settings.apply', props.language())}</button>
        </div>
      </Show>

      {/* Theme */}
      <SectionHeader title={t('settings.theme', props.language()) || 'Theme'} />
      <div class="ios18-list">
        <For each={themeOptions}>
          {(opt) => (
            <button
              class="ios18-cell"
              style={{ cursor: 'pointer' }}
              onClick={() => props.phoneActions.setTheme(opt.id)}
            >
              <span class="ios18-cell__title">
                {themeNames[opt.id]?.[props.language()] || themeNames[opt.id]?.en || opt.id}
              </span>
              <Show when={props.phoneState.settings.theme === opt.id}>
                <CheckIcon />
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* Language */}
      <SectionHeader title={t('settings.language', props.language()) || 'Language'} />
      <div class="ios18-list">
        <For each={languages}>
          {(lang) => (
            <button
              class="ios18-cell"
              style={{ cursor: 'pointer' }}
              onClick={() => props.phoneActions.setLanguage(lang.code as AppLanguage)}
            >
              <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
                <span style={{ 'font-size': 'var(--fs-caption1)', 'font-weight': '700', color: 'var(--text-2)', 'min-width': '24px' }}>{lang.label}</span>
                <span class="ios18-cell__title">{lang.name}</span>
              </div>
              <Show when={props.language() === lang.code}>
                <CheckIcon />
              </Show>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
