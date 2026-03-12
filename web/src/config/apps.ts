export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  route: string;
  defaultHome?: boolean;
  badge?: number;
}

export const APP_DEFINITIONS: AppDefinition[] = [
  { id: 'contacts', name: 'Contacts', icon: './img/icons_ios/contacts.svg', route: 'contacts', defaultHome: true },
  { id: 'messages', name: 'Messages', icon: './img/icons_ios/messages.svg', route: 'messages', defaultHome: true },
  { id: 'mail', name: 'Mail', icon: './img/icons_ios/mail.svg', route: 'mail', defaultHome: true },
  { id: 'notifications', name: 'Inbox', icon: './img/icons_ios/ui-list.svg', route: 'notifications', defaultHome: true },
  { id: 'calls', name: 'Calls', icon: './img/icons_ios/calls.svg', route: 'calls', defaultHome: true },
  { id: 'settings', name: 'Settings', icon: './img/icons_ios/settings.svg', route: 'settings', defaultHome: true },
  { id: 'gallery', name: 'Gallery', icon: './img/icons_ios/gallery.svg', route: 'gallery', defaultHome: true },
  { id: 'camera', name: 'Camera', icon: './img/icons_ios/camera.svg', route: 'camera', defaultHome: true },
  { id: 'bank', name: 'Bank', icon: './img/icons_ios/bank.svg', route: 'bank', defaultHome: true },
  { id: 'wallet', name: 'Wallet', icon: './img/icons_ios/wallet.svg', route: 'wallet', defaultHome: true },
  { id: 'documents', name: 'Docs', icon: './img/icons_ios/documents.svg', route: 'documents', defaultHome: true },
  { id: 'appstore', name: 'App Store', icon: './img/icons_ios/appstore.svg', route: 'appstore', defaultHome: false },
  { id: 'wavechat', name: 'WaveChat', icon: './img/icons_ios/wavechat.svg', route: 'wavechat', defaultHome: true },
  { id: 'music', name: 'Music', icon: './img/icons_ios/music.svg', route: 'music', defaultHome: true },
  { id: 'chirp', name: 'Chirp', icon: './img/icons_ios/chirp.svg', route: 'chirp', defaultHome: true },
  { id: 'snap', name: 'Snap', icon: './img/icons_ios/snap.svg', route: 'snap', defaultHome: true },
  { id: 'clips', name: 'Clips', icon: './img/icons_ios/clips.svg', route: 'clips', defaultHome: true },
  { id: 'darkrooms', name: 'DarkRooms', icon: './img/icons_ios/darkrooms.svg', route: 'darkrooms', defaultHome: true },
  { id: 'yellowpages', name: 'Yellow Pages', icon: './img/icons_ios/yellowpages.svg', route: 'yellowpages', defaultHome: true },
  // Market app disabled - using YellowPages instead
  // { id: 'market', name: 'Market', icon: './img/icons_ios/market.svg', route: 'market', defaultHome: true },
  { id: 'news', name: 'News', icon: './img/icons_ios/news.svg', route: 'news', defaultHome: true },
  { id: 'garage', name: 'Garage', icon: './img/icons_ios/garage.svg', route: 'garage', defaultHome: true },
  { id: 'clock', name: 'Clock', icon: './img/icons_ios/clock.svg', route: 'clock', defaultHome: true },
  { id: 'notes', name: 'Notes', icon: './img/icons_ios/notes.svg', route: 'notes', defaultHome: true },
  { id: 'maps', name: 'Maps', icon: './img/icons_ios/map.svg', route: 'maps', defaultHome: true },
  { id: 'weather', name: 'Weather', icon: './img/icons_ios/weather.svg', route: 'weather', defaultHome: true },
];

export const APP_IDS = APP_DEFINITIONS.map((app) => app.id);

export const DEFAULT_HOME_APPS = APP_DEFINITIONS.filter((app) => app.defaultHome).map((app) => app.id);
export const DEFAULT_MENU_APPS = APP_DEFINITIONS.filter((app) => !app.defaultHome).map((app) => app.id);

export const APP_BY_ID = APP_DEFINITIONS.reduce<Record<string, AppDefinition>>((acc, app) => {
  acc[app.id] = app;
  return acc;
}, {});
