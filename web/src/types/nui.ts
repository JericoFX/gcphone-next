import type {
  AppLayout,
  Contact,
  Message,
  MessageType,
  PhoneFeatureFlags,
  PhoneFramework,
  PhoneSettings,
  PhoneSetupPayload,
  PhoneSetupState,
} from './index';
import type { WidgetLayout } from './home';

export type NuiSuccessResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

export type ContactFormData = {
  id?: number;
  display?: string;
  number?: string;
  name?: string;
  phoneNumber?: string;
  avatar?: string;
  favorite?: boolean;
};

export type MessageFormData = {
  phoneNumber?: string;
  message?: string;
  content?: string;
  mediaUrl?: string;
  replyToId?: number;
  messageType?: MessageType;
  audioData?: string;
  audioDuration?: number;
  attachments?: unknown[];
};

export type AutoReplyData = {
  enabled?: boolean;
  message?: string;
};

export type InboxNotification = {
  id: number;
  app_id: string;
  title: string;
  content: string;
  avatar?: string | null;
  meta?: unknown;
  is_read: number;
  createdAt: number;
};

export type NotificationsInboxResponse = NuiSuccessResponse & {
  notifications?: InboxNotification[];
  unread?: number;
};

export type MailAccount = {
  id: number;
  alias: string;
  email: string;
};

export type MailAttachment = {
  type: 'image' | 'video' | 'document' | 'link';
  url: string;
  name?: string;
  mime?: string;
  size?: number;
  sourceApp?: string;
};

export type MailMessage = {
  id: number;
  sender_email?: string;
  sender_alias?: string;
  recipient_email: string;
  recipient_alias?: string;
  subject?: string;
  body: string;
  attachments?: MailAttachment[];
  is_read?: number;
  created_at: number;
};

export type MailStateResponse = NuiSuccessResponse & {
  hasAccount?: boolean;
  account?: MailAccount | null;
  inbox?: MailMessage[];
  sent?: MailMessage[];
  unread?: number;
  total?: number;
  domain?: string;
};

export type MailMessagesResponse = NuiSuccessResponse & {
  folder?: 'inbox' | 'sent';
  messages?: MailMessage[];
};

export type TransferContact = {
  display: string;
  number: string;
};

export type BankTransaction = {
  amount: number;
  description?: string;
  time?: string;
};

export type WalletCardData = {
  id: number;
  label: string;
  last4: string;
  color?: string;
};

export type WalletTransactionData = {
  id: number;
  amount: number;
  type: 'in' | 'out' | 'adjust';
  title: string;
  target_phone?: string;
  created_at: string;
};

export type WalletStateResponse = {
  balance?: number;
  cards?: WalletCardData[];
  transactions?: WalletTransactionData[];
};

export type WalletRequestData = {
  id: number;
  requester_phone: string;
  requester_name?: string;
  target_phone: string;
  target_name?: string;
  amount: number;
  title: string;
  method: string;
  status: string;
  created_at: string;
  expires_at: string;
};

export type WalletPendingRequestsResponse = {
  incoming?: WalletRequestData[];
  outgoing?: WalletRequestData[];
};

export type NearbyPlayerData = {
  serverId: number;
  name: string;
  distance: number;
};

export type LiveLocationStateResponse = NuiSuccessResponse & {
  active?: boolean;
  recipients?: string[];
  intervalSeconds?: number;
  startedAt?: number;
  expiresAt?: number;
};

export type FlashlightSettingsResponse = NuiSuccessResponse & {
  enabled?: boolean;
  kelvin?: number;
  lumens?: number;
  minKelvin?: number;
  maxKelvin?: number;
  minLumens?: number;
  maxLumens?: number;
};

export type GalleryPhoto = {
  id: number;
  url: string;
  type?: 'image' | 'video';
  album_id?: number | null;
  created_at?: string;
};

export type GalleryAlbum = {
  id: number;
  name: string;
  color: string;
};

export type NuiPhonePayload = PhoneSettings & {
  framework?: PhoneFramework;
  imei?: string;
  deviceOwnerName?: string;
  isStolen?: boolean;
  stolenAt?: string | null;
  stolenReason?: string | null;
  appLayout?: AppLayout;
  enabledApps?: string[];
  featureFlags?: Partial<PhoneFeatureFlags>;
  requiresSetup?: boolean;
  setup?: PhoneSetupState;
  useLockScreen?: boolean;
  forceLockScreen?: boolean;
  accessMode?: 'own' | 'foreign-readonly' | 'foreign-full';
  accessOwnerName?: string;
  accessPhoneId?: string;
};

