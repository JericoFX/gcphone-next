/**
 * Audio playback system based on xsound by Xogy
 * https://github.com/Xogy/xsound
 * MIT License - Copyright (c) 2020 Xogy
 * 
 * Adapted for gcphone-next with TypeScript and SolidJS integration
 */

export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  youtubeId?: string;
  previewUrl?: string;
}

export interface AudioState {
  playing: boolean;
  paused: boolean;
  loading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  volume: number;
}

type AudioEventType = 'play' | 'pause' | 'end' | 'timeupdate' | 'loading' | 'error' | 'ready';
type AudioEventCallback = (data?: any) => void;

let youtubeAPIReady = false;
let youtubeAPIPromise: Promise<void> | null = null;

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function loadYouTubeAPI(): Promise<void> {
  if (youtubeAPIReady) return Promise.resolve();
  if (youtubeAPIPromise) return youtubeAPIPromise;

  youtubeAPIPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      youtubeAPIReady = true;
      resolve();
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      youtubeAPIReady = true;
      resolve();
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  });

  return youtubeAPIPromise;
}

export function getYoutubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function isYoutubeUrl(url: string): boolean {
  return getYoutubeId(url) !== null;
}

export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private events: Map<AudioEventType, Set<AudioEventCallback>> = new Map();
  private _volume: number = 0.15;
  private _src: string = '';
  private _loading: boolean = false;

  constructor() {
    this.audio = new HTMLAudioElement();
    this.setupAudioEvents();
  }

  private setupAudioEvents() {
    if (!this.audio) return;

    this.audio.addEventListener('play', () => this.emit('play'));
    this.audio.addEventListener('pause', () => this.emit('pause'));
    this.audio.addEventListener('ended', () => this.emit('end'));
    this.audio.addEventListener('timeupdate', () => {
      this.emit('timeupdate', { currentTime: this.audio?.currentTime || 0 });
    });
    this.audio.addEventListener('loadedmetadata', () => {
      this._loading = false;
      this.emit('ready', { duration: this.audio?.duration || 0 });
    });
    this.audio.addEventListener('error', (e) => {
      this._loading = false;
      this.emit('error', { error: 'Audio load error' });
    });
    this.audio.addEventListener('loadstart', () => {
      this._loading = true;
      this.emit('loading');
    });
  }

  on(event: AudioEventType, callback: AudioEventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  off(event: AudioEventType, callback: AudioEventCallback) {
    this.events.get(event)?.delete(callback);
  }

  private emit(event: AudioEventType, data?: any) {
    this.events.get(event)?.forEach(cb => cb(data));
  }

  async load(src: string): Promise<void> {
    if (!this.audio) return;
    
    this._src = src;
    this._loading = true;
    this.emit('loading');
    
    this.audio.src = src;
    this.audio.volume = this._volume;
    this.audio.load();
  }

  async play(): Promise<void> {
    if (!this.audio) return;
    try {
      await this.audio.play();
    } catch (e) {
      this.emit('error', { error: 'Play failed' });
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  stop(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  seek(time: number): void {
    if (!this.audio || !isFinite(time)) return;
    this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration || 0));
  }

  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this.audio) {
      this.audio.volume = this._volume;
    }
  }

  getVolume(): number {
    return this._volume;
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false;
  }

  isLoading(): boolean {
    return this._loading;
  }

  destroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.events.clear();
  }
}

export class YouTubePlayer {
  private player: any = null;
  private containerId: string;
  private events: Map<AudioEventType, Set<AudioEventCallback>> = new Map();
  private _volume: number = 15;
  private _ready: boolean = false;
  private _pendingSeek: number | null = null;
  private _pendingPlay: boolean = false;
  private static containerCounter: number = 0;

  constructor() {
    YouTubePlayer.containerCounter++;
    this.containerId = `yt-player-${YouTubePlayer.containerCounter}`;
  }

