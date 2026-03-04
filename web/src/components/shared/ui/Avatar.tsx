import { Show } from 'solid-js';
import { generateColorForString, getBestFontColor } from '@/utils/misc';
import styles from './Avatar.module.scss';

export interface AvatarProps {
  identifier: string;
  display?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  class?: string;
  onClick?: () => void;
}

export function Avatar(props: AvatarProps) {
  const initial = () => {
    const display = props.display || props.identifier;
    return display.charAt(0).toUpperCase();
  };

  const color = () => generateColorForString(props.identifier);
  const textColor = () => getBestFontColor(color());

  return (
    <div
      classList={{
        [styles.avatar]: true,
        [styles.xs]: props.size === 'xs',
        [styles.sm]: props.size === 'sm',
        [styles.lg]: props.size === 'lg',
        [styles.xl]: props.size === 'xl',
        [styles.clickable]: !!props.onClick,
        [props.class || '']: !!props.class,
      }}
      style={{ 'background-color': props.src ? undefined : color(), color: textColor() }}
      onClick={props.onClick}
    >
      <Show when={props.src} fallback={<span class={styles.initial}>{initial()}</span>}>
        <img src={props.src} alt={props.display || props.identifier} class={styles.image} />
      </Show>
    </div>
  );
}

export interface AvatarGroupProps {
  children: unknown;
  max?: number;
  class?: string;
}

export function AvatarGroup(props: AvatarGroupProps) {
  const children = () => {
    const arr = Array.isArray(props.children) ? props.children : [props.children];
    if (props.max && arr.length > props.max) {
      return [...arr.slice(0, props.max), arr.length - props.max];
    }
    return arr;
  };

  return (
    <div classList={{ [styles.group]: true, [props.class || '']: !!props.class }}>
      {children().map((child, index) => {
        if (typeof child === 'number') {
          return (
            <div classList={{ [styles.avatar]: true, [styles.overflow]: true }}>
              +{child}
            </div>
          );
        }
        return child;
      })}
    </div>
  );
}
