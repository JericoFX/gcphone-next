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

export function mockMiniApp() {
  if (!isEnvBrowser()) return;

  setTimeout(() => {
    emitInternalEvent('gcphone:openMiniApp', {
      title: 'Menu del Restaurante',
      url: 'https://picsum.photos/300/400',
      height: 300,
      resourceName: 'mock-restaurant',
      options: [
        { id: 'order_burger', label: 'Hamburguesa - $150', icon: '🍔', tone: 'default' },
        { id: 'order_pizza', label: 'Pizza - $200', icon: '🍕', tone: 'default' },
        { id: 'order_drink', label: 'Bebida - $50', icon: '🥤', tone: 'primary' },
        { id: 'cancel', label: 'Cancelar', icon: '❌', tone: 'danger' },
      ],
      callbackEvent: 'gcphone:miniAppCallback',
    });
  }, 100);
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
