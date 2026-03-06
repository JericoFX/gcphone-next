import { Room, RoomEvent, VideoPresets, Track } from 'livekit-client';

let room: Room | null = null;
let callTimeoutId: ReturnType<typeof setTimeout> | null = null;
let callStartTime: number | null = null;
let maxDuration: number = 0;
const remoteAudioByTrackSid = new Map<string, HTMLMediaElement>();

function clearRemoteAudioRegistry() {
  remoteAudioByTrackSid.clear();
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function registerRemoteAudio(trackSid: string, element: HTMLMediaElement) {
  if (!trackSid) return;
  remoteAudioByTrackSid.set(trackSid, element);
}

function unregisterRemoteAudio(trackSid: string) {
  if (!trackSid) return;
  remoteAudioByTrackSid.delete(trackSid);
}

export function getLiveKitRoom() {
  return room;
}

export function getCallRemainingTime(): number {
  if (!callStartTime || maxDuration <= 0) return 0;
  const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
  return Math.max(0, maxDuration - elapsed);
}

export async function connectLiveKit(url: string, token: string, maxDurationSeconds?: number, handlers?: {
  onParticipantConnected?: (identity: string) => void;
  onParticipantDisconnected?: (identity: string) => void;
  onTrackSubscribed?: (payload: {
    participantIdentity: string;
    trackSid: string;
    kind: 'audio' | 'video';
    element: HTMLMediaElement;
  }) => void;
  onTrackUnsubscribed?: (payload: {
    participantIdentity: string;
    trackSid: string;
    kind: 'audio' | 'video';
  }) => void;
  onLocalTrackPublished?: (payload: {
    participantIdentity: string;
    trackSid: string;
    kind: 'audio' | 'video';
    element: HTMLMediaElement;
  }) => void;
  onLocalTrackUnpublished?: (payload: {
    participantIdentity: string;
    trackSid: string;
    kind: 'audio' | 'video';
  }) => void;
  onCallTimeout?: () => void;
}) {
  if (room) {
    room.disconnect();
    room = null;
    clearRemoteAudioRegistry();
  }

  if (callTimeoutId) {
    clearTimeout(callTimeoutId);
    callTimeoutId = null;
  }

  callStartTime = Date.now();
  maxDuration = (maxDurationSeconds && maxDurationSeconds > 0) ? maxDurationSeconds : 300;

  room = new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
  });

  room
    .on(RoomEvent.ParticipantConnected, (participant) => {
      handlers?.onParticipantConnected?.(participant.identity);
    })
    .on(RoomEvent.ParticipantDisconnected, (participant) => {
      handlers?.onParticipantDisconnected?.(participant.identity);
    })
    .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind !== Track.Kind.Video && track.kind !== Track.Kind.Audio) return;
      const element = track.attach() as HTMLMediaElement;
      element.autoplay = true;
      if (track.kind === Track.Kind.Video) {
        (element as HTMLVideoElement).playsInline = true;
      } else {
        registerRemoteAudio(publication.trackSid, element);
      }
      handlers?.onTrackSubscribed?.({
        participantIdentity: participant.identity,
        trackSid: publication.trackSid,
        kind: track.kind === Track.Kind.Video ? 'video' : 'audio',
        element,
      });
    })
    .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (track.kind !== Track.Kind.Video && track.kind !== Track.Kind.Audio) return;
      track.detach();
      if (track.kind === Track.Kind.Audio) {
        unregisterRemoteAudio(publication.trackSid);
      }
      handlers?.onTrackUnsubscribed?.({
        participantIdentity: participant.identity,
        trackSid: publication.trackSid,
        kind: track.kind === Track.Kind.Video ? 'video' : 'audio',
      });
    })
    .on(RoomEvent.LocalTrackPublished, (publication, participant) => {
      const track = publication.track;
      if (!track) return;
      if (track.kind !== Track.Kind.Video && track.kind !== Track.Kind.Audio) return;
      const element = track.attach() as HTMLMediaElement;
      element.autoplay = true;
      if (track.kind === Track.Kind.Video) {
        (element as HTMLVideoElement).playsInline = true;
      }
      handlers?.onLocalTrackPublished?.({
        participantIdentity: participant.identity,
        trackSid: publication.trackSid,
        kind: track.kind === Track.Kind.Video ? 'video' : 'audio',
        element,
      });
    })
    .on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
      const track = publication.track;
      if (!track) return;
      if (track.kind !== Track.Kind.Video && track.kind !== Track.Kind.Audio) return;
      track.detach();
      handlers?.onLocalTrackUnpublished?.({
        participantIdentity: participant.identity,
        trackSid: publication.trackSid,
        kind: track.kind === Track.Kind.Video ? 'video' : 'audio',
      });
    });

  callTimeoutId = setTimeout(() => {
    handlers?.onCallTimeout?.();
    disconnectLiveKit();
  }, maxDuration * 1000);

  await room.connect(url, token);
  return room;
}

export async function setLiveKitCameraEnabled(enabled: boolean) {
  if (!room) return;
  await room.localParticipant.setCameraEnabled(enabled);
}

export async function setLiveKitMicrophoneEnabled(enabled: boolean) {
  if (!room) return;
  await room.localParticipant.setMicrophoneEnabled(enabled);
}

export function disconnectLiveKit() {
  if (!room) return;
  
  if (callTimeoutId) {
    clearTimeout(callTimeoutId);
    callTimeoutId = null;
  }
  
  room.disconnect();
  room = null;
  clearRemoteAudioRegistry();
  callStartTime = null;
  maxDuration = 0;
}

export function setLiveKitRemoteAudioVolume(volume: number) {
  const nextVolume = clampVolume(volume);
  remoteAudioByTrackSid.forEach((element) => {
    element.volume = nextVolume;
    element.muted = nextVolume <= 0.001;
  });
}
