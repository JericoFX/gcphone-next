import { isEnvBrowser } from './misc';

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

export function mockPhoneInit() {
  debugData([
    {
      action: 'initPhone',
      data: {
        phoneNumber: '555-1234',
        wallpaper: './img/background/back001.jpg',
        ringtone: 'ring.ogg',
        volume: 0.5,
        lockCode: '1234',
        theme: 'light'
      }
    }
  ], 100);
}

export function mockShowPhone() {
  debugData([
    {
      action: 'showPhone',
      data: {
        phoneNumber: '555-1234',
        wallpaper: './img/background/back001.jpg',
        ringtone: 'ring.ogg',
        volume: 0.5,
        lockCode: '1234',
        theme: 'light'
      }
    }
  ], 100);
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
