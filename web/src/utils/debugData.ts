import { isEnvBrowser } from './misc';
import { emitInternalEvent } from './internalEvents';

interface DebugEvent<T = unknown> {
  action: string;
  data: T;
}

export function debugData<P>(events: DebugEvent<P>[], timer = 1000): void {
  if (isEnvBrowser()) {
    for (const event of events) {
      setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              action: event.action,
              data: event.data,
            },
          })
        );
      }, timer);
    }
  }
}

const MOCK_PHONE_DATA = {
  phoneNumber: '555-1234',
  wallpaper: './img/background/back001.jpg',
  ringtone: 'call_1',
  callRingtone: 'call_1',
  notificationTone: 'notif_1',
  messageTone: 'msg_1',
  volume: 0.5,
  lockCode: '',
  theme: 'light',
  language: 'es',
  audioProfile: 'normal',
  framework: 'qbcore',
  imei: 'MOCK-1234-5678',
  deviceOwnerName: 'Demo Player',
  useLockScreen: false,
};

export function mockPhoneInit() {
  if (!isEnvBrowser()) return;
  setTimeout(() => {
    emitInternalEvent('phone:init', MOCK_PHONE_DATA);
    setTimeout(() => emitInternalEvent('phone:show', MOCK_PHONE_DATA), 50);
  }, 100);
}

export function mockPhoneSetup() {
  if (!isEnvBrowser()) return;
  const setupData = {
    ...MOCK_PHONE_DATA,
    requiresSetup: true,
    useLockScreen: false,
  };
  setTimeout(() => {
    emitInternalEvent('phone:init', setupData);
    setTimeout(() => emitInternalEvent('phone:show', setupData), 50);
  }, 100);
}

export function mockShowPhone() {
  if (!isEnvBrowser()) return;
  setTimeout(() => emitInternalEvent('phone:show', MOCK_PHONE_DATA), 100);
}

export function mockHidePhone() {
  if (!isEnvBrowser()) return;
  setTimeout(() => emitInternalEvent('phone:hide', {}), 100);
}

export function mockNotification() {
  if (!isEnvBrowser()) return;
  setTimeout(() => {
    emitInternalEvent('phone:notification', {
      id: `notif_${Date.now()}`,
      appId: 'messages',
      title: 'Maria Garcia',
      message: 'Hey! Donde estas? Te estoy esperando en el parque.',
      icon: '💬',
      durationMs: 5000,
      priority: 'normal',
      route: 'messages',
    });
  }, 100);
}

export function mockContacts() {
  debugData([
    {
      action: 'updateContacts',
      data: {
        contacts: [
          { id: 1, display: 'María García', number: '555-1111' },
          { id: 2, display: 'Juan Pérez', number: '555-2222' },
          { id: 3, display: 'Ana López', number: '555-3333' },
        ]
      }
    }
  ], 500);
}

export function mockMessages() {
  const now = Date.now();

  debugData([
    {
      action: 'messagesUpdated',
      data: [
        {
          id: 1001,
          transmitter: '555-1111',
          receiver: '555-1234',
          message: 'Te veo en Legion en 10 minutos.',
          owner: 0,
          isRead: false,
          time: new Date(now - 120000).toISOString(),
        },
        {
          id: 1002,
          transmitter: '555-1234',
          receiver: '555-1111',
          message: 'Dale, llevo el Sultan.',
          owner: 1,
          isRead: true,
          time: new Date(now - 60000).toISOString(),
        },
        {
          id: 1003,
          transmitter: '555-3333',
          receiver: '555-1234',
          message: 'Te deje las llaves en el departamento.',
          owner: 0,
          isRead: false,
          time: new Date(now - 25000).toISOString(),
        },
      ]
    }
  ], 350);
}

export function mockAirDrop() {
  if (!isEnvBrowser()) return;

  setTimeout(() => {
    emitInternalEvent('gcphone:incomingShare', {
      fromServerId: 2,
      fromName: 'Carlos Mendoza',
      type: 'photo',
      label: 'Foto de la escena',
      requestId: `req_${Date.now()}`,
    });
  }, 100);
}

export function mockTyping() {
  if (!isEnvBrowser()) return;

  setTimeout(() => {
    emitInternalEvent('messages:remoteTyping', { from: '555-5678' });
  }, 100);
}

