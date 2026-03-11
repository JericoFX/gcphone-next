import type { JSX } from 'solid-js';
import styles from './SheetIntro.module.scss';

interface SheetIntroProps {
  title: string;
  description: string;
  tone?: 'neutral' | 'warm';
  class?: string;
}

export function SheetIntro(props: SheetIntroProps) {
  const tone = (): 'neutral' | 'warm' => props.tone || 'neutral';

  return (
    <div classList={{ [styles.root]: true, [styles.warm]: tone() === 'warm', [props.class || '']: !!props.class }}>
      <strong>{props.title}</strong>
      <span>{props.description}</span>
    </div>
  );
}
