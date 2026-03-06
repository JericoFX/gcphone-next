export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  route: string;
  defaultHome?: boolean;
  badge?: number;
}

export const APP_DEFINITIONS: AppDefinition[] = [
  { id: 'contacts', name: 'Contactos', icon: './img/icons_ios/contacts.svg', route: 'contacts', defaultHome: true },
  { id: 'messages', name: 'Mensajes', icon: './img/icons_ios/messages.svg', route: 'messages', defaultHome: true },
  { id: 'mail', name: 'Mail', icon: './img/icons_ios/mail.svg', route: 'mail', defaultHome: true },
  { id: 'notifications', name: 'Inbox', icon: './img/icons_ios/ui-list.svg', route: 'notifications', defaultHome: true },
  { id: 'calls', name: 'Llamadas', icon: './img/icons_ios/calls.svg', route: 'calls', defaultHome: true },
  { id: 'settings', name: 'Ajustes', icon: './img/icons_ios/settings.svg', route: 'settings', defaultHome: true },
  { id: 'gallery', name: 'Galeria', icon: './img/icons_ios/gallery.svg', route: 'gallery', defaultHome: true },
  { id: 'camera', name: 'Camara', icon: './img/icons_ios/camera.svg', route: 'camera', defaultHome: true },
  { id: 'bank', name: 'Banco', icon: './img/icons_ios/bank.svg', route: 'bank', defaultHome: true },
  { id: 'wallet', name: 'Wallet', icon: './img/icons_ios/wallet.svg', route: 'wallet', defaultHome: true },
  { id: 'documents', name: 'Docs', icon: './img/icons_ios/documents.svg', route: 'documents', defaultHome: true },
  { id: 'appstore', name: 'App Store', icon: './img/icons_ios/appstore.svg', route: 'appstore', defaultHome: false },
  { id: 'wavechat', name: 'WaveChat', icon: './img/icons_ios/wavechat.svg', route: 'wavechat', defaultHome: true },
  { id: 'music', name: 'Musica', icon: './img/icons_ios/music.svg', route: 'music', defaultHome: true },
  { id: 'chirp', name: 'Chirp', icon: './img/icons_ios/chirp.svg', route: 'chirp', defaultHome: true },
  { id: 'snap', name: 'Snap', icon: './img/icons_ios/snap.svg', route: 'snap', defaultHome: true },
  { id: 'clips', name: 'Clips', icon: './img/icons_ios/clips.svg', route: 'clips', defaultHome: true },
  { id: 'darkrooms', name: 'DarkRooms', icon: './img/icons_ios/darkrooms.svg', route: 'darkrooms', defaultHome: true },
  { id: 'yellowpages', name: 'Amarillas', icon: './img/icons_ios/yellowpages.svg', route: 'yellowpages', defaultHome: true },
  // Market app disabled - using YellowPages instead
  // { id: 'market', name: 'Market', icon: './img/icons_ios/market.svg', route: 'market', defaultHome: true },
  { id: 'news', name: 'Noticias', icon: './img/icons_ios/news.svg', route: 'news', defaultHome: true },
  { id: 'garage', name: 'Garage', icon: './img/icons_ios/garage.svg', route: 'garage', defaultHome: true },
  { id: 'notes', name: 'Notas', icon: './img/icons_ios/notes.svg', route: 'notes', defaultHome: true },
  { id: 'maps', name: 'Mapas', icon: './img/icons_ios/map.svg', route: 'maps', defaultHome: true },
];

export const APP_IDS = APP_DEFINITIONS.map((app) => app.id);

export const DEFAULT_HOME_APPS = APP_DEFINITIONS.filter((app) => app.defaultHome).map((app) => app.id);
export const DEFAULT_MENU_APPS = APP_DEFINITIONS.filter((app) => !app.defaultHome).map((app) => app.id);

export const APP_BY_ID = APP_DEFINITIONS.reduce<Record<string, AppDefinition>>((acc, app) => {
  acc[app.id] = app;
  return acc;
}, {});
