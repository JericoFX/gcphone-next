import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { useInternalEvent } from '../../../utils/internalEvents';
import { resolveMediaType, sanitizeMediaUrl, sanitizeText } from '../../../utils/sanitize';
import { useNuiEvent } from '../../../utils/useNui';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { connectPeer, handlePeerSignal, registerPeerSession } from '../../../utils/peerManager';
import { useLiveCamera } from '../../../hooks/useLiveCamera';
import { startMockLiveFeed } from '../../../utils/liveMock';
import {
  disconnectSnapLive,
  deleteSnapLiveMessage,
  joinSnapLiveRoom,
  leaveSnapLiveRoom,
  muteSnapLiveUser,
  sendSnapLiveMessage,
  sendSnapLiveReaction,
} from '../../../utils/chatBridge';
import { AppFAB, AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { MediaLightbox } from '../../shared/ui/MediaLightbox';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { SocialOnboardingModal, type SocialOnboardingPayload } from '../../shared/ui/SocialOnboardingModal';
import { ShareSheet, type SharePayload } from '../../shared/ui/ShareSheet';
import { useLiveFlashlight } from '../../../hooks/useLiveFlashlight';
import { getStoredLanguage, t } from '../../../i18n';
import { SnapStoryViewerOverlay } from './SnapStoryViewer';
import { SnapCreatePostModal } from './SnapCreatePostModal';
import { SnapRequestsModal } from './SnapRequestsModal';
import { SnapFeedTab } from './SnapFeedTab';
import { SnapDiscoverTab } from './SnapDiscoverTab';
import { SnapProfileTab } from './SnapProfileTab';
import { SnapLiveViewerOverlay } from './SnapLiveViewerOverlay';
import type {
  SnapPost, SnapStory, SnapLive, SnapLiveSocketMessage, SnapLiveReaction,
  SnapFollowRequest, SnapDiscoverPost,
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
  let liveVideoHost: HTMLDivElement | undefined;
  let stopSnapMockFeed: (() => void) | undefined;
  const liveCam = useLiveCamera({ maxSeconds: 1800 });
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

  const renderLiveStage = () => {
    const host = liveVideoHost;
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    host.classList.remove(styles.liveVideoHostReady);
    setLiveVideoReady(false);

    const localId = liveCam.localIdentity();
    const allTracks = liveCam.getAllTracks();

    // Find preferred identity: remote video first, then local, then any
    let preferredId = '';
    const entries = Array.from(allTracks.entries());
    if (entries.length === 0) return;

    const remoteVideo = entries.find(([identity, tracks]) => identity !== localId && tracks.some((t) => t.kind === 'video'));
    if (remoteVideo) {
      preferredId = remoteVideo[0];
    } else {
      const localVideo = entries.find(([identity, tracks]) => identity === localId && tracks.some((t) => t.kind === 'video'));
      if (localVideo) {
        preferredId = localVideo[0];
      } else {
        const remoteAny = entries.find(([identity]) => identity !== localId);
        preferredId = remoteAny ? remoteAny[0] : entries[0][0];
      }
    }
    if (!preferredId) return;

    const preferredTracks = liveCam.getTracksFor(preferredId);
    const videoTrack = preferredTracks.find((e) => e.kind === 'video');
    if (videoTrack) {
      videoTrack.element.className = styles.liveVideoElement;
      videoTrack.element.muted = preferredId === localId;
      host.appendChild(videoTrack.element);
      host.classList.add(styles.liveVideoHostReady);
      setLiveVideoReady(true);
    }

    for (const [identity, tracks] of allTracks) {
      for (const track of tracks) {
        if (track.kind !== 'audio') continue;
        track.element.className = styles.liveAudioElement;
        track.element.muted = identity === localId;
        host.appendChild(track.element);
      }
    }
  };

  const setLiveVideoStageHost = (element: HTMLDivElement | undefined) => {
    liveVideoHost = element;
    renderLiveStage();
  };

  // FAB Tooltip
  let fabTimeout: number | undefined;
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

  useNuiEvent<{ sessionId: string }>('gcphone:snap:livePeerConnected', (payload) => {
    if (!payload?.sessionId || !activeLive()) return;
    const live = activeLive();
    if (!live) return;
    void connectPeer(payload.sessionId, `snaplive-${live.id}`);
  });

  useNuiEvent<{ type: string; data: string; fromPeerId: string; channel: string }>('webrtcSignal', (signal) => {
    if (!signal?.type || !signal?.fromPeerId) return;
    void handlePeerSignal(signal as Parameters<typeof handlePeerSignal>[0]);
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
      /* audio via Mumble */
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
      /* audio via Mumble */
      return;
    }

    if (payload?.targetOnline === false) {
      setStatusMessage(t('snap.live_no_broadcaster', language()));
      /* audio via Mumble */
      return;
    }

    if (payload?.listening === false) {
      setStatusMessage(t('snap.live_approach', language()));
      /* audio via Mumble */
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
      /* audio via Mumble */
      return;
    }
    const volume = Number(payload?.volume);
    if (!Number.isFinite(volume)) return;
    /* audio volume via Mumble */
  });

  useNuiEvent<SnapLiveProximityDisabled>('gcphone:snap:proximityDisabled', (payload) => {
    const live = activeLive();
    if (!live) return;
    if (Number(payload?.liveId) !== Number(live.id)) return;

    resetLiveAudioState();
    /* audio via Mumble */

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

  let lastNfcRouteKey = '';
  createEffect(() => {
    const params = router.params() as { nfcAction?: string; requestId?: number; storyIndex?: number | string; mediaUrl?: string; from?: string };
    if (params.nfcAction !== 'received_snap') return;
    const key = `${params.requestId || 0}:${params.storyIndex || ''}:${params.mediaUrl || ''}`;
    if (key === lastNfcRouteKey) return;

    lastNfcRouteKey = key;
    setActiveTab('feed');
    const index = Number(params.storyIndex ?? 0);
    if (Number.isFinite(index) && stories()[index]) {
      setActiveStoryIndex(index);
    } else {
      const mediaUrl = sanitizeMediaUrl(typeof params.mediaUrl === 'string' ? params.mediaUrl : '');
      if (mediaUrl) setViewerUrl(mediaUrl);
    }
    setStatusMessage(`${params.from || 'NFC'} compartio este snap`);
  });

  onCleanup(() => {
    if (fabTimeout) window.clearTimeout(fabTimeout);
    clearFloatingTimers();
    reactionTimers.forEach((t) => window.clearTimeout(t));
    reactionTimers = [];
    if (liveAudioRetryTimer) {
      window.clearTimeout(liveAudioRetryTimer);
      liveAudioRetryTimer = undefined;
    }
    void stopLiveAudioProximity();
    if (liveAudioWatchdogTimer) {
      window.clearInterval(liveAudioWatchdogTimer);
      liveAudioWatchdogTimer = undefined;
    }
  });

  useInternalEvent<{ route: string }>('phone:appForceClose', (detail) => {
    if (detail?.route === 'snap' && activeLive()) {
      void closeLiveViewer();
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
      /* audio via Mumble */
      /* audio via Mumble */
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
    /* audio via Mumble */

    if (owner || liveId < 1) {
      /* audio volume via Mumble */
      return;
    }

    const payload = await fetchNui<SnapLiveAudioStartResponse>('snapLiveAudioStart', { liveId }, { success: false, enabled: false });
    if (!payload?.success || !payload?.enabled) {
      /* audio via Mumble */
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
      /* audio via Mumble */
      return;
    }

    const status = await fetchNui<SnapLiveAudioStatusResponse>('snapLiveAudioStatus', {}, { active: false, activeListen: false, currentVolume: 1 });
    if (!status?.active) {
      /* audio volume via Mumble */
      return;
    }

    if (status.activeListen !== true) {
      /* audio via Mumble */
      return;
    }

    const currentVolume = Number(status.currentVolume);
    if (Number.isFinite(currentVolume)) {
      /* audio volume via Mumble */
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
    /* audio via Mumble */
    /* audio via Mumble */
    await fetchNui('snapLiveAudioStop', {}, { success: true });
  };

  const openLiveViewer = async (live: SnapLive) => {
    const owner = !!(myAccount()?.username && live.username && myAccount()?.username === live.username);
    if (owner) {
      await fetchNui('startLiveSession', {}, true);
    } else {
      await fetchNui('phoneSetVisualMode', { mode: 'live' }, true);
    }
    setStatusMessage('');
    liveCam.stopCamera();
    setLiveVideoReady(false);
    setLiveLocalIdentity('');
    if (liveVideoHost) {
      while (liveVideoHost.firstChild) liveVideoHost.removeChild(liveVideoHost.firstChild);
      liveVideoHost.classList.remove(styles.liveVideoHostReady);
    }
    setActiveLive(live);
    setLiveChatOpen(false);
    setLiveMessages([]);
    setLiveFloating([]);
    setLiveReactions([]);
    setMutedUsers([]);
    setViewerMuted(false);
    /* audio priority via Mumble */
    setLiveAudioNear(false);
    setLiveAudioTargetOnline(true);
    setLiveAudioDistanceMeters(-1);

    if (Number(live.id) < 0) {
      setLiveConnected(true);
      return;
    }

    try {
      console.log('[snap:live] Joining live chat room...');
      const joinResult = await joinSnapLiveRoom(live.id);
      console.log('[snap:live] Join result:', JSON.stringify(joinResult));
      if (!joinResult?.success) {
        console.warn('[snap:live] FAILED at join chat step');
        setStatusMessage(t('snap.live_chat_open_failed', language()));
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

      console.log('[snap:live] Initializing WebRTC session...');
      if (owner) {
        await liveCam.startCamera();
      }

      const mySessionId = await liveCam.initViewer({
        onRemoteStream: (remotePeerId, stream) => {
          const video = stream.getVideoTracks()[0];
          if (video) {
            const el = document.createElement('video');
            el.srcObject = new MediaStream([video]);
            el.autoplay = true;
            el.playsInline = true;
            liveCam.addTrack(remotePeerId, { sid: video.id, kind: 'video', element: el });
            renderLiveStage();
          }
        },
        onRemoteDisconnected: (remotePeerId) => {
          liveCam.removeTrack(remotePeerId);
          renderLiveStage();
        },
        onTimeout: () => {
          void closeLiveViewer();
        },
      });

      console.log('[snap:live] Session initialized:', mySessionId);
      setLiveLocalIdentity(mySessionId);

      if (owner) {
        try {
          await liveCam.publishVideo();

          const previewEl = liveCam.createPreviewElement();
          if (previewEl) {
            liveCam.addTrack(mySessionId, { sid: 'local-preview', kind: 'video', element: previewEl });
            renderLiveStage();
          }
        } catch (e) {
          console.warn('[snap:live] Failed to publish game view:', e);
        }
        await liveCam.enableMic();
      }

      const channel = `snaplive-${live.id}`;
      console.log('[snap:live] Registering session:', mySessionId, 'channel:', channel);
      await registerPeerSession(channel);
      console.log('[snap:live] Sending snapLivePeerReady, owner:', owner);
      await fetchNui('snapLivePeerReady', { liveId: live.id, sessionId: mySessionId, owner }, true);
      console.log('[snap:live] Peer ready sent, setting connected');

      setLiveConnected(true);
      await startLiveAudioProximity(Number(live.id), owner);
    } catch (_err) {
      console.error('[snap:live] WebRTC EXCEPTION:', _err);
      liveCam.stopCamera();
      setLiveVideoReady(false);
      setLiveLocalIdentity('');
      if (liveVideoHost) {
        while (liveVideoHost.firstChild) liveVideoHost.removeChild(liveVideoHost.firstChild);
        liveVideoHost.classList.remove(styles.liveVideoHostReady);
      }
      disconnectSnapLive();
      await stopLiveAudioProximity();
      setStatusMessage(t('snap.live_connect_failed', language()));
      setTimeout(() => setActiveLive(null), 3000);
    }
  };

  const closeLiveViewer = async () => {
    const wasOwner = isLiveOwner();
    if (wasOwner) {
      await fetchNui('stopLiveSession', {}, true);
    } else {
      await fetchNui('phoneSetVisualMode', { mode: 'text' }, true);
    }
    liveFlashlight.setPanelOpen(false);
    await liveFlashlight.turnOff();

    const stream = activeLive();
    const isMock = !!stream && Number(stream.id) < 0;
    if (stream) {
      if (!isMock) {
        leaveSnapLiveRoom(stream.id);
      }
      if (!isMock && wasOwner) {
        await fetchNui('snapEndLive', stream.id);
      }
    }

    stopSnapMockFeed?.();
    stopSnapMockFeed = undefined;

    clearFloatingTimers();

    await stopLiveAudioProximity();
    disconnectSnapLive();
    liveCam.stopCamera();
    setLiveVideoReady(false);
    setLiveLocalIdentity('');
    if (liveVideoHost) {
      while (liveVideoHost.firstChild) liveVideoHost.removeChild(liveVideoHost.firstChild);
      liveVideoHost.classList.remove(styles.liveVideoHostReady);
    }
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
    /* audio via Mumble */
    if (isMock) {
      setLiveStreams((prev) => prev.filter((entry) => Number(entry.id) >= 0));
      return;
    }
    await loadData();
  };

  const startLive = async () => {
    setShowActionSheet(false);
    console.log('[snap:live] Starting live...');
    const result = await fetchNui<LiveStartResponse>('snapStartLive', {});
    console.log('[snap:live] snapStartLive result:', JSON.stringify(result));
    if (!result?.success || !result.payload?.postId) {
      console.warn('[snap:live] FAILED: no success or no postId');
      setStatusMessage(t('snap.live_start_failed', language()));
      return;
    }

    const postId = result.payload.postId;
    console.log('[snap:live] Post created, postId:', postId);
    const stream: SnapLive = {
      id: postId,
      username: myAccount()?.username,
      display_name: myAccount()?.display_name,
      avatar: myAccount()?.avatar,
      live_viewers: 0,
    };
    setLiveStreaming(true);
    await openLiveViewer(stream);

    if (!activeLive()) {
      console.warn('[snap:live] openLiveViewer failed, cleaning up postId:', postId);
      setLiveStreaming(false);
      await fetchNui('snapEndLive', postId);
    }
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
    const response = await sendSnapLiveMessage(String(stream.id), content) as { success?: boolean; error?: string } | null;
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
    const response = await sendSnapLiveReaction(String(stream.id), reaction) as { success?: boolean } | null;
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
    const response = await deleteSnapLiveMessage(String(stream.id), messageId) as { success?: boolean } | null;
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
    const response = await muteSnapLiveUser(String(stream.id), username) as { success?: boolean } | null;
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
          <SnapFeedTab
            language={language}
            stories={stories}
            liveStreams={liveStreams}
            posts={posts}
            loading={loading}
            onOpenStory={openStory}
            onOpenLiveViewer={openLiveViewer}
            onShowActionSheet={() => setShowActionSheet(true)}
            onViewMedia={(url) => setViewerUrl(url)}
            onToggleLike={toggleLike}
            onDeletePost={deletePost}
            onSharePost={(postId) => setSharePayload({
              appId: 'snap',
              route: 'snap',
              title: 'Snap NFC',
              message: 'Te compartieron un snap',
              text: `SNAP:${postId}`,
            })}
          />
        </Show>

        <Show when={activeTab() === 'discover'}>
          <SnapDiscoverTab
            language={language}
            discoverQuery={discoverQuery}
            setDiscoverQuery={setDiscoverQuery}
            discoverLoading={discoverLoading}
            discoverRows={discoverRows}
            discoverHasMore={discoverHasMore}
            discoverLoadingMore={discoverLoadingMore}
            onViewMedia={(url) => setViewerUrl(url)}
            onFollowAccount={followAccountFromDiscover}
            onLoadMore={loadMoreDiscover}
          />
        </Show>

        <Show when={activeTab() === 'profile'}>
          <SnapProfileTab
            language={language}
            profileDisplayName={profileDisplayName}
            setProfileDisplayName={setProfileDisplayName}
            profilePrivate={profilePrivate}
            setProfilePrivate={setProfilePrivate}
            onSaveProfile={saveProfile}
          />
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

      {/* Live Viewer — Instagram Live style */}
      <Show when={activeLive()}>
        <SnapLiveViewerOverlay
          language={language}
          activeLive={activeLive}
          liveConnected={liveConnected}
          liveVideoReady={liveVideoReady}
          isMockLive={isMockLive}
          isLiveOwner={isLiveOwner}
          myAccount={myAccount}
          liveMessages={liveMessages}
          liveReactions={liveReactions}
          liveMessageInput={liveMessageInput}
          setLiveMessageInput={setLiveMessageInput}
          viewerMuted={viewerMuted}
          liveAudioProximityEnabled={liveAudioProximityEnabled}
          liveAudioNear={liveAudioNear}
          liveAudioTargetOnline={liveAudioTargetOnline}
          liveAudioDistanceMeters={liveAudioDistanceMeters}
          liveFlashlight={liveFlashlight}
          setLiveVideoStageHost={setLiveVideoStageHost}
          onClose={closeLiveViewer}
          onSendMessage={sendLiveMessage}
          onSendReaction={sendReaction}
          onRemoveMessage={removeLiveMessage}
        />
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
        destinations={['messages', 'nfc']}
        onClose={() => setSharePayload(null)}
      />
    </AppScaffold>
  );
}