export function mockSDKInput() {
  if (!isEnvBrowser()) return;
  setTimeout(() => {
    emitInternalEvent('gcphone:sdk:open', {
      requestId: 'mock_input_' + Date.now(),
      mode: 'input',
      title: 'Transferir dinero',
      resourceName: 'mock-bank',
      elements: [
        { type: 'input', id: 'target', label: 'Numero destino', required: true, placeholder: '555-XXXX', maxLength: 20 },
        { type: 'number', id: 'amount', label: 'Monto ($)', required: true, min: 1, max: 100000 },
        { type: 'select', id: 'account', label: 'Desde cuenta', required: true, options: [
          { value: 'cash', label: 'Efectivo — $24,500' },
          { value: 'bank', label: 'Banco — $150,000' },
        ]},
        { type: 'textarea', id: 'note', label: 'Nota', placeholder: 'Opcional...', maxLength: 140 },
      ],
      submitLabel: 'Transferir',
      submitTone: 'primary',
    });
  }, 100);
}

export function mockSDKConfirm() {
  if (!isEnvBrowser()) return;
  setTimeout(() => {
    emitInternalEvent('gcphone:sdk:open', {
      requestId: 'mock_confirm_' + Date.now(),
      mode: 'confirm',
      title: 'Vender vehiculo?',
      icon: '🚗',
      resourceName: 'mock-garage',
      description: 'Vas a vender tu Elegy Retro Custom por $45,000. Esta accion no se puede deshacer.',
      confirmLabel: 'Vender',
      confirmTone: 'danger',
    });
  }, 100);
}

export function mockSDKSelect() {
  if (!isEnvBrowser()) return;
  setTimeout(() => {
    emitInternalEvent('gcphone:sdk:open', {
      requestId: 'mock_select_' + Date.now(),
      mode: 'select',
      title: 'Mis vehiculos',
      resourceName: 'mock-garage',
      searchable: true,
      items: [
        { id: 'elegy', label: 'Elegy Retro Custom', description: 'Garage Norte — Motor Nv.3', icon: '🚗' },
        { id: 'sultan', label: 'Sultan RS', description: 'Garage Sur — Stock', icon: '🏎️' },
        { id: 'kuruma', label: 'Kuruma Blindado', description: 'Garage Norte — Turbo', icon: '🛡️' },
        { id: 'zentorno', label: 'Zentorno', description: 'Garage VIP — Full', icon: '🏁' },
        { id: 'insurgent', label: 'Insurgent', description: 'Garage Militar', icon: '🪖', disabled: true },
      ],
    });
  }, 100);
}

export function mockSDKBar() {
  if (!isEnvBrowser()) return;
  setTimeout(() => {
    emitInternalEvent('gcphone:sdk:open', {
      requestId: 'mock_bar_' + Date.now(),
      mode: 'registered',
      title: 'El Gordo Bar',
      icon: '🍺',
      resourceName: 'mock-bar',
      startView: 'main',
      views: {
        main: {
          elements: [
            { type: 'header', text: 'Menu' },
            { type: 'list', id: 'category', items: [
              { id: 'drinks', label: 'Tragos', description: '8 opciones', icon: '🍹', navigateTo: 'drinks' },
              { id: 'food', label: 'Comida', description: '5 platos', icon: '🍔', navigateTo: 'food' },
              { id: 'promos', label: 'Promos del dia', description: '2x1 en cervezas', icon: '🔥', navigateTo: 'promos' },
            ]},
          ],
        },
        drinks: {
          title: 'Tragos',
          elements: [
            { type: 'select', id: 'drink', label: 'Elige trago', required: true, options: [
              { value: 'beer', label: 'Cerveza — $30' },
              { value: 'whisky', label: 'Whisky — $80' },
              { value: 'cocktail', label: 'Cocktail de la casa — $60' },
              { value: 'wine', label: 'Vino tinto — $50' },
            ]},
            { type: 'number', id: 'qty', label: 'Cantidad', min: 1, max: 5, default: 1, required: true },
            { type: 'checkbox', id: 'double', label: 'Doble (trago largo)' },
          ],
          options: [
            { id: 'order_drink', label: 'Pedir', tone: 'primary' },
          ],
        },
        food: {
          title: 'Comida',
          elements: [
            { type: 'select', id: 'plate', label: 'Plato', required: true, options: [
              { value: 'burger', label: 'Hamburguesa completa — $120' },
              { value: 'nachos', label: 'Nachos con queso — $80' },
              { value: 'wings', label: 'Alitas BBQ x6 — $100' },
            ]},
            { type: 'textarea', id: 'notes', label: 'Notas', placeholder: 'Sin cebolla, extra salsa...', maxLength: 140 },
          ],
          options: [
            { id: 'order_food', label: 'Pedir', tone: 'primary' },
          ],
        },
        promos: {
          title: 'Promos',
          elements: [
            { type: 'label', text: 'Happy Hour: 18:00 - 21:00', tone: 'muted' },
            { type: 'label', text: 'Todas las cervezas 2x1' },
            { type: 'divider' },
            { type: 'label', text: 'Combo amigos: 4 cervezas + nachos por $150', tone: 'primary' },
          ],
          options: [
            { id: 'order_combo', label: 'Pedir combo — $150', tone: 'primary' },
          ],
        },
      },
    });
  }, 100);
}

