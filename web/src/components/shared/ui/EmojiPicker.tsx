import { createSignal, Show, For, onCleanup, onMount } from 'solid-js';
import { sanitizeText } from '../../../utils/sanitize';
import styles from './EmojiPicker.module.scss';

// Smileys & Emotion emojis
const SMILEYS = [
  // Faces
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
  // Love
  '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲',
  // Tongue
  '😋', '😛', '😜', '🤪', '😝',
  // Hands
  '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
  // Sleepy
  '🤥', '😌', '😔', '😪', '🤤', '😴',
  // Sick
  '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯',
  // Costumes
  '🤠', '🥳', '🥸', '😎', '🤓', '🧐',
  // Concerned
  '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
  // Angry
  '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
  // Negative
  '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️',
  // Hearts
  '💋', '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍',
  // Animals
  '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤',
  // Hands
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪',
];

interface EmojiPickerProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export function EmojiPickerButton(props: EmojiPickerProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [recentEmojis, setRecentEmojis] = createSignal<string[]>([]);

  onMount(() => {
    // Load recent emojis from localStorage
    const saved = localStorage.getItem('gcphone:recentEmojis');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentEmojis(parsed.slice(0, 20));
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    // Close on click outside
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.emojiPicker}`) && !target.closest(`.${styles.emojiButton}`)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    onCleanup(() => document.removeEventListener('click', handleClickOutside));

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  const saveRecentEmoji = (emoji: string) => {
    setRecentEmojis((prev) => {
      const filtered = prev.filter((e) => e !== emoji);
      const updated = [emoji, ...filtered].slice(0, 20);
      localStorage.setItem('gcphone:recentEmojis', JSON.stringify(updated));
      return updated;
    });
  };

  const insertEmoji = (emoji: string) => {
    const currentValue = props.value;
    const newValue = currentValue + emoji;
    
    // Check max length
    if (props.maxLength && newValue.length > props.maxLength) {
      return;
    }

    // Sanitize before setting
    const sanitized = sanitizeText(newValue, props.maxLength || 500);
    props.onChange(sanitized);
    saveRecentEmoji(emoji);
  };

  return (
    <>
      <button
        class={styles.emojiButton}
        onClick={() => setIsOpen(!isOpen())}
        type="button"
        aria-label="Emojis"
      >
        😊
      </button>

      <Show when={isOpen()}>
        <div class={styles.emojiPicker}>
          <Show when={recentEmojis().length > 0}>
            <div class={styles.category}>
              <div class={styles.categoryTitle}>Recientes</div>
              <div class={styles.emojiGrid}>
                <For each={recentEmojis().slice(0, 20)}>
                  {(emoji) => (
                    <button
                      class={styles.emoji}
                      onClick={() => insertEmoji(emoji)}
                      type="button"
                    >
                      {emoji}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <div class={styles.category}>
            <div class={styles.categoryTitle}>Smileys</div>
            <div class={styles.emojiGrid}>
              <For each={SMILEYS}>
                {(emoji) => (
                  <button
                    class={styles.emoji}
                    onClick={() => insertEmoji(emoji)}
                    type="button"
                  >
                    {emoji}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