export type AppLayoutResponse =
  | { layout?: AppLayout | null; version?: number }
  | AppLayout
  | null;

export type SaveAppLayoutResponse = {
  ok?: boolean;
  version?: number;
  layout?: AppLayout;
  reason?: string;
} | null;

export interface NuiRequestMap {
  getContacts: undefined;
  addContact: ContactFormData;
  updateContact: ContactFormData;
  deleteContact: { id: number | string };
  toggleFavorite: { id: number | string };
  getMessages: undefined;
  sendMessage: MessageFormData;
  setAutoReply: AutoReplyData;
  getAutoReply: undefined;
  deleteMessage: { id: number | string };
  deleteConversation: { phoneNumber: string };
  markAsRead: { phoneNumber: string };
  reactToMessage: { messageId: number; emoji: string };
  removeReaction: { messageId: number };
  notificationsGet: { limit?: number; offset?: number };
  notificationsMarkRead: { id: number | string };
  notificationsMarkAllRead: Record<string, never>;
  notificationsDelete: { id: number | string };
  mailGetState: { limit?: number; offset?: number };
  mailCreateAccount: { alias?: string };
  mailSend: { to?: string; subject?: string; body?: string; attachments?: MailAttachment[] };
  mailGetMessages: { folder?: 'inbox' | 'sent'; limit?: number; offset?: number };
  mailMarkRead: { messageId: number | string };
  mailDelete: { messageId: number | string; folder?: 'inbox' | 'sent' };
  getBankBalance: undefined;
  getBankTransactions: undefined;
  getContactsForTransfer: undefined;
  transferMoney: { targetNumber: string; amount: number };
  walletGetState: Record<string, never>;
  walletAddCard: { label: string; last4: string; color?: string };
  walletRemoveCard: { cardId: number | string };
  walletProximityTransfer: { targetPhone: string; amount: number; title?: string; method?: string };
  walletCreateInvoice: Record<string, unknown>;
  walletRespondInvoice: { invoiceId: string; accept: boolean; paymentMethod?: 'cash' | 'bank' };
  walletGetPendingRequests: Record<string, never>;
  walletRespondRequest: { requestId: number | string; accept: boolean };
  getNearbyPlayers: { maxDistance?: number };
  getLiveLocationState: Record<string, never>;
  startLiveLocation: { recipients: string[]; durationMinutes: number; updateIntervalSeconds: number };
  stopLiveLocation: Record<string, never>;
  setLiveLocationInterval: { seconds: number };
  cameraToggleFlashlight: { enabled: boolean };
  cameraGetFlashlightSettings: Record<string, never>;
  cameraSetFlashlightSettings: { kelvin?: number; lumens?: number };
  getGallery: undefined;
  galleryGetAlbums: undefined;
  galleryCreateAlbum: { name: string; color: string };
  galleryDeleteAlbum: { albumId: number | string };
  galleryMoveToAlbum: { photoId: number | string; albumId: number | null };
  galleryShareNfc: { photoId: number | string; targetServerId: number };
  shareNfcPayload: { targetServerId: number; payload: Record<string, unknown> };
  phoneVerifyPin: { pin: string };
  phoneGetSetupState: undefined;
  phoneCompleteSetup: PhoneSetupPayload;
  setWallpaper: { url: string };
  setRingtone: { ringtone: string };
  setCallRingtone: { ringtone: string };
  setNotificationTone: { tone: string };
  setMessageTone: { tone: string };
  setVolume: { volume: number };
  setTheme: { theme: 'auto' | 'light' | 'dark' };
  setLanguage: { language: string };
  setAudioProfile: { audioProfile: 'normal' | 'street' | 'vehicle' | 'silent' };
  setStreamerMode: { enabled: boolean };
  setLockCode: { code: string };
  setAirplaneMode: { enabled: boolean };
  factoryResetPhone: undefined;
  getAppLayout: Record<string, never>;
  setAppLayout: { layout: AppLayout; version: number };
  getWidgetLayout: Record<string, never>;
  setWidgetLayout: { layout?: WidgetLayout };
}

