import { type JSX, type Accessor, Show, children as resolveChildren, createEffect, onCleanup } from 'solid-js';
import { SectionGroup } from '../../shared/ui/SectionBlock';
import styles from './SettingsApp.module.scss';

export const ICONS = {
  appearance: './img/icons_ios/ui-palette.svg',
  sound: './img/icons_ios/speaker.svg',
  security: './img/icons_ios/ui-lock.svg',
  notifications: './img/icons_ios/ui-bell.svg',
  location: './img/icons_ios/ui-location.svg',
  airplane: './img/icons_ios/ui-plane.svg',
  moon: './img/icons_ios/ui-moon.svg',
  mute: './img/icons_ios/speaker-off.svg',
  info: './img/icons_ios/ui-info.svg',
  brightness: './img/icons_ios/ui-sun.svg',
  gallery: './img/icons_ios/gallery.svg',
  shuffle: './img/icons_ios/ui-shuffle.svg',
  normal: './img/icons_ios/speaker.svg',
  street: './img/icons_ios/ui-city.svg',
  vehicle: './img/icons_ios/car.svg',
  silent: './img/icons_ios/speaker-off.svg',
  ringtone: './img/icons_ios/ui-bell.svg',
  message: './img/icons_ios/ui-chat.svg',
  trash: './img/icons_ios/ui-trash.svg',
  check: './img/icons_ios/ui-check.svg',
  play: './img/icons_ios/ui-play.svg',
  stop: './img/icons_ios/ui-stop.svg',
  backspace: './img/icons_ios/ui-backspace.svg',
  appIcon: './img/icons_ios/settings.svg',
  autoReply: './img/icons_ios/ui-reply.svg',
} as const;

export const wallpapers = [
  './img/background/back001.jpg',
  './img/background/back002.jpg',
  './img/background/back003.jpg',
  './img/background/color.jpg',
  './img/background/humo.jpg',
  './img/background/iluminacion.jpg',
  './img/background/neon.jpg',
  './img/background/oscuridad.jpg',
  './img/background/paisajes.jpg',
  './img/background/playa.jpg',
  './img/background/tokio.jpg',
];

export const languages = [
  { code: 'es', name: 'Español', label: 'ES' },
  { code: 'en', name: 'English', label: 'EN' },
  { code: 'pt', name: 'Português', label: 'PT' },
  { code: 'fr', name: 'Français', label: 'FR' },
  { code: 'de', name: 'Deutsch', label: 'DE' },
  { code: 'it', name: 'Italiano', label: 'IT' },
  { code: 'pl', name: 'Polski', label: 'PL' },
  { code: 'ru', name: 'Русский', label: 'RU' },
];

export const audioProfiles = [
  { id: 'normal', name: 'Normal', desc: 'Uso general', icon: ICONS.normal },
  { id: 'street', name: 'Calle', desc: 'Exterior ruidoso', icon: ICONS.street },
  { id: 'vehicle', name: 'Vehículo', desc: 'En movimiento', icon: ICONS.vehicle },
  { id: 'silent', name: 'Silencio', desc: 'Sin sonido', icon: ICONS.silent },
];

export const PIN_LENGTH = 4;

export function IconImage(props: { src: string; class?: string; alt?: string }) {
  return <img class={props.class} src={props.src} alt={props.alt || ''} draggable={false} />;
}

export function CheckIcon() {
  return (
    <span class={styles.checkmark} aria-hidden="true">
      <IconImage src={ICONS.check} class={styles.checkIcon} />
    </span>
  );
}

export function Group(props: { children: JSX.Element; class?: string }) {
  return <SectionGroup class={`${styles.group} ${props.class || ''}`}>{props.children}</SectionGroup>;
}

export function Cell(props: {
  icon?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  right?: 'chevron' | 'switch' | 'value' | 'slider' | 'value+chevron';
  switchValue?: boolean;
  onSwitch?: () => void;
  onClick?: () => void;
  value?: string;
  disabled?: boolean;
  sliderMin?: number;
  sliderMax?: number;
  sliderValue?: number;
  onSlider?: (v: number) => void;
}) {
  return (
    <button
      class={styles.cell}
      classList={{ [styles.pressable]: !!props.onClick }}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <div class={styles.cellLeft}>
        {props.icon && (
          <div class={`${styles.cellIcon} ${props.iconBg ? styles[props.iconBg] : ''}`}>
            <IconImage src={props.icon} class={styles.cellIconImage} />
          </div>
        )}
        <div class={styles.cellText}>
          <div class={styles.cellTitle}>{props.title}</div>
          {props.subtitle && <div class={styles.cellSubtitle}>{props.subtitle}</div>}
        </div>
      </div>
      <div class={styles.cellRight}>
        {props.right === 'value' && props.value && (
          <span class={styles.cellValue}>{props.value}</span>
        )}
        {props.right === 'value+chevron' && (
          <>
            <span class={styles.cellValue}>{props.value}</span>
            <div class={styles.chevron} />
          </>
        )}
        {props.right === 'slider' && (
          <input
            class={styles.cellSlider}
            type="range"
            min={props.sliderMin ?? 0}
            max={props.sliderMax ?? 100}
            value={props.sliderValue ?? 50}
            onInput={(e) => { e.stopPropagation(); props.onSlider?.(Number(e.currentTarget.value)); }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {props.right === 'switch' && (
          <div
            class={`${styles.switch} ${props.switchValue ? styles.switchActive : ''}`}
            onClick={(e) => { e.stopPropagation(); props.onSwitch?.(); }}
            role="switch"
            aria-checked={props.switchValue}
          >
            <div class={styles.switchThumb} />
          </div>
        )}
        {props.right === 'chevron' && <div class={styles.chevron} />}
      </div>
    </button>
  );
}

export function InlineExpander(props: { open: Accessor<boolean>; children: JSX.Element }) {
  let ref: HTMLDivElement | undefined;
  const resolved = resolveChildren(() => props.children);

  createEffect(() => {
    if (!ref) return;
    if (props.open()) {
      ref.style.maxHeight = `${ref.scrollHeight}px`;
    } else {
      ref.style.maxHeight = '0px';
    }
  });

  const onTransitionEnd = () => {
    if (ref && props.open()) {
      ref.style.maxHeight = 'none';
    }
  };

  onCleanup(() => {
    if (ref) ref.removeEventListener('transitionend', onTransitionEnd);
  });

  return (
    <div
      ref={(el) => { ref = el; el.addEventListener('transitionend', onTransitionEnd); }}
      class={styles.inlineExpander}
      classList={{ [styles.expanderOpen]: props.open() }}
    >
      {resolved()}
    </div>
  );
}
