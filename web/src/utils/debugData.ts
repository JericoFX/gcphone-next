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
        coque: 'sin_funda.png',
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
        coque: 'sin_funda.png',
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