  private createContainer(): HTMLElement {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;';
      document.body.appendChild(container);
    }
    return container;
  }

  on(event: AudioEventType, callback: AudioEventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  off(event: AudioEventType, callback: AudioEventCallback) {
    this.events.get(event)?.delete(callback);
  }

  private emit(event: AudioEventType, data?: any) {
    this.events.get(event)?.forEach(cb => cb(data));
  }

  async load(videoId: string): Promise<void> {
    await loadYouTubeAPI();
    
    if (this.player) {
      this.destroy();
    }

    const container = this.createContainer();
    this._ready = false;
    this.emit('loading');

    return new Promise((resolve, reject) => {
      this.player = new window.YT.Player(this.containerId, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            this._ready = true;
            this.player.setVolume(this._volume);
            this.emit('ready', { duration: this.getDuration() });
            
            if (this._pendingSeek !== null) {
              this.seek(this._pendingSeek);
              this._pendingSeek = null;
            }
            if (this._pendingPlay) {
              this.play();
              this._pendingPlay = false;
            }
            resolve();
          },
          onStateChange: (event: any) => {
            switch (event.data) {
              case window.YT.PlayerState.PLAYING:
                this.emit('play');
                break;
              case window.YT.PlayerState.PAUSED:
                this.emit('pause');
                break;
              case window.YT.PlayerState.ENDED:
                this.emit('end');
                break;
            }
          },
          onError: (event: any) => {
            this.emit('error', { error: `YouTube error: ${event.data}` });
            reject(new Error(`YouTube error: ${event.data}`));
          },
        },
      });
    });
  }

  async play(): Promise<void> {
    if (!this._ready) {
      this._pendingPlay = true;
      return;
    }
    if (this.player && typeof this.player.playVideo === 'function') {
      this.player.playVideo();
    }
  }

  pause(): void {
    if (this._ready && this.player && typeof this.player.pauseVideo === 'function') {
      this.player.pauseVideo();
    }
  }

  stop(): void {
    if (this._ready && this.player) {
      if (typeof this.player.pauseVideo === 'function') {
        this.player.pauseVideo();
      }
      if (typeof this.player.seekTo === 'function') {
        this.player.seekTo(0, true);
      }
    }
  }

  seek(time: number): void {
    if (!this._ready) {
      this._pendingSeek = time;
      return;
    }
    if (this.player && typeof this.player.seekTo === 'function') {
      this.player.seekTo(time, true);
    }
  }

  setVolume(vol: number): void {
    this._volume = Math.round(Math.max(0, Math.min(1, vol)) * 100);
    if (this._ready && this.player && typeof this.player.setVolume === 'function') {
      this.player.setVolume(this._volume);
    }
  }

  getVolume(): number {
    return this._volume / 100;
  }

  getCurrentTime(): number {
    if (this._ready && this.player && typeof this.player.getCurrentTime === 'function') {
      return this.player.getCurrentTime();
    }
    return 0;
  }

  getDuration(): number {
    if (this._ready && this.player && typeof this.player.getDuration === 'function') {
      return this.player.getDuration();
    }
    return 0;
  }

  isPlaying(): boolean {
    if (this._ready && this.player && typeof this.player.getPlayerState === 'function') {
      return this.player.getPlayerState() === window.YT.PlayerState.PLAYING;
    }
    return false;
  }

  isReady(): boolean {
    return this._ready;
  }

  destroy(): void {
    if (this.player) {
      if (typeof this.player.stopVideo === 'function') {
        this.player.stopVideo();
      }
      if (typeof this.player.destroy === 'function') {
        this.player.destroy();
      }
      this.player = null;
    }
    const container = document.getElementById(this.containerId);
    if (container) {
      container.remove();
    }
    this._ready = false;
    this.events.clear();
  }
}

export class UnifiedAudioPlayer {
  private youtubePlayer: YouTubePlayer | null = null;
  private audioPlayer: AudioPlayer | null = null;
  private events: Map<AudioEventType, Set<AudioEventCallback>> = new Map();
  private currentType: 'youtube' | 'audio' | null = null;
  private _volume: number = 0.15;
  private timeUpdateInterval: number | null = null;

