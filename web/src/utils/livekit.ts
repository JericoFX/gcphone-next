import { Room, RoomEvent, VideoPresets, Track } from 'livekit-client';

let room: Room | null = null;

export function getLiveKitRoom() {
  return room;
}

export async function connectLiveKit(url: string, token: string, handlers?: {
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
}) {
  if (room) {
    room.disconnect();
    room = null;
  }

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
      element.playsInline = true;
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
      element.playsInline = true;
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
  room.disconnect();
  room = null;
}
