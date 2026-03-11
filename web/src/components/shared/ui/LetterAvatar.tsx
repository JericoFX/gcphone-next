import styles from './LetterAvatar.module.scss';

interface LetterAvatarProps {
  label: string;
  color: string;
  imageUrl?: string;
  alt?: string;
  class?: string;
}

export function LetterAvatar(props: LetterAvatarProps) {
  const initial = () => (props.label || 'U').trim().charAt(0).toUpperCase() || 'U';

  return (
    <div
      classList={{ [styles.avatar]: true, [props.class || '']: !!props.class }}
      style={{ '--avatar-bg': props.color }}
      aria-hidden="true"
    >
      {props.imageUrl ? <img src={props.imageUrl} alt={props.alt || ''} /> : <span>{initial()}</span>}
    </div>
  );
}
