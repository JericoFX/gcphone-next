import type { ParentProps } from 'solid-js';
import styles from './SectionBlock.module.scss';

interface SectionHeaderProps {
  title: string;
}

interface SectionGroupProps extends ParentProps {
  class?: string;
}

export function SectionHeader(props: SectionHeaderProps) {
  return <div class={styles.header}>{props.title}</div>;
}

export function SectionGroup(props: SectionGroupProps) {
  return <div classList={{ [styles.group]: true, [props.class || '']: !!props.class }}>{props.children}</div>;
}
