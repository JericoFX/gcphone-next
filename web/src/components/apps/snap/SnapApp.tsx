import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { useNuiEvent } from '../../../utils/useNui';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { fetchLiveKitToken, fetchSocketToken } from '../../../utils/realtimeAuth';
import { connectLiveKit, disconnectLiveKit, setLiveKitCameraEnabled, setLiveKitMicrophoneEnabled, setLiveKitRemoteAudioPriority, setLiveKitRemoteAudioVolume } from '../../../utils/livekit';
import { startMockLiveFeed } from '../../../utils/liveMock';
import {
  connectSnapLiveSocket,
  disconnectSnapLiveSocket,
  deleteSnapLiveMessage,
  joinSnapLiveRoom,
  leaveSnapLiveRoom,
  muteSnapLiveUser,
  sendSnapLiveMessage,
  sendSnapLiveReaction,
} from '../../../utils/socket';
import { AppFAB, AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { EmptyState } from '../../shared/ui/EmptyState';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { FormField, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { EmojiPickerButton } from '../../shared/ui/EmojiPicker';
import { LiveFlashlightControl } from '../../shared/ui/LiveFlashlightControl';
import { MediaActionButtons } from '../../shared/ui/MediaActionButtons';
import { MediaAttachmentPreview } from '../../shared/ui/MediaAttachmentPreview';
import { SearchInput } from '../../shared/ui/SearchInput';
import { SegmentedTabs } from '../../shared/ui/SegmentedTabs';
import { SheetIntro } from '../../shared/ui/SheetIntro';
import { SocialOnboardingModal, type SocialOnboardingPayload } from '../../shared/ui/SocialOnboardingModal';
import { VirtualList } from '../../shared/ui/VirtualList';
import { useLiveFlashlight } from '../../../hooks/useLiveFlashlight';
import styles from './SnapApp.module.scss';

interface SnapPost {
  id: number;
  account_id?: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  caption?: string;
  likes?: number;
  liked?: boolean;
  is_live?: boolean;
  is_own?: boolean;
}

interface SnapStory {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  expires_at?: string;
  is_own?: boolean;
}

interface SnapLive {
  id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  live_viewers?: number;
}

interface SnapLiveSocketMessage {
  id: string;
  liveId: string;
  authorId?: string;
  username: string;
  display?: string;
  avatar?: string;
  content: string;
  isMention: boolean;
  createdAt: number;
}

interface SnapLiveReaction {
  id: string;
  liveId: string;
  username: string;
  avatar?: string;
  reaction: string;
  createdAt: number;
}

type TrackKind = 'audio' | 'video';

interface MediaTrackEntry {
  sid: string;
  kind: TrackKind;
  element: HTMLMediaElement;
}

interface SnapFollowRequest {
  id: number;
  account_id: number;
  from_identifier?: string;
  to_identifier?: string;
  username?: string;
  display_name?: string;
  avatar?: string;
  verified?: boolean;
  created_at?: string;
}

interface SnapDiscoverPost {
  id: number;
  account_id: number;
  username?: string;
  display_name?: string;
  avatar?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  caption?: string;
  likes?: number;
  created_at?: string;
  is_private?: boolean;
  is_following?: boolean;
  requested_by_me?: boolean;
}

interface LiveStartResponse {
  success?: boolean;
  payload?: { postId?: number };
  error?: string;
}

interface SnapLiveAudioStartResponse {
  success?: boolean;
  enabled?: boolean;
  reason?: string;
  config?: {
    updateIntervalMs?: number;
  };
}

interface SnapLiveProximityState {
  liveId?: number;
  listening?: boolean;
  targetOnline?: boolean;
  distance?: number;
}

interface SnapLiveProximityVolume {
  liveId?: number;
  volume?: number;
}

interface SnapLiveProximityDisabled {
  liveId?: number;
  reason?: string;
}

interface SnapLiveAudioStatusResponse {
  active?: boolean;
  activeListen?: boolean;
  currentVolume?: number;
}

interface SnapAccount {
  username?: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
  is_private?: boolean | number;
}

function cleanLiveText(value: unknown, maxLength: number): string {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!normalized) return '';
  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }
  return normalized;
}

function normalizeLiveMessage(input: unknown): SnapLiveSocketMessage | null {
  if (!input || typeof input !== 'object') return null;

  const source = input as Record<string, unknown>;
  const id = cleanLiveText(source.id, 64);
  const liveId = cleanLiveText(source.liveId, 64);
  const username = cleanLiveText(source.username, 32);
  const content = cleanLiveText(source.content, 400);

  if (!id || !liveId || !username || !content) return null;

  const createdAtValue = Number(source.createdAt);
  const createdAt = Number.isFinite(createdAtValue) && createdAtValue > 0
    ? Math.floor(createdAtValue)
    : Date.now();

  return {
    id,
    liveId,
    authorId: cleanLiveText(source.authorId, 80) || undefined,
    username,
    display: cleanLiveText(source.display, 80) || undefined,
    content,
    isMention: source.isMention === true,
    createdAt,
    avatar: cleanLiveText(source.avatar, 255) || undefined,
  };
}

function getLiveAudioDisabledMessage(reason: string): string {
  if (reason === 'owner_offline') return 'Emisor no disponible';
  if (reason === 'stream_not_live') return 'Live finalizado';
  if (reason === 'rate_limited') return 'Intentando reconectar audio...';
  if (reason === 'stream_unavailable') return 'Audio de proximidad no disponible';
  return 'Audio pausado hasta recuperar proximidad';
}

const SNAP_MOCK_LIVE_ID = -999001;
const SNAP_MOCK_USERS = ['mika', 'luna', 'santi', 'mery', 'rodrigo'];
const SNAP_MOCK_LINES = [
  'Se ve re bien 🔥',
  'Vamos snap live 🙌',
  'Que buena toma 😮',
  'Jajaja top 😂',
  'Saludos desde LS ❤️',
  'Audio ok ✅',
  'Subi ese tema 🎵',
];

