import { fetchNui } from './fetchNui';

// --- Response type shapes ---

export interface WaveGroupMessage {
  id: string;
  groupId: string;
  sender: string;
  content: string;
  mediaUrl?: string;
  timestamp: number;
}

export interface WaveDMMessage {
  id: string;
  sender: string;
  content: string;
  mediaUrl?: string;
  timestamp: number;
  read: boolean;
}

export interface WaveDMConversation {
  targetPhone: string;
  displayName?: string;
  lastMessage?: string;
  lastTimestamp?: number;
  unread: number;
}

export interface SnapLiveJoinResult {
  success: boolean;
  viewers: number;
  messages: SnapLiveMessage[];
}

export interface SnapLiveMessage {
  id: string;
  liveId: number;
  sender: string;
  content: string;
  timestamp: number;
}

export interface MatchMessage {
  id: number;
  matchId: number;
  sender: string;
  content: string;
  timestamp: number;
}

// --- WaveChat Groups ---

export function sendWaveMessage(
  groupId: string,
  content: string,
  mediaUrl?: string
): Promise<unknown> {
  return fetchNui('wavechatSendGroupMessage', { groupId, message: content, mediaUrl });
}

export function getWaveRecent(
  groupId: string,
  limit = 100
): Promise<WaveGroupMessage[]> {
  return fetchNui<WaveGroupMessage[]>('wavechatGetGroupMessages', { groupId, limit }, []);
}

export function sendWaveTyping(
  groupId: string,
  typing: boolean
): Promise<unknown> {
  return fetchNui('wavechatGroupTyping', { groupId, typing });
}

// --- WaveChat DMs ---

export function sendWaveDM(
  targetPhone: string,
  content: string,
  mediaUrl?: string
): Promise<unknown> {
  return fetchNui('wavechatDmSend', { targetPhone, content, mediaUrl });
}

export function getWaveDMHistory(
  targetPhone: string
): Promise<WaveDMMessage[]> {
  return fetchNui<WaveDMMessage[]>('wavechatDmGetHistory', { targetPhone }, []);
}

export function getWaveDMConversations(): Promise<WaveDMConversation[]> {
  return fetchNui<WaveDMConversation[]>('wavechatDmGetConversations', {}, []);
}

export function sendWaveDMTyping(
  targetPhone: string,
  typing: boolean
): Promise<unknown> {
  return fetchNui('wavechatDmTyping', { targetPhone, typing });
}

export function markWaveDMRead(targetPhone: string): Promise<unknown> {
  return fetchNui('wavechatDmMarkRead', { targetPhone });
}

export function deleteWaveDMConversation(targetPhone: string): Promise<unknown> {
  return fetchNui('wavechatDmDeleteConversation', { targetPhone });
}

// --- SnapLive Chat ---

export function joinSnapLiveRoom(
  liveId: string | number
): Promise<SnapLiveJoinResult> {
  return fetchNui<SnapLiveJoinResult>(
    'snapJoinLiveChat',
    { liveId: Number(liveId) },
    { success: false, viewers: 0, messages: [] }
  );
}

export function leaveSnapLiveRoom(liveId: string | number): Promise<unknown> {
  return fetchNui('snapLeaveLiveChat', { liveId: Number(liveId) });
}

export function sendSnapLiveMessage(
  liveId: string | number,
  content: string
): Promise<unknown> {
  return fetchNui('snapSendLiveMessage', { liveId: Number(liveId), content });
}

export function sendSnapLiveReaction(
  liveId: string | number,
  reaction: string
): Promise<unknown> {
  return fetchNui('snapSendLiveReaction', { liveId: Number(liveId), reaction });
}

export function deleteSnapLiveMessage(
  liveId: string | number,
  messageId: string
): Promise<unknown> {
  return fetchNui('snapRemoveLiveMessage', { liveId: Number(liveId), messageId });
}

export function muteSnapLiveUser(
  liveId: string | number,
  username: string
): Promise<unknown> {
  return fetchNui('snapMuteLiveUser', { liveId: Number(liveId), username });
}

// --- MatchMyLove Chat ---

export function getMatchMessages(
  matchId: number,
  offset?: number
): Promise<MatchMessage[]> {
  return fetchNui<MatchMessage[]>('matchmyloveGetMessages', { matchId, offset }, []);
}

export function sendMatchMessage(
  matchId: number,
  content: string
): Promise<unknown> {
  return fetchNui('matchmyloveSendMessage', { matchId, content });
}

export function sendMatchTyping(
  matchId: number,
  typing: boolean
): Promise<unknown> {
  return fetchNui('matchmyloveTyping', { matchId, typing });
}

// --- Compatibility stubs (replace socket connect/disconnect) ---

export function connectWaveChat(): void {}
export function disconnectWaveChat(): void {}
export function connectSnapLive(): void {}
export function disconnectSnapLive(): void {}
export function connectMatchMyLove(): void {}
export function disconnectMatchMyLove(): void {}

export function isWaveSocketConnected(): boolean {
  return true;
}

export function isSnapLiveSocketConnected(): boolean {
  return true;
}

export function isMmlSocketConnected(): boolean {
  return true;
}
