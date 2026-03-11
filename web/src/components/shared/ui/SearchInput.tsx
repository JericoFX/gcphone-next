import { mergeProps, splitProps } from 'solid-js';
import styles from './SearchInput.module.scss';

interface SearchInputProps {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'search' | 'tel';
  class?: string;
  inputClass?: string;
}

export function SearchInput(props: SearchInputProps) {
  const merged = mergeProps({
    placeholder: '',
    type: 'text' as const,
    class: undefined as string | undefined,
    inputClass: undefined as string | undefined,
  }, props);

  const [local] = splitProps(merged, ['value', 'onInput', 'placeholder', 'type', 'class', 'inputClass']);

  return (
    <div classList={{ [styles.root]: true, [local.class || '']: !!local.class }}>
      <input
        class="ios-input"
        classList={{ [styles.input]: true, [local.inputClass || '']: !!local.inputClass }}
        type={local.type}
        placeholder={local.placeholder}
        value={local.value}
        onInput={(e) => local.onInput(e.currentTarget.value)}
      />
    </div>
  );
}
