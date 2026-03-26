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

const phoneCases = [
  { id: 'default', preview: '#1c1c1e' },
  { id: 'silver', preview: 'linear-gradient(135deg, #c0c0c0, #e8e8e8)' },
  { id: 'gold', preview: 'linear-gradient(135deg, #c5a55a, #e8d48b)' },
  { id: 'rosegold', preview: 'linear-gradient(135deg, #b76e79, #e8b4b8)' },
  { id: 'midnight', preview: '#0a0a0f' },
  { id: 'red', preview: '#c0272d' },
  { id: 'blue', preview: '#1a4b8c' },
  { id: 'green', preview: '#2d6a4f' },
];

const accentColors = [
  { id: 'blue', hex: '#007aff' },
  { id: 'purple', hex: '#af52de' },
  { id: 'pink', hex: '#ff2d55' },
  { id: 'red', hex: '#ff3b30' },
  { id: 'orange', hex: '#ff9500' },
  { id: 'green', hex: '#34c759' },
  { id: 'teal', hex: '#5ac8fa' },
];

const fontSizes = [
  { id: 'small', preview: '12px', label: { es: 'Pequeno', en: 'Small', fr: 'Petit', de: 'Klein', pt: 'Pequeno', ru: 'Маленький', pl: 'Maly', it: 'Piccolo' } },
  { id: 'default', preview: '14px', label: { es: 'Normal', en: 'Default', fr: 'Normal', de: 'Normal', pt: 'Normal', ru: 'Обычный', pl: 'Domyslny', it: 'Normale' } },
  { id: 'large', preview: '16px', label: { es: 'Grande', en: 'Large', fr: 'Grand', de: 'Gross', pt: 'Grande', ru: 'Большой', pl: 'Duzy', it: 'Grande' } },
  { id: 'xl', preview: '18px', label: { es: 'Extra Grande', en: 'Extra Large', fr: 'Tres grand', de: 'Sehr gross', pt: 'Extra grande', ru: 'Огромный', pl: 'Bardzo duzy', it: 'Extra grande' } },
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

      {/* Phone Case */}
      <SectionHeader title={t('settings.phone_case', props.language()) || 'Funda'} />
      <div style={{ display: 'flex', gap: '8px', padding: '4px 0 8px', 'flex-wrap': 'wrap' }}>
        <For each={phoneCases}>
          {(pc) => (
            <button
              style={{
                width: '36px',
                height: '36px',
                'border-radius': '8px',
                border: (props.phoneState.settings.phoneCase || 'default') === pc.id ? '2px solid var(--tint)' : '1px solid var(--border)',
                background: pc.preview,
                cursor: 'pointer',
                transition: 'transform 120ms ease',
                transform: (props.phoneState.settings.phoneCase || 'default') === pc.id ? 'scale(1.12)' : 'scale(1)',
              }}
              onClick={() => props.phoneActions.setPhoneCase(pc.id)}
              aria-label={pc.id}
            />
          )}
        </For>
      </div>

      {/* Accent Color */}
      <SectionHeader title={t('settings.accent_color', props.language()) || 'Color de acento'} />
      <div style={{ display: 'flex', gap: '10px', padding: '4px 0 8px', 'flex-wrap': 'wrap' }}>
        <For each={accentColors}>
          {(color) => (
            <button
              style={{
                width: '36px',
                height: '36px',
                'border-radius': '50%',
                border: props.phoneState.settings.accentColor === color.id ? '3px solid var(--text)' : '2px solid var(--border)',
                background: color.hex,
                cursor: 'pointer',
                transition: 'transform 120ms ease',
                transform: props.phoneState.settings.accentColor === color.id ? 'scale(1.15)' : 'scale(1)',
              }}
              onClick={() => props.phoneActions.setAccentColor(color.id)}
              aria-label={color.id}
            />
          )}
        </For>
      </div>

      {/* Font Size */}
      <SectionHeader title={t('settings.font_size', props.language()) || 'Tamano de texto'} />
      <div class="ios18-list">
        <For each={fontSizes}>
          {(size) => (
            <button
              class="ios18-cell"
              style={{ cursor: 'pointer' }}
              onClick={() => props.phoneActions.setFontSize(size.id)}
            >
              <span class="ios18-cell__title" style={{ 'font-size': size.preview }}>{size.label[props.language()] || size.label.en}</span>
              <Show when={(props.phoneState.settings.fontSize || 'default') === size.id}>
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
