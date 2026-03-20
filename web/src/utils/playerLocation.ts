import { fetchNui } from './fetchNui';

export async function getPlayerCoords(): Promise<{ x: number; y: number } | null> {
  const coords = await fetchNui<{ x: number; y: number }>('getPlayerCoords', undefined, { x: 0, y: 0 });
  if (!coords || !Number.isFinite(coords.x) || !Number.isFinite(coords.y) || (coords.x === 0 && coords.y === 0)) return null;
  return coords;
}

export function formatLocationMessage(coords: { x: number; y: number }, label?: string): string {
  return `📍 ${label || 'Ubicacion'} LOC:${coords.x.toFixed(2)},${coords.y.toFixed(2)}`;
}
