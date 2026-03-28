export type IconShape = 'squircle' | 'circle' | 'rounded' | 'square';

export interface Folder {
  id: string;
  name: string;
  apps: string[];
  color: string;
}

export type WidgetType = 'maps' | 'nowPlaying' | 'contacts' | 'notes' | 'chirp' | 'clock';
export type WidgetSize = 'sm' | 'md' | 'lg';

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  size: WidgetSize;
}

export interface WidgetLayout {
  widgets: WidgetInstance[];
}

export const DEFAULT_WIDGET_LAYOUT: WidgetLayout = {
  widgets: [
    { id: 'default-maps', type: 'maps', size: 'md' },
    { id: 'default-nowplaying', type: 'nowPlaying', size: 'md' },
  ],
};

export const WIDGET_DEFINITIONS: Record<WidgetType, { name: string; icon: string; sizes: WidgetSize[] }> = {
  maps: { name: 'Maps', icon: './img/icons_ios/map.svg', sizes: ['sm', 'md'] },
  nowPlaying: { name: 'Now Playing', icon: './img/icons_ios/music.svg', sizes: ['sm', 'md', 'lg'] },
  contacts: { name: 'Contacts', icon: './img/icons_ios/contacts.svg', sizes: ['sm', 'md'] },
  notes: { name: 'Notes', icon: './img/icons_ios/notes.svg', sizes: ['sm', 'md'] },
  chirp: { name: 'Chirp', icon: './img/icons_ios/chirp.svg', sizes: ['md', 'lg'] },
  clock: { name: 'Clock', icon: './img/icons_ios/clock.svg', sizes: ['sm', 'md'] },
};

export const MAX_FOLDERS = 8;
export const MAX_APPS_PER_FOLDER = 12;
export const MAX_WIDGETS = 10;
export const PINNED_APP_IDS = ['contacts', 'messages', 'mail'] as const;
