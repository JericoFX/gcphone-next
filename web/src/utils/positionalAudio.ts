/**
 * Positional audio system based on xsound by Xogy
 * https://github.com/Xogy/xsound
 * MIT License - Copyright (c) 2020 Xogy
 * 
 * Calculates 3D audio volume based on distance between player and sound source
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface RemoteSound {
  id: string;
  position: Vector3;
  maxDistance: number;
  maxVolume: number;
  player: any;
  sourcePlayer: number;
}

let playerPosition: Vector3 = { x: 0, y: 0, z: 0 };
let updateInterval: number | null = null;
const remoteSounds: Map<string, RemoteSound> = new Map();

export function setPlayerPosition(pos: Vector3) {
  playerPosition = pos;
  updateAllVolumes();
}

export function getPlayerPosition(): Vector3 {
  return { ...playerPosition };
}

export function distance3D(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function calculateVolume(
  playerPos: Vector3,
  soundPos: Vector3,
  maxDistance: number,
  maxVolume: number = 1.0
): number {
  const distance = distance3D(playerPos, soundPos);
  
  if (distance >= maxDistance) {
    return 0;
  }
  
  const distanceRatio = distance / maxDistance;
  const volumeFactor = 1 - distanceRatio;
  
  return Math.max(0, Math.min(maxVolume, volumeFactor * maxVolume));
}

export function addRemoteSound(sound: RemoteSound): void {
  remoteSounds.set(sound.id, sound);
  updateSoundVolume(sound.id);
}

export function removeRemoteSound(id: string): void {
  remoteSounds.delete(id);
}

export function updateRemoteSoundPosition(id: string, position: Vector3): void {
  const sound = remoteSounds.get(id);
  if (sound) {
    sound.position = position;
    updateSoundVolume(id);
  }
}

export function updateRemoteSoundDistance(id: string, distance: number): void {
  const sound = remoteSounds.get(id);
  if (sound) {
    sound.maxDistance = distance;
    updateSoundVolume(id);
  }
}

function updateSoundVolume(id: string): void {
  const sound = remoteSounds.get(id);
  if (!sound || !sound.player) return;
  
  const volume = calculateVolume(
    playerPosition,
    sound.position,
    sound.maxDistance,
    sound.maxVolume
  );
  
  sound.player.setVolume(volume);
}

function updateAllVolumes(): void {
  remoteSounds.forEach((_, id) => updateSoundVolume(id));
}

export function getRemoteSounds(): Map<string, RemoteSound> {
  return remoteSounds;
}

export function clearRemoteSounds(): void {
  remoteSounds.clear();
}

export function startPositionUpdates(callback: (pos: Vector3) => void, interval: number = 300): void {
  stopPositionUpdates();
  updateInterval = window.setInterval(() => {
    callback(playerPosition);
  }, interval);
}

export function stopPositionUpdates(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

export function initPositionalAudio(): void {
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data.action === 'music:playerPosition') {
      setPlayerPosition({
        x: data.x || 0,
        y: data.y || 0,
        z: data.z || 0
      });
    }
  });
}
