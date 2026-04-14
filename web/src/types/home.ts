export type IconShape = 'squircle' | 'circle' | 'rounded' | 'square';

export const ALLOWED_FOLDER_COLORS = [
  'blue',
  'purple',
  'pink',
  'red',
  'orange',
  'green',
  'teal',
  'gray',
] as const;

export type AllowedFolderColor = typeof ALLOWED_FOLDER_COLORS[number];

export const DEFAULT_FOLDER_COLOR: AllowedFolderColor = 'blue';

export const FOLDER_ID_RE = /^folder_[a-z0-9]{10}$/;
export const FOLDER_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{0,19}$/u;
export const FOLDER_NAME_MAX = 20;

export interface Folder {
  id: string;
  name: string;
  apps: string[];
  color: AllowedFolderColor;
}

export type WidgetType = 'maps' | 'nowPlaying' | 'contacts' | 'notes' | 'chirp' | 'clock' | 'weather' | 'bank' | 'gallery' | 'radio';
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
  weather: { name: 'Weather', icon: './img/icons_ios/weather.svg', sizes: ['sm', 'md'] },
  bank: { name: 'Bank', icon: './img/icons_ios/bank.svg', sizes: ['sm', 'md'] },
  gallery: { name: 'Gallery', icon: './img/icons_ios/gallery.svg', sizes: ['sm', 'md'] },
  radio: { name: 'Radio', icon: './img/icons_ios/radio.svg', sizes: ['sm', 'md'] },
};

export const MAX_FOLDERS = 4;
export const MAX_APPS_PER_FOLDER = 4;
export const MAX_WIDGETS = 10;
export const MAX_LAYOUT_JSON_BYTES = 8192;
export const PINNED_APP_IDS = ['contacts', 'messages', 'mail'] as const;
