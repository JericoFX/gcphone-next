import { Show, type Accessor } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { formatDate as formatDateI18n, t } from '../../../i18n';
import type { WidgetInstance } from '../../../types/home';
import { WIDGET_DEFINITIONS } from '../../../types/home';
import styles from './WidgetCard.module.scss';

interface WidgetCardProps {
  widget: WidgetInstance;
  editing: boolean;
  language: () => string;
  onRemove: () => void;
  currentTime: Accessor<Date>;
  musicNowPlaying: Accessor<string>;
  radioStation: Accessor<string>;
  bankBalance: Accessor<string>;
}

export function WidgetCard(props: WidgetCardProps) {
  const router = useRouter();
  const currentTime = () => props.currentTime();
  const musicNowPlaying = () => props.musicNowPlaying();
  const radioStation = () => props.radioStation();
  const bankBalance = () => props.bankBalance();
  const def = () => WIDGET_DEFINITIONS[props.widget.type];
  const handleClick = () => {
    if (props.editing) return;
    const routeMap: Record<string, string> = {
      maps: 'maps', nowPlaying: 'music', contacts: 'contacts',
      notes: 'notes', chirp: 'chirp', clock: 'clock',
      weather: 'weather', bank: 'bank', gallery: 'gallery', radio: 'radio',
    };
    const route = routeMap[props.widget.type];
    if (route) router.navigate(route);
  };

  return (
    <button
      class={styles.widgetCard}
      classList={{
        [styles.sm]: props.widget.size === 'sm',
        [styles.md]: props.widget.size === 'md',
        [styles.lg]: props.widget.size === 'lg',
        [styles.jiggle]: props.editing,
      }}
      onClick={handleClick}
    >
      <span class={styles.label}>{def()?.name || props.widget.type}</span>
      <Show when={props.widget.type === 'maps'}>
        <strong>{formatDateI18n(currentTime(), props.language(), { day: '2-digit', month: 'short' })}</strong>
        <small>{t('home.widget_maps_hint', props.language())}</small>
      </Show>
      <Show when={props.widget.type === 'nowPlaying'}>
        <strong>{musicNowPlaying()}</strong>
        <small>{t('home.widget_music_hint', props.language())}</small>
      </Show>
      <Show when={props.widget.type === 'contacts'}>
        <strong>{t('home.widget_contacts', props.language()) || 'Favorites'}</strong>
      </Show>
      <Show when={props.widget.type === 'notes'}>
        <strong>{t('home.widget_notes', props.language()) || 'Recent Note'}</strong>
      </Show>
      <Show when={props.widget.type === 'chirp'}>
        <strong>{t('home.widget_chirp', props.language()) || 'Latest'}</strong>
      </Show>
      <Show when={props.widget.type === 'clock'}>
        <strong>{formatDateI18n(currentTime(), props.language(), { hour: '2-digit', minute: '2-digit' })}</strong>
      </Show>
      <Show when={props.widget.type === 'weather'}>
        <strong>{t('home.widget_weather', props.language()) || 'Weather'}</strong>
        <small>{t('home.widget_weather_hint', props.language()) || 'Current conditions'}</small>
      </Show>
      <Show when={props.widget.type === 'bank'}>
        <strong>{bankBalance() || t('home.widget_bank', props.language()) || 'Balance'}</strong>
        <small>{t('home.widget_bank_hint', props.language()) || 'Available balance'}</small>
      </Show>
      <Show when={props.widget.type === 'gallery'}>
        <strong>{t('home.widget_gallery', props.language()) || 'Photos'}</strong>
        <small>{t('home.widget_gallery_hint', props.language()) || 'Recent photos'}</small>
      </Show>
      <Show when={props.widget.type === 'radio'}>
        <strong>{radioStation() || t('home.widget_radio', props.language()) || 'Radio'}</strong>
        <small>{t('home.widget_radio_hint', props.language()) || 'Now playing'}</small>
      </Show>
      <Show when={props.editing}>
        <span class={styles.removeBadge} onClick={(e) => { e.stopPropagation(); props.onRemove(); }}>&#x2212;</span>
      </Show>
    </button>
  );
}