export function mockSDKMechanic() {
  if (!isEnvBrowser()) return;
  setTimeout(() => {
    emitInternalEvent('gcphone:sdk:open', {
      requestId: 'mock_mech_' + Date.now(),
      mode: 'registered',
      title: 'MechWork',
      icon: '🔧',
      resourceName: 'mock-mechanic',
      startView: 'main',
      views: {
        main: {
          elements: [
            { type: 'header', text: 'Panel de mecanico' },
            { type: 'label', text: 'Turno: En servicio', tone: 'muted' },
            { type: 'label', text: 'Trabajos hoy: 3' },
            { type: 'divider' },
            { type: 'list', id: 'action', items: [
              { id: 'pending', label: 'Trabajos pendientes', description: '2 en cola', icon: '📋', navigateTo: 'pending' },
              { id: 'services', label: 'Ofrecer servicio', icon: '🔧', navigateTo: 'offer' },
              { id: 'parts', label: 'Inventario de repuestos', icon: '📦', navigateTo: 'inventory' },
              { id: 'stats', label: 'Mis estadisticas', icon: '📊', navigateTo: 'stats' },
            ]},
          ],
        },
        pending: {
          title: 'Trabajos pendientes',
          elements: [
            { type: 'list', id: 'job', items: [
              { id: 'job_1', label: 'Sultan RS — Reparacion motor', description: '$1,500 — Juan Perez', icon: '🔧' },
              { id: 'job_2', label: 'Elegy — Pintura completa', description: '$2,000 — Maria Garcia', icon: '🎨' },
            ]},
          ],
        },
        offer: {
          title: 'Ofrecer servicio',
          elements: [
            { type: 'select', id: 'service_type', label: 'Tipo de servicio', required: true, options: [
              { value: 'repair', label: 'Reparacion general — $500' },
              { value: 'engine', label: 'Reparacion de motor — $1,500' },
              { value: 'body', label: 'Reparacion carroceria — $800' },
              { value: 'paint', label: 'Pintura completa — $2,000' },
              { value: 'tow', label: 'Servicio de grua — $300' },
            ]},
            { type: 'input', id: 'plate', label: 'Patente del vehiculo', placeholder: 'ABC123', maxLength: 8 },
            { type: 'number', id: 'price', label: 'Precio personalizado ($)', min: 0, max: 50000 },
            { type: 'textarea', id: 'diagnosis', label: 'Diagnostico', placeholder: 'Describe el problema...', maxLength: 300 },
          ],
          options: [
            { id: 'create_job', label: 'Crear orden de trabajo', tone: 'primary' },
          ],
        },
        inventory: {
          title: 'Repuestos',
          elements: [
            { type: 'header', text: 'Tus repuestos' },
            { type: 'list', id: 'part', items: [
              { id: 'engine_part', label: 'Pieza de motor', description: 'x5', icon: '⚙️' },
              { id: 'brake_pad', label: 'Pastilla de freno', description: 'x12', icon: '🔴' },
              { id: 'turbo_kit', label: 'Kit de turbo', description: 'x2', icon: '💨' },
              { id: 'paint_can', label: 'Pintura', description: 'x8', icon: '🎨' },
            ]},
          ],
        },
        stats: {
          title: 'Estadisticas',
          elements: [
            { type: 'label', text: 'Trabajos completados: 47' },
            { type: 'label', text: 'Ganancia total: $68,500' },
            { type: 'label', text: 'Rating: 4.8 / 5.0' },
            { type: 'divider' },
            { type: 'label', text: 'Mejor mes: Febrero 2026', tone: 'muted' },
          ],
        },
      },
    });
  }, 100);
}

export function mockSDKPermission() {
  if (!isEnvBrowser()) return;
  const perms = (window as any).__gcphonePermissions;
  if (!perms) {
    console.warn('[SDK Mock] Permissions store not ready');
    return;
  }
  perms.requestPermissions('mock_taxi', 'CityTaxi', '🚕', ['location', 'notifications', 'maps', 'contacts']);
}
