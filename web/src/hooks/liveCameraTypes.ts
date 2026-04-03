export type TrackKind = 'audio' | 'video';

export interface MediaTrackEntry {
  sid: string;
  kind: TrackKind;
  element: HTMLMediaElement;
}

export interface ViewerHandlers {
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onRemoteDisconnected: (peerId: string) => void;
  onTimeout?: () => void;
}

export interface UseLiveCameraOptions {
  maxSeconds?: number;
  fps?: number;
  aspect?: number;
}
