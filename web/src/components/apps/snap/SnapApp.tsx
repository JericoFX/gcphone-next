import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
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
import { SearchInput } from '../../shared/ui/SearchInput';
import { SocialOnboardingModal, type SocialOnboardingPayload } from '../../shared/ui/SocialOnboardingModal';
import { ShareSheet, type SharePayload } from '../../shared/ui/ShareSheet';
import { VirtualList } from '../../shared/ui/VirtualList';
import { useLiveFlashlight } from '../../../hooks/useLiveFlashlight';
import { getStoredLanguage, t } from '../../../i18n';
import { SnapStoryViewerOverlay } from './SnapStoryViewer';
import { SnapCreatePostModal } from './SnapCreatePostModal';
import { SnapRequestsModal } from './SnapRequestsModal';
import type {
  SnapPost, SnapStory, SnapLive, SnapLiveSocketMessage, SnapLiveReaction,
  TrackKind, MediaTrackEntry, SnapFollowRequest, SnapDiscoverPost,
  LiveStartResponse, SnapLiveAudioStartResponse, SnapLiveProximityState,
  SnapLiveProximityVolume, SnapLiveProximityDisabled, SnapLiveAudioStatusResponse, SnapAccount,
} from './SnapTypes';
import { normalizeLiveMessage, getLiveAudioDisabledMessage, SNAP_MOCK_LIVE_ID, SNAP_MOCK_USERS, SNAP_MOCK_LINES } from './SnapTypes';
import styles from './SnapApp.module.scss';

// Removed: all interfaces and helper functions moved to SnapTypes.ts
// (SnapPost, SnapStory, SnapLive, SnapLiveSocketMessage, SnapLiveReaction,
//  TrackKind, MediaTrackEntry, SnapFollowRequest, SnapDiscoverPost,
//  LiveStartResponse, SnapLiveAudioStartResponse, SnapLiveProximityState,
//  SnapLiveProximityVolume, SnapLiveProximityDisabled, SnapLiveAudioStatusResponse,
//  SnapAccount, cleanLiveText, normalizeLiveMessage, getLiveAudioDisabledMessage,
//  SNAP_MOCK_LIVE_ID, SNAP_MOCK_USERS, SNAP_MOCK_LINES)

