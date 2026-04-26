import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import {
  mockAirDrop,
  mockContacts,
  mockHidePhone,
  mockMessages,
  mockNfcIncoming,
  mockNfcIncomingBurst,
  mockNfcIncomingFullTour,
  mockNfcIncomingSocialBurst,
  mockNotification,
  mockNotificationBurst,
  mockPhoneInit,
  mockPhoneSetup,
  mockSDKBar,
  mockSDKConfirm,
  mockSDKInput,
  mockSDKMechanic,
  mockSDKPermission,
  mockSDKSelect,
  mockShowPhone,
  mockTyping,
} from '../../utils/debugData';
import { isEnvBrowser } from '../../utils/misc';

type DevAction = {
  label: string;
  detail: string;
  run: () => void;
  tone?: 'primary' | 'danger';
};

type DevSection = {
  title: string;
  detail: string;
  actions: DevAction[];
};

const panelStyle = {
  position: 'fixed',
  top: '12px',
  left: '12px',
  width: '302px',
  padding: '12px',
  background: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  borderRadius: '14px',
  color: '#e2e8f0',
  zIndex: '999998',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  maxHeight: 'calc(100vh - 24px)',
  overflowY: 'auto',
  boxShadow: '0 18px 50px rgba(2, 6, 23, 0.42)',
} as const;

const headerStyle = {
  display: 'grid',
  gap: '3px',
  padding: '2px 2px 6px',
} as const;

const titleStyle = {
  fontSize: '13px',
  fontWeight: '800',
  letterSpacing: '0',
} as const;

const hintStyle = {
  color: '#94a3b8',
  fontSize: '11px',
  fontWeight: '650',
} as const;

const sectionStyle = {
  display: 'grid',
  gap: '7px',
  padding: '10px',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  borderRadius: '12px',
  background: 'rgba(30, 41, 59, 0.48)',
} as const;

const sectionHeaderStyle = {
  display: 'grid',
  gap: '2px',
} as const;

const sectionTitleStyle = {
  fontSize: '11px',
  fontWeight: '850',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#f8fafc',
} as const;

const sectionDetailStyle = {
  color: '#94a3b8',
  fontSize: '11px',
  lineHeight: '1.25',
} as const;

const buttonStyle = {
  width: '100%',
  border: '0',
  borderRadius: '10px',
  padding: '8px 10px',
  cursor: 'pointer',
  textAlign: 'left',
  background: '#1e293b',
  color: '#e2e8f0',
  display: 'grid',
  gap: '2px',
} as const;

const primaryButtonStyle = {
  ...buttonStyle,
  background: 'linear-gradient(180deg, #2563eb, #1d4ed8)',
  color: '#fff',
} as const;

const dangerButtonStyle = {
  ...buttonStyle,
  background: 'rgba(239, 68, 68, 0.22)',
  color: '#fecaca',
} as const;

const buttonTitleStyle = {
  fontSize: '12px',
  fontWeight: '800',
  lineHeight: '1.15',
} as const;

const buttonDetailStyle = {
  color: 'rgba(226, 232, 240, 0.72)',
  fontSize: '10px',
  lineHeight: '1.2',
} as const;

const runAndLog = (label: string, run: () => void) => {
  run();
  console.info(`[gcphone mock] ${label}`);
};

export function BrowserDevMenu() {
  const browserMode = isEnvBrowser();
  const [open, setOpen] = createSignal(false);

  const sections: DevSection[] = [
    {
      title: 'Telefono',
      detail: 'Estados base para reproducir bugs de entrada, lock y setup.',
      actions: [
        { label: 'Show Phone', detail: 'Abre el telefono en home.', run: mockPhoneInit, tone: 'primary' },
        { label: 'Setup Wizard', detail: 'Muestra configuracion inicial.', run: mockPhoneSetup },
        { label: 'Show again', detail: 'Emite show sin reiniciar datos.', run: mockShowPhone },
        { label: 'Hide Phone', detail: 'Cierra la UI.', run: mockHidePhone, tone: 'danger' },
      ],
    },
    {
      title: 'Datos vivos',
      detail: 'Semillas rapidas para conversaciones, contactos y typing.',
      actions: [
        { label: 'Mock contacts', detail: 'Actualiza agenda con contactos demo.', run: mockContacts },
        { label: 'Mock messages', detail: 'Carga una conversacion con entrantes.', run: mockMessages },
        { label: 'Typing', detail: 'Simula que otro usuario esta escribiendo.', run: mockTyping },
        { label: 'AirDrop', detail: 'Abre una solicitud de compartir foto.', run: mockAirDrop },
      ],
    },
    {
      title: 'Notificaciones',
      detail: 'Prueba banners, historial y centro de notificaciones.',
      actions: [
        { label: 'Hidden notification', detail: 'Banner simple cuando el telefono esta oculto.', run: mockNotification },
        { label: 'Notification burst', detail: 'Mensajes, banco, Chirp y Wallet en cascada.', run: mockNotificationBurst, tone: 'primary' },
      ],
    },
    {
      title: 'NFC entrante',
      detail: 'Todos los recibidos mock que deben navegar por notificacion.',
      actions: [
        { label: 'Core burst', detail: 'Foto, contacto, nota y mapa.', run: mockNfcIncomingBurst, tone: 'primary' },
        { label: 'Social burst', detail: 'Chirp, Snap, radio y servicios.', run: mockNfcIncomingSocialBurst },
        { label: 'Full NFC tour', detail: 'Recorre todos los tipos actuales.', run: mockNfcIncomingFullTour },
        { label: 'Factura NFC', detail: 'Abre Wallet con modal Banco/Cash.', run: () => mockNfcIncoming('invoice') },
        { label: 'Foto NFC', detail: 'Gallery muestra recibir/guardar/descartar.', run: () => mockNfcIncoming('photo') },
        { label: 'Documento NFC', detail: 'Muestra licencia recibida.', run: () => mockNfcIncoming('document') },
      ],
    },
    {
      title: 'SDK modal app',
      detail: 'Contratos de modales para recursos externos.',
      actions: [
        { label: 'Input Bank', detail: 'Formulario de transferencia.', run: mockSDKInput },
        { label: 'Confirm Sell', detail: 'Confirmacion peligrosa.', run: mockSDKConfirm },
        { label: 'Select Garage', detail: 'Lista buscable.', run: mockSDKSelect },
        { label: 'Bar multi-view', detail: 'Modal registrado con vistas.', run: mockSDKBar, tone: 'primary' },
        { label: 'Mechanic complex', detail: 'Panel complejo de recurso.', run: mockSDKMechanic },
        { label: 'Permission modal', detail: 'Permisos de app externa.', run: mockSDKPermission },
      ],
    },
  ];

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
        <div style={headerStyle}>
          <strong style={titleStyle}>gcphone Mock Console</strong>
          <span style={hintStyle}>Ctrl+Shift+D · browser only</span>
        </div>

        <For each={sections}>
          {(section) => (
            <section style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <strong style={sectionTitleStyle}>{section.title}</strong>
                <span style={sectionDetailStyle}>{section.detail}</span>
              </div>

              <For each={section.actions}>
                {(action) => (
                  <button
                    style={action.tone === 'primary' ? primaryButtonStyle : action.tone === 'danger' ? dangerButtonStyle : buttonStyle}
                    type="button"
                    onClick={() => runAndLog(action.label, action.run)}
                  >
                    <span style={buttonTitleStyle}>{action.label}</span>
                    <span style={buttonDetailStyle}>{action.detail}</span>
                  </button>
                )}
              </For>
            </section>
          )}
        </For>
      </div>
    </Show>
  );
}
