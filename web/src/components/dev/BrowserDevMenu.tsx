import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { mockContacts, mockMessages, mockPhoneInit, mockShowPhone } from '../../utils/debugData';
import { isEnvBrowser } from '../../utils/misc';

const panelStyle = {
  position: 'fixed',
  top: '12px',
  right: '12px',
  width: '220px',
  padding: '12px',
  background: 'rgba(15, 23, 42, 0.92)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  borderRadius: '12px',
  color: '#e2e8f0',
  zIndex: '999998',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
} as const;

const buttonStyle = {
  border: '0',
  borderRadius: '8px',
  padding: '8px 10px',
  cursor: 'pointer',
  textAlign: 'left',
  background: '#1e293b',
  color: '#e2e8f0',
} as const;

export function BrowserDevMenu() {
  if (!isEnvBrowser()) return null;

  const [open, setOpen] = createSignal(false);

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  return (
    <Show when={open()}>
      <div style={panelStyle}>
        <strong>gcphone Browser Dev</strong>
        <span>Ctrl+Shift+D</span>
        <button style={buttonStyle} onClick={() => mockPhoneInit()}>Mock initPhone</button>
        <button style={buttonStyle} onClick={() => mockShowPhone()}>Mock showPhone</button>
        <button style={buttonStyle} onClick={() => mockContacts()}>Mock contacts</button>
        <button style={buttonStyle} onClick={() => mockMessages()}>Mock messages</button>
      </div>
    </Show>
  );
}