export interface NuiResponseMap {
  getContacts: Contact[];
  addContact: NuiSuccessResponse & { id?: number };
  updateContact: NuiSuccessResponse;
  deleteContact: NuiSuccessResponse;
  toggleFavorite: NuiSuccessResponse;
  getMessages: Message[];
  sendMessage: NuiSuccessResponse;
  setAutoReply: NuiSuccessResponse;
  getAutoReply: Required<AutoReplyData>;
  deleteMessage: NuiSuccessResponse;
  deleteConversation: NuiSuccessResponse;
  markAsRead: NuiSuccessResponse;
  reactToMessage: NuiSuccessResponse;
  removeReaction: NuiSuccessResponse;
  notificationsGet: NotificationsInboxResponse;
  notificationsMarkRead: NuiSuccessResponse;
  notificationsMarkAllRead: NuiSuccessResponse;
  notificationsDelete: NuiSuccessResponse;
  mailGetState: MailStateResponse;
  mailCreateAccount: MailStateResponse;
  mailSend: NuiSuccessResponse & { id?: number };
  mailGetMessages: MailMessagesResponse;
  mailMarkRead: NuiSuccessResponse;
  mailDelete: NuiSuccessResponse;
  getBankBalance: number;
  getBankTransactions: BankTransaction[];
  getContactsForTransfer: TransferContact[];
  transferMoney: NuiSuccessResponse;
  walletGetState: WalletStateResponse;
  walletAddCard: NuiSuccessResponse;
  walletRemoveCard: NuiSuccessResponse;
  walletProximityTransfer: NuiSuccessResponse & { balance?: number; distance?: number; maxDistance?: number };
  walletCreateInvoice: NuiSuccessResponse & { channel?: 'nfc' | 'remote' };
  walletRespondInvoice: NuiSuccessResponse;
  walletGetPendingRequests: WalletPendingRequestsResponse;
  walletRespondRequest: NuiSuccessResponse;
  getNearbyPlayers: NearbyPlayerData[];
  getLiveLocationState: LiveLocationStateResponse;
  startLiveLocation: NuiSuccessResponse;
  stopLiveLocation: NuiSuccessResponse;
  setLiveLocationInterval: NuiSuccessResponse;
  cameraToggleFlashlight: NuiSuccessResponse & { enabled?: boolean };
  cameraGetFlashlightSettings: FlashlightSettingsResponse;
  cameraSetFlashlightSettings: NuiSuccessResponse;
  getGallery: GalleryPhoto[];
  galleryGetAlbums: GalleryAlbum[];
  galleryCreateAlbum: NuiSuccessResponse & Partial<GalleryAlbum>;
  galleryDeleteAlbum: NuiSuccessResponse;
  galleryMoveToAlbum: NuiSuccessResponse;
  galleryShareNfc: NuiSuccessResponse;
  shareNfcPayload: NuiSuccessResponse;
  phoneVerifyPin: NuiSuccessResponse & { unlocked?: boolean };
  phoneGetSetupState: NuiSuccessResponse & { requiresSetup?: boolean; setup?: PhoneSetupState };
  phoneCompleteSetup: NuiSuccessResponse & { requiresSetup?: boolean; setup?: PhoneSetupState };
  setWallpaper: NuiSuccessResponse;
  setRingtone: NuiSuccessResponse;
  setCallRingtone: NuiSuccessResponse;
  setNotificationTone: NuiSuccessResponse;
  setMessageTone: NuiSuccessResponse;
  setVolume: NuiSuccessResponse;
  setTheme: NuiSuccessResponse;
  setLanguage: NuiSuccessResponse;
  setAudioProfile: NuiSuccessResponse;
  setStreamerMode: NuiSuccessResponse;
  setLockCode: NuiSuccessResponse;
  setAirplaneMode: boolean;
  factoryResetPhone: NuiPhonePayload & { success?: boolean };
  getAppLayout: AppLayoutResponse;
  setAppLayout: SaveAppLayoutResponse;
  getWidgetLayout: WidgetLayout | null;
  setWidgetLayout: NuiSuccessResponse;
}

export type NuiEventName = keyof NuiRequestMap;
export type NuiRequestData<TEvent extends NuiEventName> = NuiRequestMap[TEvent];
export type NuiResponseData<TEvent extends NuiEventName> = NuiResponseMap[TEvent];