export function SnapApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
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
  const [sharePayload, setSharePayload] = createSignal<SharePayload | null>(null);
  const [fabTooltipVisible, setFabTooltipVisible] = createSignal(false);
  const [activeStoryIndex, setActiveStoryIndex] = createSignal<number | null>(null);
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
  const [postMode, setPostMode] = createSignal<'post' | 'story'>('post');

  let floatingTimers = new Map<string, number>();
  let reactionTimers: number[] = [];
  let liveParticipantTracks = new Map<string, MediaTrackEntry[]>();
  let liveVideoHost: HTMLDivElement | undefined;
  let stopSnapMockFeed: (() => void) | undefined;
  let liveAudioWatchdogTimer: number | undefined;
  let liveAudioRetryTimer: number | undefined;

  const clearFloatingTimers = () => {
    floatingTimers.forEach((timer) => window.clearTimeout(timer));
    floatingTimers.clear();
  };

  const pushLiveMessage = (message: SnapLiveSocketMessage) => {
    setLiveMessages((prev) => [...prev.slice(-19), message]);
    setLiveFloating((prev) => [...prev.slice(-3), message]);

    const timer = window.setTimeout(() => {
      setLiveFloating((prev) => prev.filter((entry) => entry.id !== message.id));
      floatingTimers.delete(message.id);
    }, 4200);

    floatingTimers.set(message.id, timer);
  };

  const pushLiveReaction = (reaction: SnapLiveReaction) => {
    setLiveReactions((prev) => [...prev.slice(-10), reaction]);
    const timer = window.setTimeout(() => {
      setLiveReactions((prev) => prev.filter((entry) => entry.id !== reaction.id));
      reactionTimers = reactionTimers.filter((t) => t !== timer);
    }, 2600);
    if (reactionTimers.length >= 32) {
      const expired = reactionTimers.splice(0, reactionTimers.length - 31);
      expired.forEach((t) => window.clearTimeout(t));
    }
    reactionTimers.push(timer);
  };

  const updateLiveViewerCount = (liveId: number, viewers: number) => {
    if (liveId < 1 || viewers < 0) return;

    setLiveStreams((prev) => prev.map((entry) => (
      Number(entry.id) === liveId ? { ...entry, live_viewers: viewers } : entry
    )));
    setActiveLive((prev) => (
      prev && Number(prev.id) === liveId ? { ...prev, live_viewers: viewers } : prev
    ));
  };

  const resetLiveAudioState = () => {
    setLiveAudioProximityEnabled(false);
    setLiveAudioHeartbeatAt(0);
    setLiveAudioWatchdogMs(2400);
    setLiveAudioNear(false);
    setLiveAudioTargetOnline(true);
    setLiveAudioDistanceMeters(-1);
  };

  const loadFollowRequests = async () => {
    const incoming = await fetchNui<SnapFollowRequest[]>('snapGetPendingFollowRequests', {}, []);
    const outgoing = await fetchNui<SnapFollowRequest[]>('snapGetSentFollowRequests', {}, []);
    setPendingRequests(incoming || []);
    setSentRequests(outgoing || []);
  };

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
    await loadFollowRequests();
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
        setStatusMessage(t('snap.already_following', language()));
      } else if (result.error === 'ACCOUNT_NOT_FOUND') {
        setStatusMessage(t('snap.account_not_found', language()));
      } else {
        setStatusMessage(t('snap.follow_error', language()));
      }
      return;
    }

    if (result?.following) {
      setStatusMessage(t('snap.now_following', language()));
    } else if (result?.requested) {
      setStatusMessage(t('snap.follow_requested', language()));
    } else if (result?.cancelled) {
      setStatusMessage(t('snap.follow_cancelled', language()));
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

    updateLiveViewerCount(liveId, viewers);
  });

  useNuiEvent<{ liveId?: number; message?: SnapLiveSocketMessage }>('gcphone:snap:liveMessage', (payload) => {
    const liveId = Number(payload?.liveId || 0);
    if (liveId < 1 || activeLive()?.id !== liveId || !payload?.message) return;

    const safeMessage = normalizeLiveMessage(payload.message);
    if (!safeMessage) return;

    pushLiveMessage(safeMessage);
  });

  useNuiEvent<{ liveId?: number; reaction?: SnapLiveReaction }>('gcphone:snap:liveReaction', (payload) => {
    const liveId = Number(payload?.liveId || 0);
    if (liveId < 1 || activeLive()?.id !== liveId || !payload?.reaction) return;

    pushLiveReaction(payload.reaction as SnapLiveReaction);
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
      setStatusMessage(t('snap.live_muted', language()));
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
      setStatusMessage(t('snap.live_muted', language()));
      setLiveKitRemoteAudioVolume(0);
      return;
    }

    if (payload?.targetOnline === false) {
      setStatusMessage(t('snap.live_no_broadcaster', language()));
      setLiveKitRemoteAudioVolume(0);
      return;
    }

    if (payload?.listening === false) {
      setStatusMessage(t('snap.live_approach', language()));
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

    resetLiveAudioState();
    setLiveKitRemoteAudioVolume(0);

    const reason = String(payload?.reason || '');
    if (reason === 'command_stop' || reason === 'manual_stop') {
      setStatusMessage(t('snap.audio_paused_proximity', language()));
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
    setStatusMessage(t('snap.avatar_ready', language()));
  });

  onCleanup(() => {
    clearFloatingTimers();
    reactionTimers.forEach((t) => window.clearTimeout(t));
    reactionTimers = [];
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
      setStatusMessage(t('snap.audio_paused_recover', language()));
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
      setStatusMessage(t('snap.profile_updated', language()));
      setActiveTab('profile');
      await loadData();
      return;
    }

    setStatusMessage(t('snap.profile_update_failed', language()));
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
      return { ok: false, error: response?.error || t('snap.create_account_failed', language()) };
    }

    const updated = await fetchNui<{ success?: boolean }>('snapUpdateAccount', {
      displayName: payload.displayName,
      avatar,
      bio,
      isPrivate: payload.isPrivate,
    }, { success: false });

    if (!updated?.success) {
      return { ok: false, error: t('snap.create_account_partial', language()) };
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
      setStatusMessage(accept ? t('snap.request_accepted', language()) : t('snap.request_rejected', language()));
      await refreshFollowRequests();
    }
  };

  const cancelSentRequest = async (targetAccountId: number) => {
    const res = await fetchNui<{ success?: boolean }>('snapCancelFollowRequest', {
      targetAccountId,
    });

    if (res?.success) {
      setStatusMessage(t('snap.request_cancelled', language()));
      await refreshFollowRequests();
    }
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

    resetLiveAudioState();
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
      setStatusMessage(t('snap.live_open_failed', language()));
      setActiveLive(null);
      return;
    }

    try {
      const auth = await fetchSocketToken({ liveId: live.id });
      if (!auth?.success || !auth.host || !auth.token) {
          setStatusMessage(t('snap.live_chat_open_failed', language()));
        setActiveLive(null);
        return;
      }

      connectSnapLiveSocket(auth.host, auth.token, {
        onMessage: (message) => {
          const safeMessage = normalizeLiveMessage(message);
          if (!safeMessage) return;
          pushLiveMessage(safeMessage);
        },
        onReaction: (reaction) => {
          pushLiveReaction(reaction);
        },
        onViewersUpdated: ({ liveId, viewers }) => {
          const nextId = Number(liveId || 0);
          const nextViewers = Number(viewers ?? -1);
          updateLiveViewerCount(nextId, nextViewers);
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
            setStatusMessage(t('snap.live_muted', language()));
            setLiveKitRemoteAudioVolume(0);
          }
        },
        onDisconnect: () => {
          setStatusMessage(t('snap.live_reconnecting', language()));
        },
        onReconnect: async () => {
          const joinResult = await joinSnapLiveRoom(String(live.id));
          if (!joinResult?.success) {
            setStatusMessage(t('snap.live_chat_disconnected', language()));
            return;
          }

          const initialMessages = Array.isArray(joinResult.messages)
            ? joinResult.messages.map((entry) => normalizeLiveMessage(entry)).filter((entry): entry is SnapLiveSocketMessage => Boolean(entry))
            : [];
          setLiveMessages(initialMessages.slice(-20));

          const nextViewers = Number(joinResult.viewers ?? -1);
          updateLiveViewerCount(Number(live.id), nextViewers);

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
          setStatusMessage(t('snap.live_chat_disconnected', language()));
        },
      });

      const joinResult = await joinSnapLiveRoom(String(live.id));
      if (!joinResult?.success) {
        setStatusMessage(t('snap.live_chat_open_failed', language()));
        disconnectSnapLiveSocket();
        setActiveLive(null);
        return;
      }

      const initialViewers = Number(joinResult.viewers ?? -1);
      updateLiveViewerCount(Number(live.id), initialViewers);

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
      setStatusMessage(t('snap.live_connect_failed', language()));
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

    clearFloatingTimers();

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
      setStatusMessage(t('snap.live_start_failed', language()));
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
      setStatusMessage(t('snap.live_muted', language()));
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
      pushLiveMessage(safeMessage);
      setLiveMessageInput('');
      return;
    }
    const response = await sendSnapLiveMessage(String(stream.id), content);
    if (response?.error === 'MUTED') {
      setViewerMuted(true);
      setStatusMessage(t('snap.live_muted', language()));
      return;
    }

    if (response?.success) {
      setLiveMessageInput('');
      return;
    }

    setStatusMessage(t('snap.send_message_failed', language()));
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
      pushLiveReaction(payload);
      return;
    }
    const response = await sendSnapLiveReaction(String(stream.id), reaction);
    if (response?.success) return;
    setStatusMessage(t('snap.send_reaction_failed', language()));
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
    setStatusMessage(t('snap.delete_message_failed', language()));
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
    setStatusMessage(t('snap.mute_user_failed', language()));
  };

  const openStory = (index: number) => {
    setActiveStoryIndex(index);
  };

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
        pushLiveMessage(safeMessage);
      },
      onReaction: (entry) => {
        const payload: SnapLiveReaction = {
          id: entry.id,
          liveId: String(stream.id),
          username: entry.user,
          reaction: entry.reaction,
          createdAt: entry.createdAt,
        };
        pushLiveReaction(payload);
      },
    });

    onCleanup(() => {
      stopSnapMockFeed?.();
      stopSnapMockFeed = undefined;
    });
  });

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
        setStatusMessage(t('snap.avatar_from_gallery', language()));
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
    <AppScaffold title="Snap" subtitle={t('snap.subtitle', language())} onBack={() => router.goBack()} bodyClass={styles.body}>
      <div class={styles.snapApp}>
        <div class={styles.socialPanel}>
          <div class={styles.socialMeta}>
            <strong>{myAccount()?.display_name || myAccount()?.username || t('chirp.profile', language())}</strong>
            <span>
              {pendingRequests().length} {t('snap.pending', language())} · {sentRequests().length} {t('snap.sent', language())}
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
                {t('snap.discover', language())}
              </button>
              <button
                class={styles.tabButton}
                classList={{ [styles.activeTabBtn]: activeTab() === 'feed' }}
                onClick={() => setActiveTab('feed')}
              >
                <span class={styles.tabIcon}><img src="./img/icons_ios/ui-grid.svg" alt="" draggable={false} /></span>
                {t('snap.feed', language())}
              </button>
              <button
                class={styles.tabButton}
                classList={{ [styles.activeTabBtn]: activeTab() === 'profile' }}
                onClick={() => setActiveTab('profile')}
              >
                <span class={styles.tabIcon}><img src="./img/icons_ios/ui-user.svg" alt="" draggable={false} /></span>
                {t('chirp.profile', language())}
              </button>
            </div>
            <button
              class={styles.notifyBtn}
              onClick={() => {
                setShowRequestsModal(true);
                void refreshFollowRequests();
              }}
              aria-label={t('chirp.requests', language())}
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
                  <span class={styles.storyName}>{t('snap.your_story', language())}</span>
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
                      <span class={styles.storyName}>{story.display_name || story.username || t('chirp.user', language())}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>

            <Show when={liveStreams().length > 0}>
              <div class={styles.liveSection}>
                <h4 class={styles.sectionTitle}>{t('snap.live', language())}</h4>
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
                        <span class={styles.liveViewers}>{live.live_viewers || 0} {t('snap.watching', language())}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <div class={styles.postsSection}>
              <h4 class={styles.sectionTitle}>{t('snap.posts', language())}</h4>
              <div class={styles.postsGrid}>
                <For each={posts()}>
                  {(post) => (
                    <div
                      class={styles.postCard}
                      onClick={() => post.media_url && setViewerUrl(post.media_url)}
                      onContextMenu={(e: MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowActionSheet(true);
                      }}
                    >
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

                          <button class={styles.actionBtn} onClick={(e) => { e.stopPropagation(); setSharePayload({ text: `SNAP:${post.id}` }); }}>
                            <span><img src="./img/icons_ios/ui-plane.svg" alt="" draggable={false} /></span>
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
                <EmptyState class={styles.emptyState} title={t('snap.empty_posts_title', language())} description={t('snap.empty_posts_desc', language())} />
              </Show>
            </div>
          </>
        </Show>

        <Show when={activeTab() === 'discover'}>
          <div class={styles.discoverSection}>
            <h4 class={styles.sectionTitle}>{t('snap.discover', language())}</h4>
            <SearchInput
              value={discoverQuery()}
              onInput={(value) => setDiscoverQuery(sanitizeText(value, 60))}
              placeholder={t('snap.search_placeholder', language())}
              class={styles.discoverSearchRoot}
              inputClass={styles.discoverSearch}
            />

            <Show when={!discoverLoading()} fallback={<p class={styles.discoverHint}>{t('snap.loading_discover', language())}</p>}>
              <Show when={discoverRows().length > 0} fallback={<p class={styles.discoverHint}>{t('snap.no_discover_posts', language())}</p>}>
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
                          <strong>{post.display_name || post.username || t('chirp.user', language())}</strong>
                          <span>@{post.username || 'user'}</span>
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
                              ? t('snap.following', language())
                              : requestedByMe
                                ? t('action.cancel', language())
                                : Number(post.is_private || 0) === 1
                                  ? t('snap.request_follow', language())
                                  : t('snap.follow', language())}
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
                    {discoverLoadingMore() ? t('state.loading', language()) : t('snap.load_more', language())}
                  </button>
                </Show>
              </Show>
            </Show>
          </div>
        </Show>

        <Show when={activeTab() === 'profile'}>
          <div class={styles.profileTab}>
            <h4 class={styles.sectionTitle}>{t('chirp.profile', language())}</h4>

            <div class={styles.profileHelper}>
              {t('snap.profile_hint', language())}
            </div>

            <FormField
              label={t('chirp.visible_name', language())}
              value={profileDisplayName()}
              onChange={(value) => setProfileDisplayName(sanitizeText(value, 50))}
              placeholder={t('chirp.your_name', language())}
              disabled
            />

            <label class={styles.privacyRow}>
              <input
                type="checkbox"
                checked={profilePrivate()}
                onChange={(e) => setProfilePrivate(e.currentTarget.checked)}
              />
              <span>{t('chirp.private', language())}</span>
            </label>

            <div class={styles.profileSaveRow}>
              <button class={styles.acceptBtn} onClick={() => void saveProfile()}>
                {t('news.save_profile', language())}
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
          tooltip={t('snap.create', language())}
          tooltipVisible={fabTooltipVisible()}
          onPointerDown={showFabTooltip}
          onPointerUp={hideFabTooltip}
          onPointerLeave={hideFabTooltip}
        />
      </Show>

      {/* Action Sheet */}
      <ActionSheet
        open={showActionSheet()}
        title={t('snap.create', language())}
        onClose={() => setShowActionSheet(false)}
        actions={[
          { label: t('chirp.camera', language()), tone: 'primary', onClick: openCamera },
          { label: t('chirp.gallery', language()), tone: 'primary', onClick: () => { setShowActionSheet(false); setShowCreatePost(true); } },
          { label: t('snap.upload_story', language()), onClick: () => { setPostMode('story'); setShowActionSheet(false); setShowCreatePost(true); } },
          { label: t('snap.start_live', language()), onClick: () => void startLive() },
          { label: t('snap.mock_live', language()), onClick: () => void startMockLive() },
        ]}
      />

      {/* Create Post Modal */}
      <SnapCreatePostModal
        open={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        media={postMedia}
        setMedia={setPostMedia}
        mode={postMode}
        setMode={setPostMode}
        loading={loading}
        myAccount={myAccount}
        language={language}
        router={router}
        cache={cache}
        onPublished={() => void loadData()}
        onStatusMessage={setStatusMessage}
      />

      {/* Story Viewer */}
      <SnapStoryViewerOverlay
        stories={stories}
        activeIndex={activeStoryIndex}
        setActiveIndex={setActiveStoryIndex}
        language={language}
      />

      {/* Live Viewer */}
      <Show when={activeLive()}>
        <div class={styles.liveViewer}>
          <div class={styles.liveTopBar}>
            <button class={styles.liveUtilityButton} onClick={() => void closeLiveViewer()}><img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} /></button>
            <div class={styles.liveOwnerInfo}>
              <strong>{activeLive()?.display_name || activeLive()?.username || 'Live'}</strong>
              <span>
                {isMockLive() ? t('snap.mock_live', language()).toUpperCase() : (liveConnected() ? t('snap.live_on_air', language()) : t('snap.live_connecting', language()))}
              </span>
            </div>
            <div class={styles.liveTopBarRight}>
              <span class={styles.liveViewerCount}>{Math.max(Number(activeLive()?.live_viewers || 0), isLiveOwner() ? 1 : 0)} {t('snap.live_viewers_count', language())}</span>
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
                    {!liveAudioTargetOnline() ? t('snap.no_broadcaster', language()) : (liveAudioNear() ? t('snap.audio_near', language()) : t('snap.out_of_range', language()))}
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
                buttonTitle={t('snap.flashlight', language())}
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
                  {isMockLive() ? t('snap.mock_preview', language()) : (liveConnected() ? t('snap.waiting_video', language()) : t('snap.connecting_video', language()))}
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
                  <strong>{t('snap.live_chat', language())}</strong>
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
                  <div class={styles.liveMutedBanner}>{t('snap.live_muted', language())}</div>
                </Show>

                <Show
                  when={!isLiveOwner()}
                  fallback={<div class={styles.liveHostHint}>{t('snap.host_hint', language())}</div>}
                >
                  <div class={styles.liveChatInputRow}>
                    <EmojiPickerButton value={liveMessageInput()} onChange={setLiveMessageInput} maxLength={300} />
                    <input
                      value={liveMessageInput()}
                      onInput={(e) => setLiveMessageInput(sanitizeText(e.currentTarget.value, 300))}
                      onKeyDown={(e) => e.key === 'Enter' && void sendLiveMessage()}
                      placeholder={t('snap.write_live', language())}
                      disabled={viewerMuted()}
                    />
                    <button onClick={() => void sendLiveMessage()} disabled={viewerMuted() || !liveMessageInput().trim()}>
                      {t('mail.send', language())}
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

      <SnapRequestsModal
        open={showRequestsModal}
        onClose={() => setShowRequestsModal(false)}
        pendingRequests={pendingRequests}
        sentRequests={sentRequests}
        requestsLoading={requestsLoading}
        language={language}
        onRespond={respondFollowRequest}
        onCancel={cancelSentRequest}
      />

      <Modal
        open={deletePostId() !== null}
        title={t('snap.delete_post', language())}
        onClose={() => setDeletePostId(null)}
        size="sm"
      >
        <p>{t('snap.delete_confirm', language())}</p>
        <ModalActions>
          <ModalButton label={t('action.cancel', language())} onClick={() => setDeletePostId(null)} />
          <ModalButton label={t('action.delete', language())} tone="danger" onClick={() => void confirmDeletePost()} />
        </ModalActions>
      </Modal>

      <MediaLightbox url={viewerUrl()} onClose={() => setViewerUrl(null)} />

      <ShareSheet
        open={sharePayload() !== null}
        payload={sharePayload() || { text: '' }}
        destinations={['messages']}
        onClose={() => setSharePayload(null)}
      />
    </AppScaffold>
  );
}