export function SnapApp() {
  const router = useRouter();
  const cache = useAppCache('snap');
  const DISCOVER_PAGE_SIZE = 30;

  // Data
  const [posts, setPosts] = createSignal<SnapPost[]>([]);
  const [stories, setStories] = createSignal<SnapStory[]>([]);
  const [liveStreams, setLiveStreams] = createSignal<SnapLive[]>([]);
  const [myAccount, setMyAccount] = createSignal<SnapAccount | null>(null);
  const [pendingRequests, setPendingRequests] = createSignal<SnapFollowRequest[]>([]);
  const [sentRequests, setSentRequests] = createSignal<SnapFollowRequest[]>([]);

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [fabTooltipVisible, setFabTooltipVisible] = createSignal(false);
  const [activeStoryIndex, setActiveStoryIndex] = createSignal<number | null>(null);
  const [storyProgressPct, setStoryProgressPct] = createSignal(0);
  const [viewerUrl, setViewerUrl] = createSignal<string | null>(null);
  const [showActionSheet, setShowActionSheet] = createSignal(false);
  const [statusMessage, setStatusMessage] = createSignal('');
  const [deletePostId, setDeletePostId] = createSignal<number | null>(null);
  const [showRequestsModal, setShowRequestsModal] = createSignal(false);
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'discover' | 'feed' | 'profile'>('feed');
  const [requestsLoading, setRequestsLoading] = createSignal(false);
  const [discoverLoading, setDiscoverLoading] = createSignal(false);
  const [discoverLoadingMore, setDiscoverLoadingMore] = createSignal(false);
  const [discoverRows, setDiscoverRows] = createSignal<SnapDiscoverPost[]>([]);
  const [discoverOffset, setDiscoverOffset] = createSignal(0);
  const [discoverHasMore, setDiscoverHasMore] = createSignal(true);
  const [discoverQuery, setDiscoverQuery] = createSignal('');
  const postModeTabs = [
    { id: 'post', label: 'Publicacion' },
    { id: 'story', label: 'Story' },
  ];

  const [profileDisplayName, setProfileDisplayName] = createSignal('');
  const [profileAvatar, setProfileAvatar] = createSignal('');
  const [profileBio, setProfileBio] = createSignal('');
  const [profilePrivate, setProfilePrivate] = createSignal(false);

  // Live Viewer
  const [activeLive, setActiveLive] = createSignal<SnapLive | null>(null);
  const [liveChatOpen, setLiveChatOpen] = createSignal(false);
  const [liveMessageInput, setLiveMessageInput] = createSignal('');
  const [liveMessages, setLiveMessages] = createSignal<SnapLiveSocketMessage[]>([]);
  const [liveFloating, setLiveFloating] = createSignal<SnapLiveSocketMessage[]>([]);
  const [liveReactions, setLiveReactions] = createSignal<SnapLiveReaction[]>([]);
  const [mutedUsers, setMutedUsers] = createSignal<string[]>([]);
  const [viewerMuted, setViewerMuted] = createSignal(false);
  const [liveStreaming, setLiveStreaming] = createSignal(false);
  const [liveConnected, setLiveConnected] = createSignal(false);
  const [liveVideoReady, setLiveVideoReady] = createSignal(false);
  const [liveLocalIdentity, setLiveLocalIdentity] = createSignal('');
  const [liveAudioProximityEnabled, setLiveAudioProximityEnabled] = createSignal(false);
  const [liveAudioHeartbeatAt, setLiveAudioHeartbeatAt] = createSignal(0);
  const [liveAudioWatchdogMs, setLiveAudioWatchdogMs] = createSignal(2400);
  const [liveAudioNear, setLiveAudioNear] = createSignal(false);
  const [liveAudioTargetOnline, setLiveAudioTargetOnline] = createSignal(true);
  const [liveAudioDistanceMeters, setLiveAudioDistanceMeters] = createSignal(-1);
  const liveFlashlight = useLiveFlashlight();

  // Create Post
  const [showCreatePost, setShowCreatePost] = createSignal(false);
  const [postMedia, setPostMedia] = createSignal('');
  const [postCaption, setPostCaption] = createSignal('');
  const [postMode, setPostMode] = createSignal<'post' | 'story'>('post');

  let storyTick: number | undefined;
  let floatingTimers = new Map<string, number>();
  let liveParticipantTracks = new Map<string, MediaTrackEntry[]>();
  let liveVideoHost: HTMLDivElement | undefined;
  let stopSnapMockFeed: (() => void) | undefined;
  let liveAudioWatchdogTimer: number | undefined;
  let liveAudioRetryTimer: number | undefined;

  const getPreferredLiveIdentity = () => {
    const entries = Array.from(liveParticipantTracks.entries());
    if (entries.length === 0) return null;

    const localIdentity = liveLocalIdentity();
    const remoteVideo = entries.find(([identity, tracks]) => identity !== localIdentity && tracks.some((track) => track.kind === 'video'));
    if (remoteVideo) return remoteVideo[0];

    const localVideo = entries.find(([identity, tracks]) => identity === localIdentity && tracks.some((track) => track.kind === 'video'));
    if (localVideo) return localVideo[0];

    const remoteAudio = entries.find(([identity]) => identity !== localIdentity);
    if (remoteAudio) return remoteAudio[0];

    return entries[0][0];
  };

  const renderLiveVideoStage = () => {
    const host = liveVideoHost;
    if (!host) return;

    while (host.firstChild) {
      host.removeChild(host.firstChild);
    }

    host.classList.remove(styles.liveVideoHostReady);
    setLiveVideoReady(false);

    const preferredIdentity = getPreferredLiveIdentity();
    if (!preferredIdentity) return;

    const localIdentity = liveLocalIdentity();
    const preferredTracks = liveParticipantTracks.get(preferredIdentity) || [];
    const videoTrack = preferredTracks.find((track) => track.kind === 'video');

    if (videoTrack) {
      videoTrack.element.className = styles.liveVideoElement;
      videoTrack.element.muted = preferredIdentity === localIdentity;
      host.appendChild(videoTrack.element);
      host.classList.add(styles.liveVideoHostReady);
      setLiveVideoReady(true);
    }

    for (const [identity, tracks] of liveParticipantTracks.entries()) {
      for (const track of tracks) {
        if (track.kind !== 'audio') continue;
        track.element.className = styles.liveAudioElement;
        track.element.muted = identity === localIdentity;
        host.appendChild(track.element);
      }
    }
  };

  const addLiveTrack = (identity: string, track: MediaTrackEntry) => {
    const current = liveParticipantTracks.get(identity) || [];
    const filtered = current.filter((entry) => entry.sid !== track.sid);
    for (const entry of current) {
      if (entry.sid === track.sid) {
        entry.element.remove();
      }
    }
    liveParticipantTracks.set(identity, [...filtered, track]);
    renderLiveVideoStage();
  };

  const removeLiveTrack = (identity: string, trackSid?: string) => {
    if (!liveParticipantTracks.has(identity)) return;

    if (!trackSid) {
      for (const track of liveParticipantTracks.get(identity) || []) {
        track.element.remove();
      }
      liveParticipantTracks.delete(identity);
      renderLiveVideoStage();
      return;
    }

    const next = (liveParticipantTracks.get(identity) || []).filter((track) => {
      if (track.sid !== trackSid) return true;
      track.element.remove();
      return false;
    });

    if (next.length > 0) {
      liveParticipantTracks.set(identity, next);
    } else {
      liveParticipantTracks.delete(identity);
    }
    renderLiveVideoStage();
  };

  const clearLiveVideoStage = () => {
    for (const tracks of liveParticipantTracks.values()) {
      for (const track of tracks) {
        track.element.remove();
      }
    }
    liveParticipantTracks = new Map<string, MediaTrackEntry[]>();
    setLiveLocalIdentity('');
    setLiveVideoReady(false);

    if (liveVideoHost) {
      while (liveVideoHost.firstChild) {
        liveVideoHost.removeChild(liveVideoHost.firstChild);
      }
      liveVideoHost.classList.remove(styles.liveVideoHostReady);
    }
  };

  const setLiveVideoStageHost = (element: HTMLDivElement | undefined) => {
    liveVideoHost = element;
    renderLiveVideoStage();
  };

  // FAB Tooltip
  let fabTimeout: number;
  const showFabTooltip = () => {
    setFabTooltipVisible(true);
    fabTimeout = window.setTimeout(() => setFabTooltipVisible(false), 2000);
  };
  const hideFabTooltip = () => {
    setFabTooltipVisible(false);
    if (fabTimeout) clearTimeout(fabTimeout);
  };

  const loadData = async () => {
    setLoading(true);
    
    // Load account
    const account = await fetchNui<SnapAccount>('snapGetAccount', {}, {});
    setMyAccount(account);
    setShowOnboarding(!account?.username);
    setProfileDisplayName(account?.display_name || '');
    setProfileAvatar(account?.avatar || '');
    setProfileBio(account?.bio || '');
    setProfilePrivate(account?.is_private === 1 || account?.is_private === true);
    
    // Load posts
    const postsCacheKey = 'snap:feed';
    const cachedPosts = cache.get<SnapPost[]>(postsCacheKey);
    const postsData = cachedPosts ?? await fetchNui<SnapPost[]>('snapGetFeed', { limit: 30, offset: 0 }, []);
    if (!cachedPosts) cache.set(postsCacheKey, postsData || [], 30000);
    setPosts(postsData || []);
    
    // Load stories
    const storiesData = await fetchNui<SnapStory[]>('snapGetStories', {});
    setStories(storiesData || []);
    
    // Load live streams
    const liveData = await fetchNui<SnapLive[]>('snapGetLiveStreams', {});
    setLiveStreams(liveData || []);

    const incoming = await fetchNui<SnapFollowRequest[]>('snapGetPendingFollowRequests', {}, []);
    const outgoing = await fetchNui<SnapFollowRequest[]>('snapGetSentFollowRequests', {}, []);
    setPendingRequests(incoming || []);
    setSentRequests(outgoing || []);

    await loadDiscoverFeed(true);
    
    setLoading(false);
  };

  const refreshFollowRequests = async () => {
    setRequestsLoading(true);
    const incoming = await fetchNui<SnapFollowRequest[]>('snapGetPendingFollowRequests', {}, []);
    const outgoing = await fetchNui<SnapFollowRequest[]>('snapGetSentFollowRequests', {}, []);
    setPendingRequests(incoming || []);
    setSentRequests(outgoing || []);
    setRequestsLoading(false);
  };

  const loadDiscoverFeed = async (reset: boolean) => {
    const query = sanitizeText(discoverQuery(), 60);
    const nextOffset = reset ? 0 : discoverOffset();

    if (reset) {
      setDiscoverLoading(true);
    } else {
      setDiscoverLoadingMore(true);
    }

    const rows = await fetchNui<SnapDiscoverPost[]>(
      'snapGetDiscoverFeed',
      {
        search: query,
        limit: DISCOVER_PAGE_SIZE,
        offset: nextOffset,
      },
      [],
    );

    const list = rows || [];
    if (reset) {
      setDiscoverRows(list);
      setDiscoverOffset(list.length);
    } else {
      setDiscoverRows((prev) => [...prev, ...list]);
      setDiscoverOffset(nextOffset + list.length);
    }
    setDiscoverHasMore(list.length === DISCOVER_PAGE_SIZE);
    setDiscoverLoading(false);
    setDiscoverLoadingMore(false);
  };

  const followAccountFromDiscover = async (entry: SnapDiscoverPost) => {
    const targetId = Number(entry.account_id || 0);
    if (!targetId) return;

    const result = await fetchNui<{
      following?: boolean;
      requested?: boolean;
      cancelled?: boolean;
      error?: string;
    }>(
      'snapFollow',
      { targetAccountId: targetId },
      { error: 'NO_RESPONSE' },
    );

    if (result?.error) {
      if (result.error === 'ALREADY_FOLLOWING') {
        setStatusMessage('Ya sigues a esta cuenta');
      } else if (result.error === 'ACCOUNT_NOT_FOUND') {
        setStatusMessage('Cuenta no encontrada');
      } else {
        setStatusMessage('No se pudo actualizar el seguimiento');
      }
      return;
    }

    if (result?.following) {
      setStatusMessage('Ahora sigues esta cuenta');
    } else if (result?.requested) {
      setStatusMessage('Solicitud de seguimiento enviada');
    } else if (result?.cancelled) {
      setStatusMessage('Solicitud de seguimiento cancelada');
    }

    await Promise.all([loadDiscoverFeed(true), refreshFollowRequests()]);
  };

  const loadMoreDiscover = async () => {
    if (discoverLoadingMore() || discoverLoading() || !discoverHasMore()) return;
    await loadDiscoverFeed(false);
  };

  onMount(() => {
    void loadData();
  });

  createEffect(() => {
    const tab = activeTab();
    discoverQuery();
    if (tab !== 'discover') return;

    const timer = window.setTimeout(() => {
      void loadDiscoverFeed(true);
    }, 260);

    onCleanup(() => window.clearTimeout(timer));
  });

  const handleStoryVideoTimeUpdate = (event: Event) => {
    const target = event.currentTarget as HTMLVideoElement | null;
    if (!target || target.duration <= 0) return;
    const pct = Math.min(100, (target.currentTime / target.duration) * 100);
    setStoryProgressPct(pct);
  };

  const handleStoryVideoEnded = () => {
    setStoryProgressPct(100);
    shiftStory(1);
  };

  useNuiEvent<SnapLive>('gcphone:snap:liveStarted', (live) => {
    setLiveStreams((prev) => {
      const next = prev.filter((entry) => entry.id !== live.id);
      return [live, ...next];
    });
  });

  useNuiEvent<number>('gcphone:snap:liveEnded', (liveId) => {
    setLiveStreams((prev) => prev.filter((entry) => entry.id !== Number(liveId)));
    if (activeLive()?.id === Number(liveId)) {
      void closeLiveViewer();
    }
  });

  useNuiEvent<{ liveId?: number; viewers?: number }>('gcphone:snap:liveViewersUpdated', (payload) => {
    const liveId = Number(payload?.liveId || 0);
    const viewers = Number(payload?.viewers ?? -1);
    if (liveId < 1 || viewers < 0) return;

    setLiveStreams((prev) => prev.map((entry) => (
      Number(entry.id) === liveId ? { ...entry, live_viewers: viewers } : entry
    )));
    setActiveLive((prev) => (
      prev && Number(prev.id) === liveId ? { ...prev, live_viewers: viewers } : prev
    ));
  });

  useNuiEvent<{ liveId?: number; message?: SnapLiveSocketMessage }>('gcphone:snap:liveMessage', (payload) => {
    const liveId = Number(payload?.liveId || 0);
    if (liveId < 1 || activeLive()?.id !== liveId || !payload?.message) return;

    const safeMessage = normalizeLiveMessage(payload.message);
    if (!safeMessage) return;

    setLiveMessages((prev) => [...prev.slice(-19), safeMessage]);
    setLiveFloating((prev) => [...prev.slice(-3), safeMessage]);
    const timer = window.setTimeout(() => {
      setLiveFloating((prev) => prev.filter((entry) => entry.id !== safeMessage.id));
      floatingTimers.delete(safeMessage.id);
    }, 4200);
    floatingTimers.set(safeMessage.id, timer);
  });

  useNuiEvent<{ liveId?: number; reaction?: SnapLiveReaction }>('gcphone:snap:liveReaction', (payload) => {
    const liveId = Number(payload?.liveId || 0);
    if (liveId < 1 || activeLive()?.id !== liveId || !payload?.reaction) return;

    setLiveReactions((prev) => [...prev.slice(-10), payload.reaction as SnapLiveReaction]);
    window.setTimeout(() => {
      setLiveReactions((prev) => prev.filter((entry) => entry.id !== payload.reaction?.id));
    }, 2600);
  });

  useNuiEvent<{ liveId?: number; messageId?: string }>('gcphone:snap:liveMessageRemoved', (payload) => {
    const liveId = Number(payload?.liveId || 0);
    const messageId = String(payload?.messageId || '');
    if (liveId < 1 || activeLive()?.id !== liveId || !messageId) return;

    setLiveMessages((prev) => prev.filter((entry) => entry.id !== messageId));
    setLiveFloating((prev) => prev.filter((entry) => entry.id !== messageId));
  });

  useNuiEvent<{ liveId?: number; username?: string }>('gcphone:snap:liveUserMuted', (payload) => {
    const liveId = Number(payload?.liveId || 0);
    const username = sanitizeText(payload?.username || '', 40).toLowerCase();
    if (liveId < 1 || activeLive()?.id !== liveId || !username) return;

    setMutedUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
    if (sanitizeText(myAccount()?.username || '', 40).toLowerCase() === username) {
      setViewerMuted(true);
      setStatusMessage('Estas silenciado en este live');
      setLiveKitRemoteAudioVolume(0);
    }
  });

  useNuiEvent<SnapLiveProximityState>('gcphone:snap:proximityState', (payload) => {
    const live = activeLive();
    if (!live) return;
    if (!liveAudioProximityEnabled()) return;
    if (Number(payload?.liveId) !== Number(live.id)) return;
    setLiveAudioHeartbeatAt(Date.now());
    setLiveAudioTargetOnline(payload?.targetOnline !== false);
    setLiveAudioNear(payload?.listening === true);
    setLiveAudioDistanceMeters(Number.isFinite(Number(payload?.distance)) ? Number(payload?.distance) : -1);

    if (viewerMuted()) {
      setStatusMessage('Estas silenciado en este live');
      setLiveKitRemoteAudioVolume(0);
      return;
    }

    if (payload?.targetOnline === false) {
      setStatusMessage('Live sin emisor cercano');
      setLiveKitRemoteAudioVolume(0);
      return;
    }

    if (payload?.listening === false) {
      setStatusMessage('Acercate para escuchar el live');
      setLiveKitRemoteAudioVolume(0);
      return;
    }

    setStatusMessage('');
  });

  useNuiEvent<SnapLiveProximityVolume>('gcphone:snap:proximityVolume', (payload) => {
    const live = activeLive();
    if (!live) return;
    if (!liveAudioProximityEnabled()) return;
    if (Number(payload?.liveId) !== Number(live.id)) return;
    setLiveAudioHeartbeatAt(Date.now());
    if (viewerMuted()) {
      setLiveKitRemoteAudioVolume(0);
      return;
    }
    const volume = Number(payload?.volume);
    if (!Number.isFinite(volume)) return;
    setLiveKitRemoteAudioVolume(volume);
  });

  useNuiEvent<SnapLiveProximityDisabled>('gcphone:snap:proximityDisabled', (payload) => {
    const live = activeLive();
    if (!live) return;
    if (Number(payload?.liveId) !== Number(live.id)) return;

    setLiveAudioProximityEnabled(false);
    setLiveAudioHeartbeatAt(0);
    setLiveAudioNear(false);
    setLiveAudioTargetOnline(true);
    setLiveAudioDistanceMeters(-1);
    setLiveKitRemoteAudioVolume(0);

    const reason = String(payload?.reason || '');
    if (reason === 'command_stop' || reason === 'manual_stop') {
      setStatusMessage('Audio pausado: proximidad requerida');
      return;
    }
    setStatusMessage('Audio pausado hasta recuperar proximidad');
  });

  let lastSharedMedia = '';
  createEffect(() => {
    const params = router.params();
    const sharedMedia = sanitizeMediaUrl(typeof params.postMedia === 'string' ? params.postMedia : '');
    const openComposer = params.openComposer === '1';
    if (!openComposer || !sharedMedia || sharedMedia === lastSharedMedia) return;
    lastSharedMedia = sharedMedia;
    setPostMedia(sharedMedia);
    setPostMode('post');
    setShowCreatePost(true);
  });

  let lastAvatarMedia = '';
  createEffect(() => {
    const params = router.params();
    const sharedAvatar = sanitizeMediaUrl(typeof params.avatarMedia === 'string' ? params.avatarMedia : '');
    const openProfile = params.openProfile === '1';
    if (!openProfile || !sharedAvatar || sharedAvatar === lastAvatarMedia) return;
    lastAvatarMedia = sharedAvatar;
    setProfileAvatar(sharedAvatar);
    setActiveTab('profile');
    setStatusMessage('Avatar listo para guardar');
  });

  onCleanup(() => {
    for (const timer of floatingTimers.values()) {
      window.clearTimeout(timer);
    }
    floatingTimers.clear();
    if (liveAudioRetryTimer) {
      window.clearTimeout(liveAudioRetryTimer);
      liveAudioRetryTimer = undefined;
    }
    void stopLiveAudioProximity();
    disconnectLiveKit();
    if (liveAudioWatchdogTimer) {
      window.clearInterval(liveAudioWatchdogTimer);
      liveAudioWatchdogTimer = undefined;
    }
    if (storyTick) {
      window.clearInterval(storyTick);
      storyTick = undefined;
    }
  });

  createEffect(() => {
    if (liveAudioWatchdogTimer) {
      window.clearInterval(liveAudioWatchdogTimer);
      liveAudioWatchdogTimer = undefined;
    }

    if (!liveAudioProximityEnabled()) {
      return;
    }

    liveAudioWatchdogTimer = window.setInterval(() => {
      if (!liveAudioProximityEnabled()) return;
      if (!activeLive()) return;
      if (viewerMuted()) return;

      const heartbeatAt = liveAudioHeartbeatAt();
      const maxIdleMs = liveAudioWatchdogMs();
      if (heartbeatAt <= 0 || maxIdleMs < 1000) return;

      if (Date.now() - heartbeatAt <= maxIdleMs) return;

      setLiveAudioProximityEnabled(false);
      setLiveKitRemoteAudioPriority(null);
      setLiveKitRemoteAudioVolume(0);
      setStatusMessage('Audio pausado hasta recuperar proximidad');
      void fetchNui('snapLiveAudioStop', {}, { success: true });
    }, 1000);

    onCleanup(() => {
      if (liveAudioWatchdogTimer) {
        window.clearInterval(liveAudioWatchdogTimer);
        liveAudioWatchdogTimer = undefined;
      }
    });
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (liveChatOpen()) {
        setLiveChatOpen(false);
        return;
      }
      if (activeLive()) {
        void closeLiveViewer();
        return;
      }
      if (activeStoryIndex() !== null) {
        setActiveStoryIndex(null);
        return;
      }
      if (showOnboarding()) {
        setShowOnboarding(false);
        return;
      }
      router.goBack();
    },
  });

  const toggleLike = async (e: Event, postId: number) => {
    e.stopPropagation();
    const response = await fetchNui<{ success?: boolean; payload?: { liked?: boolean; likes?: number } }>('snapToggleLike', { postId }, { success: false });
    if (!response?.success) return;

    const nextLiked = response.payload?.liked === true;
    const nextLikes = Number(response.payload?.likes ?? 0);
    const patchPost = <T extends { id: number; liked?: boolean; likes?: number }>(entry: T): T => (
      entry.id === postId
        ? { ...entry, liked: nextLiked, likes: nextLikes }
        : entry
    );

    setPosts((prev) => prev.map(patchPost));
    setDiscoverRows((prev) => prev.map(patchPost));
  };

  const deletePost = async (e: Event, postId: number) => {
    e.stopPropagation();
    setDeletePostId(postId);
  };

  const confirmDeletePost = async () => {
    const postId = deletePostId();
    if (!postId) return;

    await fetchNui('snapDeletePost', postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    setDeletePostId(null);
  };

  const saveProfile = async () => {
    const res = await fetchNui<{ success?: boolean }>('snapUpdateAccount', {
      isPrivate: profilePrivate(),
    });

    if (res?.success) {
      setStatusMessage('Perfil actualizado');
      setActiveTab('profile');
      await loadData();
      return;
    }

    setStatusMessage('No se pudo actualizar el perfil');
  };

  const createSnapAccount = async (payload: SocialOnboardingPayload) => {
    const avatar = sanitizeMediaUrl(payload.avatar) || '';
    const bio = sanitizeText(payload.bio, 180);

    const response = await fetchNui<{ success?: boolean; error?: string; account?: SnapAccount }>('snapCreateAccount', {
      username: payload.username,
      displayName: payload.displayName,
      avatar,
    }, { success: false });

    if (!response?.success) {
      return { ok: false, error: response?.error || 'No se pudo crear la cuenta de Snap.' };
    }

    const updated = await fetchNui<{ success?: boolean }>('snapUpdateAccount', {
      displayName: payload.displayName,
      avatar,
      bio,
      isPrivate: payload.isPrivate,
    }, { success: false });

    if (!updated?.success) {
      return { ok: false, error: 'Cuenta creada, pero no se pudieron guardar todos los datos del perfil.' };
    }

    setShowOnboarding(false);
    await loadData();
    return { ok: true };
  };

  const respondFollowRequest = async (requestId: number, accept: boolean) => {
    const res = await fetchNui<{ success?: boolean }>('snapRespondFollowRequest', {
      requestId,
      accept,
    });

    if (res?.success) {
      setStatusMessage(accept ? 'Solicitud aceptada' : 'Solicitud rechazada');
      await refreshFollowRequests();
    }
  };

  const cancelSentRequest = async (targetAccountId: number) => {
    const res = await fetchNui<{ success?: boolean }>('snapCancelFollowRequest', {
      targetAccountId,
    });

    if (res?.success) {
      setStatusMessage('Solicitud cancelada');
      await refreshFollowRequests();
    }
  };

  const formatStoryTime = (expiresAt?: string) => {
    if (!expiresAt) return '';
    const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor(remaining / (1000 * 60));
    return `${mins}m`;
  };

  const activeStory = () => {
    const idx = activeStoryIndex();
    return idx !== null ? stories()[idx] : null;
  };

  const isLiveOwner = createMemo(() => {
    const stream = activeLive();
    const username = myAccount()?.username;
    if (!stream || !username) return false;
    return stream.username === username;
  });

  const isMockLive = createMemo(() => {
    const stream = activeLive();
    return !!stream && Number(stream.id) < 0;
  });

  const startLiveAudioProximity = async (liveId: number, owner: boolean) => {
    if (liveAudioRetryTimer) {
      window.clearTimeout(liveAudioRetryTimer);
      liveAudioRetryTimer = undefined;
    }

    setLiveAudioProximityEnabled(false);
    setLiveAudioHeartbeatAt(0);
    setLiveAudioWatchdogMs(2400);
    setLiveAudioNear(false);
    setLiveAudioTargetOnline(true);
    setLiveAudioDistanceMeters(-1);
    setLiveKitRemoteAudioPriority(null);

    if (owner || liveId < 1) {
      setLiveKitRemoteAudioVolume(1);
      return;
    }

    const payload = await fetchNui<SnapLiveAudioStartResponse>('snapLiveAudioStart', { liveId }, { success: false, enabled: false });
    if (!payload?.success || !payload?.enabled) {
      setLiveKitRemoteAudioVolume(0);
      const reason = String(payload?.reason || '');
      setStatusMessage(getLiveAudioDisabledMessage(reason));

      if (!owner && reason === 'rate_limited') {
        liveAudioRetryTimer = window.setTimeout(() => {
          const current = activeLive();
          if (!current || Number(current.id) !== Number(liveId)) return;
          void startLiveAudioProximity(liveId, false);
        }, 1600);
      }

      return;
    }

    const intervalMs = Number(payload?.config?.updateIntervalMs);
    if (Number.isFinite(intervalMs) && intervalMs > 0) {
      const heartbeatWindow = Math.max(1600, Math.min(12000, Math.floor(intervalMs * 6)));
      setLiveAudioWatchdogMs(heartbeatWindow);
    }
    setLiveAudioHeartbeatAt(Date.now());
    setLiveAudioProximityEnabled(true);
  };

  const syncLiveAudioFromClientStatus = async () => {
    if (!liveAudioProximityEnabled()) return;
    if (viewerMuted()) {
      setLiveKitRemoteAudioVolume(0);
      return;
    }

    const status = await fetchNui<SnapLiveAudioStatusResponse>('snapLiveAudioStatus', {}, { active: false, activeListen: false, currentVolume: 1 });
    if (!status?.active) {
      setLiveKitRemoteAudioVolume(1);
      return;
    }

    if (status.activeListen !== true) {
      setLiveKitRemoteAudioVolume(0);
      return;
    }

    const currentVolume = Number(status.currentVolume);
    if (Number.isFinite(currentVolume)) {
      setLiveKitRemoteAudioVolume(currentVolume);
    }
  };

  const stopLiveAudioProximity = async () => {
    if (liveAudioRetryTimer) {
      window.clearTimeout(liveAudioRetryTimer);
      liveAudioRetryTimer = undefined;
    }

    setLiveAudioProximityEnabled(false);
    setLiveAudioHeartbeatAt(0);
    setLiveAudioWatchdogMs(2400);
    setLiveAudioNear(false);
    setLiveAudioTargetOnline(true);
    setLiveAudioDistanceMeters(-1);
    setLiveKitRemoteAudioPriority(null);
    setLiveKitRemoteAudioVolume(0);
    await fetchNui('snapLiveAudioStop', {}, { success: true });
  };

  const openLiveViewer = async (live: SnapLive) => {
    const owner = !!(myAccount()?.username && live.username && myAccount()?.username === live.username);
    await fetchNui('phoneSetVisualMode', { mode: 'live' }, true);
    setStatusMessage('');
    clearLiveVideoStage();
    setActiveLive(live);
    setLiveChatOpen(false);
    setLiveMessages([]);
    setLiveFloating([]);
    setLiveReactions([]);
    setMutedUsers([]);
    setViewerMuted(false);
    setLiveKitRemoteAudioPriority(live.username || null, { priorityScale: 1.0, othersScale: 0.45 });
    setLiveAudioNear(false);
    setLiveAudioTargetOnline(true);
    setLiveAudioDistanceMeters(-1);

    if (Number(live.id) < 0) {
      setLiveConnected(true);
      return;
    }

    const roomName = `snaplive-${live.id}`;
    const tokenPayload = await fetchLiveKitToken(roomName, owner, 1800);
    if (!tokenPayload?.success || !tokenPayload.token || !tokenPayload.url) {
      setStatusMessage('No se pudo abrir el live');
      setActiveLive(null);
      return;
    }

    try {
      const auth = await fetchSocketToken({ liveId: live.id });
      if (!auth?.success || !auth.host || !auth.token) {
        setStatusMessage('No se pudo abrir el chat del live');
        setActiveLive(null);
        return;
      }

      connectSnapLiveSocket(auth.host, auth.token, {
        onMessage: (message) => {
          const safeMessage = normalizeLiveMessage(message);
          if (!safeMessage) return;
          setLiveMessages((prev) => [...prev.slice(-19), safeMessage]);
          setLiveFloating((prev) => [...prev.slice(-3), safeMessage]);
          const timer = window.setTimeout(() => {
            setLiveFloating((prev) => prev.filter((entry) => entry.id !== safeMessage.id));
            floatingTimers.delete(safeMessage.id);
          }, 4200);
          floatingTimers.set(safeMessage.id, timer);
        },
        onReaction: (reaction) => {
          setLiveReactions((prev) => [...prev.slice(-10), reaction]);
          window.setTimeout(() => {
            setLiveReactions((prev) => prev.filter((entry) => entry.id !== reaction.id));
          }, 2600);
        },
        onViewersUpdated: ({ liveId, viewers }) => {
          const nextId = Number(liveId || 0);
          const nextViewers = Number(viewers ?? -1);
          if (nextId < 1 || nextViewers < 0) return;
          setActiveLive((prev) => (prev && Number(prev.id) === nextId ? { ...prev, live_viewers: nextViewers } : prev));
          setLiveStreams((prev) => prev.map((entry) => (
            Number(entry.id) === nextId ? { ...entry, live_viewers: nextViewers } : entry
          )));
        },
        onMessageDeleted: ({ messageId }) => {
          setLiveMessages((prev) => prev.filter((entry) => entry.id !== messageId));
          setLiveFloating((prev) => prev.filter((entry) => entry.id !== messageId));
        },
        onUserMuted: ({ username }) => {
          const normalized = sanitizeText(username, 40).toLowerCase();
          setMutedUsers((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
          if (normalized === sanitizeText(myAccount()?.username || '', 40).toLowerCase()) {
            setViewerMuted(true);
            setStatusMessage('Estas silenciado en este live');
            setLiveKitRemoteAudioVolume(0);
          }
        },
        onDisconnect: () => {
          setStatusMessage('Reconectando chat del live...');
        },
        onReconnect: async () => {
          const joinResult = await joinSnapLiveRoom(String(live.id));
          if (!joinResult?.success) {
            setStatusMessage('Sin conexion de chat live');
            return;
          }

          const initialMessages = Array.isArray(joinResult.messages)
            ? joinResult.messages.map((entry) => normalizeLiveMessage(entry)).filter((entry): entry is SnapLiveSocketMessage => Boolean(entry))
            : [];
          setLiveMessages(initialMessages.slice(-20));

          const nextViewers = Number(joinResult.viewers ?? -1);
          if (nextViewers >= 0) {
            setActiveLive((prev) => (prev ? { ...prev, live_viewers: nextViewers } : prev));
          }

          setStatusMessage('');
          if (!liveAudioProximityEnabled() && !owner) {
            void startLiveAudioProximity(Number(live.id), false);
            return;
          }

          if (liveAudioProximityEnabled()) {
            void syncLiveAudioFromClientStatus();
          }
        },
        onReconnectFailed: () => {
          setStatusMessage('Sin conexion de chat live');
        },
      });

      const joinResult = await joinSnapLiveRoom(String(live.id));
      if (!joinResult?.success) {
        setStatusMessage('No se pudo abrir el chat del live');
        disconnectSnapLiveSocket();
        setActiveLive(null);
        return;
      }

      const initialViewers = Number(joinResult.viewers ?? -1);
      if (initialViewers >= 0) {
        setActiveLive((prev) => (prev ? { ...prev, live_viewers: initialViewers } : prev));
        setLiveStreams((prev) => prev.map((entry) => (
          Number(entry.id) === Number(live.id) ? { ...entry, live_viewers: initialViewers } : entry
        )));
      }

      const initialMessages = Array.isArray(joinResult.messages)
        ? joinResult.messages.map((entry) => normalizeLiveMessage(entry)).filter((entry): entry is SnapLiveSocketMessage => Boolean(entry))
        : [];
      if (initialMessages.length > 0) {
        setLiveMessages(initialMessages.slice(-20));
      }

      setLiveLocalIdentity(tokenPayload.identity || '');
      await connectLiveKit(tokenPayload.url, tokenPayload.token, tokenPayload.maxDuration || 1800, {
        onParticipantDisconnected: (identity) => {
          removeLiveTrack(identity);
        },
        onTrackSubscribed: ({ participantIdentity, trackSid, kind, element }) => {
          addLiveTrack(participantIdentity, { sid: trackSid, kind, element });
        },
        onTrackUnsubscribed: ({ participantIdentity, trackSid }) => {
          removeLiveTrack(participantIdentity, trackSid);
        },
        onLocalTrackPublished: ({ participantIdentity, trackSid, kind, element }) => {
          addLiveTrack(participantIdentity, { sid: trackSid, kind, element });
        },
        onLocalTrackUnpublished: ({ participantIdentity, trackSid }) => {
          removeLiveTrack(participantIdentity, trackSid);
        },
      });
        if (owner) {
          await setLiveKitCameraEnabled(true);
          await setLiveKitMicrophoneEnabled(true);
        }

      setLiveConnected(true);
      await startLiveAudioProximity(Number(live.id), owner);
    } catch (_err) {
      setStatusMessage('No se pudo conectar al live');
      disconnectSnapLiveSocket();
      setActiveLive(null);
      await stopLiveAudioProximity();
      disconnectLiveKit();
    }
  };

  const closeLiveViewer = async () => {
    await fetchNui('phoneSetVisualMode', { mode: 'text' }, true);
    liveFlashlight.setPanelOpen(false);
    await liveFlashlight.turnOff();

    const stream = activeLive();
    const isMock = !!stream && Number(stream.id) < 0;
    if (stream) {
      if (!isMock) {
        leaveSnapLiveRoom(String(stream.id));
      }
      if (!isMock && liveStreaming() && isLiveOwner()) {
        await fetchNui('snapEndLive', stream.id);
      }
    }

    stopSnapMockFeed?.();
    stopSnapMockFeed = undefined;

    for (const timer of floatingTimers.values()) {
      window.clearTimeout(timer);
    }
    floatingTimers.clear();

    await stopLiveAudioProximity();
    disconnectSnapLiveSocket();
    disconnectLiveKit();
    clearLiveVideoStage();
    setActiveLive(null);
    setLiveStreaming(false);
    setLiveConnected(false);
    setLiveChatOpen(false);
    setLiveMessageInput('');
    setLiveMessages([]);
    setLiveFloating([]);
    setLiveReactions([]);
    setMutedUsers([]);
    setViewerMuted(false);
    setLiveAudioProximityEnabled(false);
    setLiveAudioNear(false);
    setLiveAudioTargetOnline(true);
    setLiveAudioDistanceMeters(-1);
    setLiveKitRemoteAudioPriority(null);
    if (isMock) {
      setLiveStreams((prev) => prev.filter((entry) => Number(entry.id) >= 0));
      return;
    }
    await loadData();
  };

  const startLive = async () => {
    setShowActionSheet(false);
    const result = await fetchNui<LiveStartResponse>('snapStartLive', {});
    if (!result?.success || !result.payload?.postId) {
      setStatusMessage('No se pudo iniciar el live');
      return;
    }

    const stream: SnapLive = {
      id: result.payload.postId,
      username: myAccount()?.username,
      display_name: myAccount()?.display_name,
      avatar: myAccount()?.avatar,
      live_viewers: 0,
    };
    setLiveStreaming(true);
    await openLiveViewer(stream);
  };

  const startMockLive = async () => {
    setShowActionSheet(false);
    const stream: SnapLive = {
      id: SNAP_MOCK_LIVE_ID,
      username: myAccount()?.username || 'mock_host',
      display_name: `${myAccount()?.display_name || 'Host'} (Mock)`,
      avatar: myAccount()?.avatar,
      live_viewers: 7,
    };
    setLiveStreams((prev) => [stream, ...prev.filter((entry) => Number(entry.id) >= 0)]);
    setLiveStreaming(false);
    await openLiveViewer(stream);
  };

  const sendLiveMessage = async () => {
    if (viewerMuted()) {
      setStatusMessage('Estas silenciado en este live');
      return;
    }

    const stream = activeLive();
    const content = sanitizeText(liveMessageInput(), 300);
    if (!stream || !content) return;
    if (Number(stream.id) < 0) {
      const message: SnapLiveSocketMessage = {
        id: `${Date.now()}-${Math.random()}`,
        liveId: String(stream.id),
        username: myAccount()?.username || 'viewer',
        avatar: myAccount()?.avatar,
        content,
        isMention: false,
        createdAt: Date.now(),
      };
      const safeMessage = normalizeLiveMessage(message);
      if (!safeMessage) return;
      setLiveMessages((prev) => [...prev.slice(-19), safeMessage]);
      setLiveFloating((prev) => [...prev.slice(-3), safeMessage]);
      const timer = window.setTimeout(() => {
        setLiveFloating((prev) => prev.filter((entry) => entry.id !== safeMessage.id));
        floatingTimers.delete(safeMessage.id);
      }, 4200);
      floatingTimers.set(safeMessage.id, timer);
      setLiveMessageInput('');
      return;
    }
    const response = await sendSnapLiveMessage(String(stream.id), content);
    if (response?.error === 'MUTED') {
      setViewerMuted(true);
      setStatusMessage('Estas silenciado en este live');
      return;
    }

    if (response?.success) {
      setLiveMessageInput('');
      return;
    }

    setStatusMessage('No se pudo enviar el mensaje');
  };

  const sendReaction = async (reaction: string) => {
    const stream = activeLive();
    if (!stream) return;
    if (Number(stream.id) < 0) {
      const payload: SnapLiveReaction = {
        id: `${Date.now()}-${Math.random()}`,
        liveId: String(stream.id),
        username: myAccount()?.username || 'viewer',
        avatar: myAccount()?.avatar,
        reaction,
        createdAt: Date.now(),
      };
      setLiveReactions((prev) => [...prev.slice(-10), payload]);
      window.setTimeout(() => {
        setLiveReactions((prev) => prev.filter((entry) => entry.id !== payload.id));
      }, 2600);
      return;
    }
    const response = await sendSnapLiveReaction(String(stream.id), reaction);
    if (response?.success) return;
    setStatusMessage('No se pudo enviar reaccion');
  };

  const removeLiveMessage = async (messageId: string) => {
    const stream = activeLive();
    if (!stream || !isLiveOwner()) return;
    if (Number(stream.id) < 0) {
      setLiveMessages((prev) => prev.filter((entry) => entry.id !== messageId));
      setLiveFloating((prev) => prev.filter((entry) => entry.id !== messageId));
      return;
    }
    const response = await deleteSnapLiveMessage(String(stream.id), messageId);
    if (response?.success) return;
    setStatusMessage('No se pudo eliminar el mensaje');
  };

  const muteLiveUser = async (username: string) => {
    const stream = activeLive();
    if (!stream || !isLiveOwner()) return;
    if (Number(stream.id) < 0) {
      const normalized = sanitizeText(username, 40).toLowerCase();
      setMutedUsers((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
      return;
    }
    const response = await muteSnapLiveUser(String(stream.id), username);
    if (response?.success) return;
    setStatusMessage('No se pudo silenciar al usuario');
  };

  const openStory = (index: number) => {
    setStoryProgressPct(0);
    setActiveStoryIndex(index);
  };

  const shiftStory = (offset: number) => {
    const current = activeStoryIndex();
    if (current === null) return;
    const next = current + offset;
    if (next < 0 || next >= stories().length) {
      setActiveStoryIndex(null);
      setStoryProgressPct(0);
      return;
    }
    setStoryProgressPct(0);
    setActiveStoryIndex(next);
  };

  createEffect(() => {
    const story = activeStory();
    if (!story) {
      if (storyTick) window.clearInterval(storyTick);
      storyTick = undefined;
      setStoryProgressPct(0);
      return;
    }

    if (story.media_type === 'video') {
      return;
    }

    const durationMs = 5000;
    const startedAt = Date.now();
    if (storyTick) window.clearInterval(storyTick);
    storyTick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setStoryProgressPct(pct);
      if (pct >= 100) {
        window.clearInterval(storyTick);
        storyTick = undefined;
        shiftStory(1);
      }
    }, 100);

    onCleanup(() => {
      if (storyTick) window.clearInterval(storyTick);
      storyTick = undefined;
    });
  });

  createEffect(() => {
    const stream = activeLive();
    if (!stream || Number(stream.id) >= 0) {
      stopSnapMockFeed?.();
      stopSnapMockFeed = undefined;
      return;
    }

    const mentionTarget = myAccount()?.username ? `@${myAccount()?.username}` : '@host';
    stopSnapMockFeed = startMockLiveFeed({
      users: SNAP_MOCK_USERS,
      lines: SNAP_MOCK_LINES,
      mentionTarget,
      onMessage: (entry) => {
        if (mutedUsers().includes(entry.user.toLowerCase())) return;
        const message: SnapLiveSocketMessage = {
          id: entry.id,
          liveId: String(stream.id),
          username: entry.user,
          content: entry.text,
          isMention: entry.isMention,
          createdAt: entry.createdAt,
        };
        const safeMessage = normalizeLiveMessage(message);
        if (!safeMessage) return;
        setLiveMessages((prev) => [...prev.slice(-19), safeMessage]);
        setLiveFloating((prev) => [...prev.slice(-3), safeMessage]);
        const timer = window.setTimeout(() => {
          setLiveFloating((prev) => prev.filter((msg) => msg.id !== safeMessage.id));
          floatingTimers.delete(safeMessage.id);
        }, 4200);
        floatingTimers.set(safeMessage.id, timer);
      },
      onReaction: (entry) => {
        const payload: SnapLiveReaction = {
          id: entry.id,
          liveId: String(stream.id),
          username: entry.user,
          reaction: entry.reaction,
          createdAt: entry.createdAt,
        };
        setLiveReactions((prev) => [...prev.slice(-10), payload]);
        window.setTimeout(() => {
          setLiveReactions((prev) => prev.filter((it) => it.id !== payload.id));
        }, 2600);
      },
    });

    onCleanup(() => {
      stopSnapMockFeed?.();
      stopSnapMockFeed = undefined;
    });
  });

  const publishPost = async () => {
    const media = sanitizeMediaUrl(postMedia());
    if (!media) {
      setStatusMessage('Selecciona una imagen o video para publicar.');
      return;
    }
    setStatusMessage('');
    
    setLoading(true);
    
    if (postMode() === 'story') {
      const result = await fetchNui<{ success?: boolean }>('snapPublishStory', {
        mediaUrl: media,
        mediaType: resolveMediaType(media)
      });
      if (result?.success) {
        setPostMedia('');
        setShowCreatePost(false);
        await loadData();
      }
    } else {
      const result = await fetchNui<{ success?: boolean }>('snapPublishPost', {
        mediaUrl: media,
        mediaType: resolveMediaType(media),
        caption: sanitizeText(postCaption(), 2200)
      });
      if (result?.success) {
        setPostMedia('');
        setPostCaption('');
        setShowCreatePost(false);
        cache.invalidate('snap:feed');
        await loadData();
      }
    }
    
    setLoading(false);
  };

  const attachFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    if (gallery?.[0]?.url) {
      setPostMedia(sanitizeMediaUrl(gallery[0].url) || '');
    }
  };

  const attachAvatarFromGallery = async () => {
    const gallery = await fetchNui<any[]>('getGallery', undefined, []);
    const first = gallery?.find((entry) => {
      const url = sanitizeMediaUrl(String(entry?.url || ''));
      return !!url && resolveMediaType(url) === 'image';
    });

    if (first?.url) {
      const clean = sanitizeMediaUrl(first.url);
      if (clean) {
        setProfileAvatar(clean);
        setStatusMessage('Avatar cargado desde galeria');
      }
    }
  };

  const openCamera = () => {
    const target = postMode() === 'story' ? 'snap-story' : 'snap-post';
    router.navigate('camera', { target });
    setShowActionSheet(false);
  };

  const openAvatarCamera = () => {
    router.navigate('camera', { target: 'snap-avatar' });
  };

  return (
    <AppScaffold title="Snap" subtitle="Comparte momentos" onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.snapApp}>
        <div class={styles.socialPanel}>
          <div class={styles.socialMeta}>
            <strong>{myAccount()?.display_name || myAccount()?.username || 'Perfil'}</strong>
            <span>
              {pendingRequests().length} pendientes · {sentRequests().length} enviadas
            </span>
          </div>
          <div class={styles.socialActions}>
            <div class={styles.tabContainer}>
              <button
                class={styles.tabButton}
                classList={{ [styles.activeTabBtn]: activeTab() === 'discover' }}
                onClick={() => setActiveTab('discover')}
              >
                <span class={styles.tabIcon}>🔍</span>
                Descubrir
              </button>
              <button
                class={styles.tabButton}
                classList={{ [styles.activeTabBtn]: activeTab() === 'feed' }}
                onClick={() => setActiveTab('feed')}
              >
                <span class={styles.tabIcon}><img src="./img/icons_ios/ui-grid.svg" alt="" draggable={false} /></span>
                Feed
              </button>
              <button
                class={styles.tabButton}
                classList={{ [styles.activeTabBtn]: activeTab() === 'profile' }}
                onClick={() => setActiveTab('profile')}
              >
                <span class={styles.tabIcon}><img src="./img/icons_ios/ui-user.svg" alt="" draggable={false} /></span>
                Perfil
              </button>
            </div>
            <button
              class={styles.notifyBtn}
              onClick={() => {
                setShowRequestsModal(true);
                void refreshFollowRequests();
              }}
              aria-label="Solicitudes"
            >
              <span><img src="./img/icons_ios/ui-bell.svg" alt="" draggable={false} /></span>
              <Show when={pendingRequests().length > 0}>
                <span class={styles.notifyBadge}>{pendingRequests().length}</span>
              </Show>
            </button>
          </div>
        </div>

        <Show when={statusMessage()}>
          <div class={styles.statusBanner}>{statusMessage()}</div>
        </Show>

        <Show when={activeTab() === 'feed'}>
          <>
            <div class={styles.storiesSection}>
              <div class={styles.storiesList}>
                <button class={styles.storyItem} onClick={() => setShowActionSheet(true)}>
                  <div class={styles.storyAvatar} classList={{ [styles.hasStory]: false }}>
                    <span>+</span>
                  </div>
                  <span class={styles.storyName}>Tu historia</span>
                </button>

                <For each={stories()}>
                  {(story, index) => (
                    <button class={styles.storyItem} onClick={() => openStory(index())}>
                      <div class={styles.storyAvatar} classList={{ [styles.hasStory]: true }}>
                        {story.avatar ? (
                          <img src={story.avatar} alt="" />
                        ) : (
                          <span>{(story.display_name || story.username || 'U').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span class={styles.storyName}>{story.display_name || story.username || 'Usuario'}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>

            <Show when={liveStreams().length > 0}>
              <div class={styles.liveSection}>
                <h4 class={styles.sectionTitle}>En vivo</h4>
                <div class={styles.liveList}>
                  <For each={liveStreams()}>
                    {(live) => (
                      <button class={styles.liveItem} onClick={() => void openLiveViewer(live)}>
                        <div class={styles.liveAvatar}>
                          {live.avatar ? (
                            <img src={live.avatar} alt="" />
                          ) : (
                            <span>{(live.display_name || live.username || 'U').charAt(0).toUpperCase()}</span>
                          )}
                          <span class={styles.liveBadge}>LIVE</span>
                        </div>
                        <span class={styles.liveName}>{live.display_name || live.username}</span>
                        <span class={styles.liveViewers}>{live.live_viewers || 0} viendo</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <div class={styles.postsSection}>
              <h4 class={styles.sectionTitle}>Publicaciones</h4>
              <div class={styles.postsGrid}>
                <For each={posts()}>
                  {(post) => (
                    <div class={styles.postCard} onClick={() => post.media_url && setViewerUrl(post.media_url)}>
                      <div class={styles.postMedia}>
                        {resolveMediaType(post.media_url) === 'video' ? (
                          <video src={post.media_url} preload="metadata" />
                        ) : (
                          <img src={post.media_url || './img/background/back001.jpg'} alt="" />
                        )}
                        {resolveMediaType(post.media_url) === 'video' && (
                          <div class={styles.videoIndicator}><img src="./img/icons_ios/ui-play.svg" alt="" draggable={false} /></div>
                        )}
                      </div>

                      <div class={styles.postOverlay}>
                        <div class={styles.postHeader}>
                          <span class={styles.postAuthor}>{post.display_name || post.username}</span>
                        </div>

                        <div class={styles.postActions}>
                          <button
                            class={styles.actionBtn}
                            classList={{ [styles.liked]: post.liked }}
                            onClick={(e) => toggleLike(e, post.id)}
                          >
                            <span>{post.liked ? '♥' : '♡'}</span>
                            <span class={styles.count}>{post.likes || 0}</span>
                          </button>

                          <Show when={post.is_own}>
                            <button class={styles.actionBtn} onClick={(e) => deletePost(e, post.id)}>
                              <span><img src="./img/icons_ios/ui-trash.svg" alt="" draggable={false} /></span>
                            </button>
                          </Show>
                        </div>

                        <Show when={post.caption}>
                          <p class={styles.postCaption}>{post.caption}</p>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <Show when={!loading() && posts().length === 0}>
                <EmptyState class={styles.emptyState} title="No hay publicaciones" description="Se el primero en compartir algo con tu circulo." />
              </Show>
            </div>
          </>
        </Show>

        <Show when={activeTab() === 'discover'}>
          <div class={styles.discoverSection}>
            <h4 class={styles.sectionTitle}>Descubrir</h4>
            <SearchInput
              value={discoverQuery()}
              onInput={(value) => setDiscoverQuery(sanitizeText(value, 60))}
              placeholder="Buscar por @usuario, nombre o caption"
              class={styles.discoverSearchRoot}
              inputClass={styles.discoverSearch}
            />

            <Show when={!discoverLoading()} fallback={<p class={styles.discoverHint}>Cargando descubrimiento...</p>}>
              <Show when={discoverRows().length > 0} fallback={<p class={styles.discoverHint}>No hay publicaciones para mostrar.</p>}>
                <VirtualList
                  items={discoverRows}
                  itemHeight={170}
                  overscan={4}
                  class={styles.discoverVirtual}
                  contentClass={styles.discoverVirtualContent}
                >
                  {(post) => {
                    const canFollow = Number(post.account_id || 0) > 0;
                    const isFollowing = Number(post.is_following || 0) === 1;
                    const requestedByMe = Number(post.requested_by_me || 0) === 1;
                    return (
                      <div class={styles.discoverPostRow}>
                        <button
                          class={styles.discoverMedia}
                          onClick={() => post.media_url && setViewerUrl(post.media_url)}
                        >
                          {resolveMediaType(post.media_url) === 'video' ? (
                            <video src={post.media_url} preload="metadata" muted />
                          ) : (
                            <img src={post.media_url || './img/background/back001.jpg'} alt="" />
                          )}
                        </button>

                        <div class={styles.discoverMeta}>
                          <strong>{post.display_name || post.username || 'Usuario'}</strong>
                          <span>@{post.username || 'usuario'}</span>
                          <Show when={post.caption}>
                            <p>{post.caption}</p>
                          </Show>
                        </div>

                        <Show when={canFollow}>
                          <button
                            class={styles.discoverFollowBtn}
                            classList={{ [styles.acceptBtn]: !isFollowing }}
                            disabled={isFollowing}
                            onClick={() => void followAccountFromDiscover(post)}
                          >
                            {isFollowing
                              ? 'Siguiendo'
                              : requestedByMe
                                ? 'Cancelar'
                                : Number(post.is_private || 0) === 1
                                  ? 'Solicitar'
                                  : 'Seguir'}
                          </button>
                        </Show>
                      </div>
                    );
                  }}
                </VirtualList>

                <Show when={discoverHasMore()}>
                  <button
                    class={styles.socialActionBtn}
                    disabled={discoverLoadingMore()}
                    onClick={() => void loadMoreDiscover()}
                  >
                    {discoverLoadingMore() ? 'Cargando...' : 'Cargar mas'}
                  </button>
                </Show>
              </Show>
            </Show>
          </div>
        </Show>

        <Show when={activeTab() === 'profile'}>
          <div class={styles.profileTab}>
            <h4 class={styles.sectionTitle}>Perfil</h4>

            <div class={styles.profileHelper}>
              El nombre principal de Snap queda fijo desde la configuracion inicial del telefono.
            </div>

            <FormField
              label="Nombre visible"
              value={profileDisplayName()}
              onChange={(value) => setProfileDisplayName(sanitizeText(value, 50))}
              placeholder="Tu nombre"
              disabled
            />

            <label class={styles.privacyRow}>
              <input
                type="checkbox"
                checked={profilePrivate()}
                onChange={(e) => setProfilePrivate(e.currentTarget.checked)}
              />
              <span>Cuenta privada</span>
            </label>

            <div class={styles.profileSaveRow}>
              <button class={styles.acceptBtn} onClick={() => void saveProfile()}>
                Guardar perfil
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* FAB - Hidden on Profile tab */}
      <Show when={activeTab() !== 'profile'}>
        <AppFAB
          class={styles.fab}
          icon="+"
          onClick={() => setShowActionSheet(true)}
          tooltip="Crear"
          tooltipVisible={fabTooltipVisible()}
          onPointerDown={showFabTooltip}
          onPointerUp={hideFabTooltip}
          onPointerLeave={hideFabTooltip}
        />
      </Show>

      {/* Action Sheet */}
      <ActionSheet
        open={showActionSheet()}
        title="Crear"
        onClose={() => setShowActionSheet(false)}
        actions={[
          { label: 'Camara', tone: 'primary', onClick: openCamera },
          { label: 'Galeria', tone: 'primary', onClick: () => { setShowActionSheet(false); setShowCreatePost(true); } },
          { label: 'Subir Story', onClick: () => { setPostMode('story'); setShowActionSheet(false); setShowCreatePost(true); } },
          { label: 'Iniciar Live', onClick: () => void startLive() },
          { label: 'Mock Live', onClick: () => void startMockLive() },
        ]}
      />

      {/* Create Post Modal */}
      <Modal
        open={showCreatePost()}
        title={postMode() === 'story' ? 'Subir Story' : 'Nueva Publicacion'}
        onClose={() => { setShowCreatePost(false); setPostMedia(''); setPostCaption(''); }}
        size="md"
      >
        <div class={styles.createContent}>
          <SheetIntro title="Crear contenido" description="Publica una foto o video en tu perfil, o comparte una story temporal." />
          <div class={styles.modeToggle}>
            <SegmentedTabs items={postModeTabs} active={postMode()} onChange={(id) => setPostMode(id as 'post' | 'story')} />
          </div>

          <Show when={!postMedia()}>
            <MediaActionButtons
              actions={[
                { icon: './img/icons_ios/camera.svg', label: 'Camara', onClick: openCamera },
                { icon: './img/icons_ios/gallery.svg', label: 'Galeria', onClick: attachFromGallery },
              ]}
              variant="tiles"
            />
          </Show>

          <Show when={postMedia()}>
            <MediaAttachmentPreview url={postMedia()} removable onRemove={() => setPostMedia('')} />

            <Show when={postMode() === 'post'}>
              <EmojiPickerButton value={postCaption()} onChange={setPostCaption} maxLength={2200} />
      <textarea class={styles.captionInput}
                placeholder="Escribe un caption..."
                value={postCaption()}
                onInput={(e) => setPostCaption(e.currentTarget.value)}
                rows={3}
              />
            </Show>
          </Show>
        </div>

        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => { setShowCreatePost(false); setPostMedia(''); setPostCaption(''); }} />
          <ModalButton 
            label={loading() ? 'Publicando...' : 'Publicar'}
            onClick={() => void publishPost()}
            tone="primary"
            disabled={!postMedia() || loading()}
          />
        </ModalActions>
      </Modal>

      {/* Story Viewer */}
      <Show when={activeStoryIndex() !== null && activeStory()}>
        <div class={styles.storyViewer}>
          <button 
            class={styles.storyClose}
            onClick={() => setActiveStoryIndex(null)}
          >
            <img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} />
          </button>
          
          <button 
            class={styles.storyNav}
            classList={{ [styles.disabled]: (activeStoryIndex() || 0) <= 0 }}
            onClick={() => shiftStory(-1)}
          >
            <img src="./img/icons_ios/ui-chevron-left.svg" alt="" draggable={false} />
          </button>
          
          <button 
            class={styles.storyNav}
            classList={{ [styles.next]: true, [styles.disabled]: (activeStoryIndex() || 0) >= stories().length - 1 }}
            onClick={() => shiftStory(1)}
          >
            <img src="./img/icons_ios/ui-chevron-right.svg" alt="" draggable={false} />
          </button>

          <div class={styles.storyProgress}>
            <div 
              class={styles.progressBar}
              style={{ width: `${storyProgressPct()}%` }}
            />
          </div>

          <div class={styles.storyInfo}>
            <strong>{activeStory()?.display_name || activeStory()?.username}</strong>
            <span>{formatStoryTime(activeStory()?.expires_at)} restante</span>
          </div>

          {resolveMediaType(activeStory()?.media_url) === 'video' ? (
            <video 
              src={activeStory()?.media_url} 
              playsinline 
              autoplay
              muted={false}
              onTimeUpdate={handleStoryVideoTimeUpdate}
              onEnded={handleStoryVideoEnded}
              class={styles.storyMedia}
            />
          ) : (
            <img 
              src={activeStory()?.media_url} 
              alt="" 
              class={styles.storyMedia}
            />
          )}
        </div>
      </Show>

      {/* Live Viewer */}
      <Show when={activeLive()}>
        <div class={styles.liveViewer}>
          <div class={styles.liveTopBar}>
            <button class={styles.liveUtilityButton} onClick={() => void closeLiveViewer()}><img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} /></button>
            <div class={styles.liveOwnerInfo}>
              <strong>{activeLive()?.display_name || activeLive()?.username || 'Live'}</strong>
              <span>
                {isMockLive() ? 'MOCK LIVE' : (liveConnected() ? 'EN VIVO' : 'Conectando...')}
              </span>
            </div>
            <div class={styles.liveTopBarRight}>
              <span class={styles.liveViewerCount}>{Math.max(Number(activeLive()?.live_viewers || 0), isLiveOwner() ? 1 : 0)} viendo</span>
              <Show when={liveAudioProximityEnabled() && !isLiveOwner()}>
                <div
                  class={styles.liveAudioBadge}
                  classList={{
                    [styles.liveAudioBadgeNear]: liveAudioNear() && liveAudioTargetOnline(),
                    [styles.liveAudioBadgeFar]: !liveAudioNear() && liveAudioTargetOnline(),
                    [styles.liveAudioBadgeOffline]: !liveAudioTargetOnline(),
                  }}
                >
                  <span class={styles.liveAudioBadgeDot} />
                  <span>
                    {!liveAudioTargetOnline() ? 'Sin emisor' : (liveAudioNear() ? 'Audio cercano' : 'Fuera de rango')}
                  </span>
                  <Show when={liveAudioDistanceMeters() >= 0}>
                    <small>{Math.round(liveAudioDistanceMeters())}m</small>
                  </Show>
                </div>
              </Show>
              <LiveFlashlightControl
                visible={liveFlashlight.supported() && isLiveOwner()}
                enabled={liveFlashlight.enabled()}
                panelOpen={liveFlashlight.panelOpen()}
                kelvin={liveFlashlight.kelvin()}
                lumens={liveFlashlight.lumens()}
                kelvinRange={liveFlashlight.kelvinRange()}
                lumensRange={liveFlashlight.lumensRange()}
                buttonLabel={<img src="./img/icons_ios/ui-flashlight.svg" alt="" draggable={false} />}
                buttonTitle="Linterna"
                theme="dark"
                variant="circle"
                onPointerDown={liveFlashlight.beginPress}
                onPointerUp={liveFlashlight.endPress}
                onPointerLeave={liveFlashlight.cancelPress}
                onPointerCancel={liveFlashlight.cancelPress}
                onKelvinInput={(value) => {
                  liveFlashlight.setKelvin(value);
                  void liveFlashlight.saveSettings({ kelvin: value });
                }}
                onLumensInput={(value) => {
                  liveFlashlight.setLumens(value);
                  void liveFlashlight.saveSettings({ lumens: value });
                }}
                onPreset={(kelvin, lumens) => {
                  void liveFlashlight.applyPreset(kelvin, lumens);
                }}
              />
              <button class={styles.liveUtilityButton} onClick={() => setLiveChatOpen((prev) => !prev)}><img src="./img/icons_ios/ui-chat.svg" alt="" draggable={false} /></button>
            </div>
          </div>

          <div class={styles.liveStage}>
            <div class={styles.liveVideoCanvas}>
              <div
                ref={setLiveVideoStageHost}
                class={styles.liveVideoHost}
                classList={{ [styles.liveVideoHostReady]: liveVideoReady() }}
              />
              <Show when={!liveVideoReady()}>
                <div class={styles.livePlaceholder}>
                  {isMockLive() ? 'Vista previa mock del live' : (liveConnected() ? 'Esperando video del live...' : 'Conectando video...')}
                </div>
              </Show>
            </div>

            <div class={styles.liveFloatingLayer}>
              <For each={liveFloating()}>
                {(message) => (
                  <div class={styles.liveFloatingMessage} classList={{ [styles.liveMention]: message.isMention }}>
                    <strong>@{message.username}</strong>
                    <p>{message.content}</p>
                  </div>
                )}
              </For>

              <For each={liveReactions()}>
                {(reaction) => (
                  <div class={styles.liveReactionBubble}>{reaction.reaction}</div>
                )}
              </For>
            </div>

            <div class={styles.liveReactionRow}>
              <button onClick={() => void sendReaction('👍')}>👍</button>
              <button onClick={() => void sendReaction('❤️')}>❤️</button>
              <button onClick={() => void sendReaction('😂')}>😂</button>
              <button onClick={() => void sendReaction('🔥')}>🔥</button>
              <button onClick={() => void sendReaction('👏')}>👏</button>
            </div>

            <Show when={liveChatOpen()}>
              <div class={styles.liveChatPanel}>
                <div class={styles.liveChatHeader}>
                  <strong>Chat en vivo</strong>
                  <span>{activeLive()?.display_name || activeLive()?.username || 'Live'} · max 20</span>
                </div>
                <div class={styles.liveChatList}>
                  <For each={liveMessages()}>
                    {(message) => (
                      <div class={styles.liveChatItem} classList={{ [styles.liveMention]: message.isMention }}>
                        <div class={styles.liveChatBody}>
                          <strong>@{message.username}</strong>
                          <p>{message.content}</p>
                        </div>
                        <Show when={isLiveOwner() && message.username !== myAccount()?.username}>
                          <div class={styles.liveModerationCol}>
                            <button onClick={() => void removeLiveMessage(message.id)}><img src="./img/icons_ios/ui-trash.svg" alt="" draggable={false} /></button>
                            <button onClick={() => void muteLiveUser(message.username)}><img src="./img/icons_ios/ui-block.svg" alt="" draggable={false} /></button>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>

                <Show when={viewerMuted()}>
                  <div class={styles.liveMutedBanner}>Estas silenciado en este live</div>
                </Show>

                <Show
                  when={!isLiveOwner()}
                  fallback={<div class={styles.liveHostHint}>Sos host: hablas en vivo, moderas el chat.</div>}
                >
                  <div class={styles.liveChatInputRow}>
                    <EmojiPickerButton value={liveMessageInput()} onChange={setLiveMessageInput} maxLength={300} />
                    <input
                      value={liveMessageInput()}
                      onInput={(e) => setLiveMessageInput(sanitizeText(e.currentTarget.value, 300))}
                      onKeyDown={(e) => e.key === 'Enter' && void sendLiveMessage()}
                      placeholder="Escribe en el live..."
                      disabled={viewerMuted()}
                    />
                    <button onClick={() => void sendLiveMessage()} disabled={viewerMuted() || !liveMessageInput().trim()}>
                      Enviar
                    </button>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <SocialOnboardingModal
        open={showOnboarding()}
        appName="Snap"
        usernameHint={myAccount()?.username || ''}
        displayNameHint={profileDisplayName() || myAccount()?.display_name || ''}
        avatarHint={profileAvatar() || myAccount()?.avatar || ''}
        bioHint={profileBio() || myAccount()?.bio || ''}
        isPrivateHint={profilePrivate() || myAccount()?.is_private === 1 || myAccount()?.is_private === true}
        displayNameReadOnly
        onCreate={createSnapAccount}
        onClose={() => setShowOnboarding(false)}
      />

      <Modal
        open={showRequestsModal()}
        title="Solicitudes"
        onClose={() => setShowRequestsModal(false)}
        size="lg"
      >
        <div class={styles.requestsBlock}>
          <SheetIntro title="Solicitudes" description="Administra quien puede seguirte y revisa las peticiones que enviaste." />
          <h4>Recibidas</h4>
          <Show when={!requestsLoading()} fallback={<p>Cargando...</p>}>
            <Show when={pendingRequests().length > 0} fallback={<EmptyState title="Sin pendientes" description="Las nuevas solicitudes apareceran aqui." />}>
              <For each={pendingRequests()}>
                {(request) => (
                  <div class={styles.requestRow}>
                    <div class={styles.requestIdentity}>
                      <strong>{request.display_name || request.username || 'Usuario'}</strong>
                      <span>@{request.username || request.from_identifier || 'user'}</span>
                    </div>
                    <div class={styles.requestActions}>
                      <button onClick={() => void respondFollowRequest(request.id, false)}>Rechazar</button>
                      <button class={styles.acceptBtn} onClick={() => void respondFollowRequest(request.id, true)}>Aceptar</button>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </div>

        <div class={styles.requestsBlock}>
          <h4>Enviadas</h4>
          <Show when={sentRequests().length > 0} fallback={<EmptyState title="Sin solicitudes enviadas" description="Cuando envies una solicitud podras seguirla desde aqui." />}>
            <For each={sentRequests()}>
              {(request) => (
                <div class={styles.requestRow}>
                  <div class={styles.requestIdentity}>
                    <strong>{request.display_name || request.username || 'Usuario'}</strong>
                    <span>@{request.username || request.to_identifier || 'user'}</span>
                  </div>
                  <div class={styles.requestActions}>
                    <button onClick={() => void cancelSentRequest(request.account_id)}>Cancelar</button>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Modal>

      <Modal
        open={deletePostId() !== null}
        title="Eliminar publicacion"
        onClose={() => setDeletePostId(null)}
        size="sm"
      >
        <p>Esta accion no se puede deshacer.</p>
        <ModalActions>
          <ModalButton label="Cancelar" onClick={() => setDeletePostId(null)} />
          <ModalButton label="Eliminar" tone="danger" onClick={() => void confirmDeletePost()} />
        </ModalActions>
      </Modal>

      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />
    </AppScaffold>
  );
}
