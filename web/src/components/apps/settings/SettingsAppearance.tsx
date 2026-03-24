import { For, Show, createSignal } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { t, type AppLanguage } from '../../../i18n';
import { CheckIcon, Group, IconImage, ICONS, InlineExpander, languages, wallpapers } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsAppearanceProps {
  language: () => string;
  phoneState: any;
  phoneActions: any;
  urlInput: () => string;
  setUrlInput: (v: string) => void;
  onStatus?: (msg: string) => void;
}

const themeNames: Record<string, Record<string, string>> = {
  light: { es_ES: 'Claro', en_US: 'Light', fr_FR: 'Clair', de_DE: 'Hell', pt_BR: 'Claro', ru_RU: 'Светлая', pl_PL: 'Jasny', it_IT: 'Chiaro' },
  dark:  { es_ES: 'Oscuro', en_US: 'Dark', fr_FR: 'Sombre', de_DE: 'Dunkel', pt_BR: 'Escuro', ru_RU: 'Тёмная', pl_PL: 'Ciemny', it_IT: 'Scuro' },
  auto:  { es_ES: 'Automático', en_US: 'Automatic', fr_FR: 'Automatique', de_DE: 'Automatisch', pt_BR: 'Automático', ru_RU: 'Авто', pl_PL: 'Automatyczny', it_IT: 'Automatico' },
};

export function SettingsAppearance(props: SettingsAppearanceProps) {
  const [showTheme, setShowTheme] = createSignal(false);
  const [showLang, setShowLang] = createSignal(false);
  const [showUrl, setShowUrl] = createSignal(false);

  const currentThemeName = () => {
    const theme = props.phoneState.settings.theme || 'light';
    return themeNames[theme]?.[props.language()] || themeNames[theme]?.en_US || theme;
  };

  const currentLangName = () => {
    const lang = languages.find((l) => l.code === props.language());
    return lang?.label || props.language().toUpperCase();
  };

  const setWallpaper = (url: string) => {
    props.phoneActions.setWallpaper(url);
  };

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
      {/* Wallpaper preview (large) */}
      <Show when={props.phoneState.settings.wallpaper}>
        <div class={styles.wallpaperPreview}>
          <img src={props.phoneState.settings.wallpaper} alt="" />
          <span class={styles.wallpaperBadge}>{t('settings.wallpaper_current', props.language()) || 'Actual'}</span>
        </div>
      </Show>

      {/* Thumbnails horizontal scroll */}
      <div class={styles.wallpaperScroll}>
        <For each={wallpapers}>
          {(wp) => (
            <button
              class={styles.wallpaperThumb}
              classList={{ [styles.selected]: props.phoneState.settings.wallpaper === wp }}
              onClick={() => setWallpaper(wp)}
            >
              <img src={wp} alt="" />
              <Show when={props.phoneState.settings.wallpaper === wp}>
                <span class={styles.thumbCheck}><img src={ICONS.check} alt="" /></span>
              </Show>
            </button>
          )}
        </For>
        {/* Random wallpaper */}
        <button class={styles.wallpaperAction} onClick={randomWallpaper} title={t('settings.random_api', props.language())}>
          <img src={ICONS.shuffle} alt="" />
        </button>
        {/* Gallery */}
        <button class={styles.wallpaperAction} onClick={() => fetchNui('openGallery', { selectWallpaper: true })} title={t('camera.gallery', props.language())}>
          <img src={ICONS.gallery} alt="" />
        </button>
        {/* Custom URL */}
        <button class={styles.wallpaperAction} onClick={() => setShowUrl(!showUrl())} title={t('settings.custom_url', props.language()) || 'URL'}>
          <span style={{ "font-size": "16px", opacity: "0.5" }}>+</span>
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

      {/* Theme & Language */}
      <SectionHeader title="" />
      <Group>
        <button class={styles.cell} classList={{ [styles.pressable]: true }} onClick={() => { setShowTheme(!showTheme()); setShowLang(false); }}>
          <div class={styles.cellLeft}>
            <div class={`${styles.cellIcon} ${styles.iconBlue}`}><IconImage src={ICONS.brightness} class={styles.cellIconImage} /></div>
            <div class={styles.cellText}><div class={styles.cellTitle}>{t('settings.theme', props.language())}</div></div>
          </div>
          <div class={styles.cellRight}>
            <span class={styles.cellValue}>{currentThemeName()}</span>
            <div class={styles.chevron} />
          </div>
        </button>
        <InlineExpander open={showTheme}>
          <div class={styles.inlineOptionList}>
            <For each={['light', 'dark', 'auto'] as const}>
              {(themeId) => (
                <button
                  class={styles.inlineOption}
                  classList={{ [styles.selected]: props.phoneState.settings.theme === themeId }}
                  onClick={() => { props.phoneActions.setTheme(themeId); setShowTheme(false); }}
                >
                  <span class={styles.inlineOptionName}>{themeNames[themeId][props.language()] || themeNames[themeId].en_US}</span>
                  <Show when={props.phoneState.settings.theme === themeId}><CheckIcon /></Show>
                </button>
              )}
            </For>
          </div>
        </InlineExpander>

        <button class={styles.cell} classList={{ [styles.pressable]: true }} onClick={() => { setShowLang(!showLang()); setShowTheme(false); }}>
          <div class={styles.cellLeft}>
            <div class={`${styles.cellIcon} ${styles.iconGreen}`}><IconImage src={ICONS.info} class={styles.cellIconImage} /></div>
            <div class={styles.cellText}><div class={styles.cellTitle}>{t('settings.language', props.language())}</div></div>
          </div>
          <div class={styles.cellRight}>
            <span class={styles.cellValue}>{currentLangName()}</span>
            <div class={styles.chevron} />
          </div>
        </button>
        <InlineExpander open={showLang}>
          <div class={styles.inlineOptionList}>
            <For each={languages}>
              {(lang) => (
                <button
                  class={styles.inlineOption}
                  classList={{ [styles.selected]: props.language() === lang.code }}
                  onClick={() => { props.phoneActions.setLanguage(lang.code as AppLanguage); setShowLang(false); }}
                >
                  <span class={styles.inlineOptionIcon}>{lang.label}</span>
                  <span class={styles.inlineOptionName}>{lang.name}</span>
                  <Show when={props.language() === lang.code}><CheckIcon /></Show>
                </button>
              )}
            </For>
          </div>
        </InlineExpander>
      </Group>
    </div>
  );
}
