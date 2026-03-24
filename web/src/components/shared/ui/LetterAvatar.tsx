import styles from './LetterAvatar.module.scss';

interface LetterAvatarProps {
  label: string;
  color: string;
  imageUrl?: string;
  alt?: string;
  class?: string;
  gradient?: boolean;
  size?: number;
}

function lightenHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function LetterAvatar(props: LetterAvatarProps) {
  const initial = () => (props.label || 'U').trim().charAt(0).toUpperCase() || 'U';

  const avatarBg = () => {
    if (props.gradient) {
      const lighter = lightenHex(props.color, 40);
      return `linear-gradient(135deg, ${props.color}, ${lighter})`;
    }
    return props.color;
  };

  const inlineStyle = () => {
    const s: Record<string, string> = { '--avatar-bg': avatarBg() };
    if (props.size != null) {
      s['width'] = `${props.size}px`;
      s['height'] = `${props.size}px`;
    }
    return s;
  };

  return (
    <div
      classList={{ [styles.avatar]: true, [props.class || '']: !!props.class }}
      style={inlineStyle()}
      aria-hidden="true"
    >
      {props.imageUrl ? <img src={props.imageUrl} alt={props.alt || ''} /> : <span>{initial()}</span>}
    </div>
  );
}
