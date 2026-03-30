import { For, Show, children as resolveChildren, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
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
  children: JSX.Element;
  max?: number;
  class?: string;
}

export function AvatarGroup(props: AvatarGroupProps) {
  const resolved = resolveChildren(() => props.children);

  const visibleItems = createMemo(() => {
    const arr = resolved.toArray();
    if (props.max && arr.length > props.max) {
      return { items: arr.slice(0, props.max), overflow: arr.length - props.max };
    }
    return { items: arr, overflow: 0 };
  });

  return (
    <div classList={{ [styles.group]: true, [props.class || '']: !!props.class }}>
      <For each={visibleItems().items}>
        {(child) => child}
      </For>
      <Show when={visibleItems().overflow > 0}>
        <div classList={{ [styles.avatar]: true, [styles.overflow]: true }}>
          +{visibleItems().overflow}
        </div>
      </Show>
    </div>
  );
}
