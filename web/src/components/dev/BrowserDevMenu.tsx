import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { mockContacts, mockMessages, mockPhoneInit, mockPhoneSetup, mockShowPhone, mockHidePhone, mockNotification, mockAirDrop, mockTyping, mockSDKInput, mockSDKConfirm, mockSDKSelect, mockSDKBar, mockSDKMechanic, mockSDKPermission } from '../../utils/debugData';
import { isEnvBrowser } from '../../utils/misc';

const panelStyle = {
  position: 'fixed',
  top: '12px',
  left: '12px',
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
  const browserMode = isEnvBrowser();
  const [open, setOpen] = createSignal(false);

  onMount(() => {
    if (!browserMode) return;
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
    <Show when={browserMode && open()}>
      <div style={panelStyle}>
        <strong>gcphone Browser Dev</strong>
        <span>Ctrl+Shift+D</span>
        <button style={buttonStyle} onClick={() => mockPhoneInit()}>Show Phone</button>
        <button style={buttonStyle} onClick={() => mockPhoneSetup()}>Setup Wizard</button>
        <button style={buttonStyle} onClick={() => mockHidePhone()}>Hide Phone</button>
        <button style={buttonStyle} onClick={() => mockNotification()}>Notification (hidden)</button>
        <button style={buttonStyle} onClick={() => mockContacts()}>Mock contacts</button>
        <button style={buttonStyle} onClick={() => mockMessages()}>Mock messages</button>
        <button style={buttonStyle} onClick={() => mockAirDrop()}>Mock AirDrop</button>
        <button style={buttonStyle} onClick={() => mockTyping()}>Mock Typing</button>
        <strong style={{ 'margin-top': '8px' }}>SDK Modals</strong>
        <button style={buttonStyle} onClick={() => mockSDKInput()}>SDK: Input (Bank)</button>
        <button style={buttonStyle} onClick={() => mockSDKConfirm()}>SDK: Confirm (Sell)</button>
        <button style={buttonStyle} onClick={() => mockSDKSelect()}>SDK: Select (Garage)</button>
        <button style={buttonStyle} onClick={() => mockSDKBar()}>SDK: Bar (Multi-view)</button>
        <button style={buttonStyle} onClick={() => mockSDKMechanic()}>SDK: Mechanic (Complex)</button>
        <button style={buttonStyle} onClick={() => mockSDKPermission()}>SDK: Permission Modal</button>
      </div>
    </Show>
  );
}
