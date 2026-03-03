export interface Contact {
  id: number;
  number: string;
  display: string;
  avatar?: string;
  favorite?: boolean;
}

export interface Message {
  id: number;
  transmitter: string;
  receiver: string;
  message: string;
  mediaUrl?: string;
  isRead: boolean;
  owner: 0 | 1;
  time: string | Date;
}

export interface Call {
  id: number;
  owner: string;
  num: string;
  incoming: boolean;
  accepts: boolean;
  duration: number;
  hidden: boolean;
  time: string | Date;
}

export interface ActiveCall {
  id: number;
  transmitterNum: string;
  receiverNum: string;
  isValid: boolean;
  accepts: boolean;
  hidden: boolean;
  rtcOffer?: string;
  rtcAnswer?: string;
}

export interface PhoneSettings {
  phoneNumber: string;
  wallpaper: string;
  ringtone: string;
  volume: number;
  lockCode: string;
  coque: string;
  theme: 'auto' | 'light' | 'dark';
  audioProfile?: 'normal' | 'street' | 'vehicle' | 'silent';
}

export interface PhoneFeatureFlags {
  appstore: boolean;
  wavechat: boolean;
  darkrooms: boolean;
  clips: boolean;
  wallet: boolean;
  documents: boolean;
  music: boolean;
  yellowpages: boolean;
}

export interface PhoneState {
  visible: boolean;
  locked: boolean;
  initialized: boolean;
  settings: PhoneSettings;
  appLayout: AppLayout;
  enabledApps: string[];
  featureFlags: PhoneFeatureFlags;
}

export interface PhoneNotification {
  id: string;
  appId: string;
  title: string;
  message: string;
  icon?: string;
  durationMs: number;
  priority?: 'low' | 'normal' | 'high';
  route?: string;
  data?: Record<string, unknown>;
  createdAt?: number;
}

export interface AppLayout {
  home: string[];
  menu: string[];
}

export interface GalleryPhoto {
  id: number;
  url: string;
  type: 'image' | 'video';
  createdAt: string;
}

export interface ChirpAccount {
  id: number;
  identifier: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  verified: boolean;
  followers: number;
  following: number;
}

export interface ChirpTweet {
  id: number;
  accountId: number;
  username: string;
  displayName: string;
  avatar?: string;
  verified: boolean;
  content: string;
  mediaUrl?: string;
  likes: number;
  rechirps: number;
  replies: number;
  liked: boolean;
  createdAt: string;
}

export interface SnapAccount {
  id: number;
  identifier: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  isPrivate: boolean;
  followers: number;
  following: number;
  posts: number;
}

export interface SnapPost {
  id: number;
  accountId: number;
  username: string;
  displayName: string;
  avatar?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  likes: number;
  comments: number;
  isLive: boolean;
  liveViewers: number;
  createdAt: string;
}

export interface SnapStory {
  id: number;
  accountId: number;
  username: string;
  displayName: string;
  avatar?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  expiresAt: string;
  views: number;
  viewed: boolean;
}

export interface NewsArticle {
  id: number;
  identifier: string;
  authorName: string;
  authorAvatar?: string;
  authorVerified: boolean;
  title: string;
  content: string;
  mediaUrl?: string;
  mediaType: 'image' | 'video';
  category: string;
  isLive: boolean;
  liveViewers: number;
  views: number;
  createdAt: string;
}

export interface MarketListing {
  id: number;
  identifier: string;
  phoneNumber: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  photos: string[];
  views: number;
  status: 'active' | 'sold' | 'expired';
  expiresAt?: string;
  createdAt: string;
}

export interface GarageVehicle {
  id: number;
  identifier: string;
  plate: string;
  model: string;
  modelName?: string;
  garageName?: string;
  impounded: boolean;
  properties?: Record<string, any>;
  createdAt: string;
}

export interface SharedLocation {
  from: string;
  fromServerId?: number;
  x: number;
  y: number;
  z: number;
  message?: string;
  expiresAt?: number;
}

export interface ContactRequest {
  fromPlayer: string;
  fromServerId: number;
  contact: {
    display: string;
    number: string;
    avatar?: string;
  };
}

export interface FriendRequest {
  fromPlayer: string;
  fromServerId: number;
  type: 'chirp' | 'snap';
}

export interface PhoneApp {
  id: string;
  name: string;
  nameKey: string;
  icon: string;
  route: string;
  showInHome?: boolean;
  showInMenu?: boolean;
  homePosition?: number;
  menuPosition?: number;
  badge?: () => number;
}