  on(event: AudioEventType, callback: AudioEventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: AudioEventType, callback: AudioEventCallback) {
    this.events.get(event)?.delete(callback);
  }

  private emit(event: AudioEventType, data?: any) {
    this.events.get(event)?.forEach(cb => cb(data));
  }

  private forwardEvents(player: YouTubePlayer | AudioPlayer) {
    const eventTypes: AudioEventType[] = ['play', 'pause', 'end', 'loading', 'error', 'ready'];
    eventTypes.forEach(type => {
      player.on(type, (data) => this.emit(type, data));
    });
  }

  private startTimeUpdate() {
    this.stopTimeUpdate();
    this.timeUpdateInterval = window.setInterval(() => {
      const currentTime = this.getCurrentTime();
      this.emit('timeupdate', { currentTime });
    }, 250);
  }

  private stopTimeUpdate() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  async load(src: string): Promise<void> {
    this.destroy();

    const youtubeId = getYoutubeId(src);
    
    if (youtubeId) {
      this.currentType = 'youtube';
      this.youtubePlayer = new YouTubePlayer();
      this.forwardEvents(this.youtubePlayer);
      await this.youtubePlayer.load(youtubeId);
      this.youtubePlayer.setVolume(this._volume);
    } else {
      this.currentType = 'audio';
      this.audioPlayer = new AudioPlayer();
      this.forwardEvents(this.audioPlayer);
      this.audioPlayer.setVolume(this._volume);
      await this.audioPlayer.load(src);
    }
  }

  async play(): Promise<void> {
    this.startTimeUpdate();
    if (this.currentType === 'youtube' && this.youtubePlayer) {
      await this.youtubePlayer.play();
    } else if (this.currentType === 'audio' && this.audioPlayer) {
      await this.audioPlayer.play();
    }
  }

  pause(): void {
    this.stopTimeUpdate();
    if (this.currentType === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.pause();
    } else if (this.currentType === 'audio' && this.audioPlayer) {
      this.audioPlayer.pause();
    }
  }

  stop(): void {
    this.stopTimeUpdate();
    if (this.currentType === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.stop();
    } else if (this.currentType === 'audio' && this.audioPlayer) {
      this.audioPlayer.stop();
    }
  }

  seek(time: number): void {
    if (this.currentType === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.seek(time);
    } else if (this.currentType === 'audio' && this.audioPlayer) {
      this.audioPlayer.seek(time);
    }
  }

  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this.currentType === 'youtube' && this.youtubePlayer) {
      this.youtubePlayer.setVolume(this._volume);
    } else if (this.currentType === 'audio' && this.audioPlayer) {
      this.audioPlayer.setVolume(this._volume);
    }
  }

  getVolume(): number {
    return this._volume;
  }

  getCurrentTime(): number {
    if (this.currentType === 'youtube' && this.youtubePlayer) {
      return this.youtubePlayer.getCurrentTime();
    } else if (this.currentType === 'audio' && this.audioPlayer) {
      return this.audioPlayer.getCurrentTime();
    }
    return 0;
  }

  getDuration(): number {
    if (this.currentType === 'youtube' && this.youtubePlayer) {
      return this.youtubePlayer.getDuration();
    } else if (this.currentType === 'audio' && this.audioPlayer) {
      return this.audioPlayer.getDuration();
    }
    return 0;
  }

  isPlaying(): boolean {
    if (this.currentType === 'youtube' && this.youtubePlayer) {
      return this.youtubePlayer.isPlaying();
    } else if (this.currentType === 'audio' && this.audioPlayer) {
      return this.audioPlayer.isPlaying();
    }
    return false;
  }

  destroy(): void {
    this.stopTimeUpdate();
    if (this.youtubePlayer) {
      this.youtubePlayer.destroy();
      this.youtubePlayer = null;
    }
    if (this.audioPlayer) {
      this.audioPlayer.destroy();
      this.audioPlayer = null;
    }
    this.currentType = null;
    this.events.clear();
  }
}

export const globalAudioPlayer = new UnifiedAudioPlayer();
