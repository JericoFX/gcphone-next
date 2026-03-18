import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import styles from './NfcShareSheet.module.scss';

interface NearbyPlayer {
  serverId: number;
  name: string;
  distance: number;
}

interface NfcShareSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (targetServerId: number) => void;
  title?: string;
  maxDistance?: number;
  disabled?: boolean;
}

export function NfcShareSheet(props: NfcShareSheetProps) {
  const [players, setPlayers] = createSignal<NearbyPlayer[]>([]);
  const [scanning, setScanning] = createSignal(true);
  const [scanCount, setScanCount] = createSignal(0);

  let pollTimer: number | undefined;

  const poll = async () => {
    const result = await fetchNui<NearbyPlayer[]>(
      'getNearbyPlayers',
      { maxDistance: props.maxDistance ?? 5.0 },
      [
        { serverId: 1, name: 'Carlos Mendoza', distance: 1.2 },
        { serverId: 2, name: 'Ana Torres', distance: 2.8 },
        { serverId: 3, name: 'Pedro Ruiz', distance: 4.1 },
      ],
    );
    setPlayers(result || []);
    setScanning(false);
    setScanCount((c) => c + 1);
  };

  createEffect(() => {
    if (props.open) {
      setScanning(true);
      setScanCount(0);
      setPlayers([]);
      void poll();
      pollTimer = window.setInterval(() => void poll(), 2000);
    } else {
      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
    }
  });

  onCleanup(() => {
    if (pollTimer) window.clearInterval(pollTimer);
  });

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getAngle = (index: number, total: number) => {
    if (total <= 0) return 0;
    const base = -90;
    const spread = Math.min(360, total * 72);
    const step = spread / Math.max(1, total);
    return base + step * index;
  };

  const getRadius = (distance: number, maxDist: number) => {
    const ratio = Math.min(1, distance / maxDist);
    return 18 + ratio * 30;
  };

  return (
    <Show when={props.open}>
      <div class={styles.overlay} onClick={props.onClose}>
        <div class={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <div class={styles.header}>
            <div class={styles.grabber} />
            <h3>{props.title || 'Compartir NFC'}</h3>
            <span class={styles.subtitle}>Personas cerca de ti</span>
          </div>

          {/* Radar */}
          <div class={styles.radar}>
            <div class={styles.radarBg}>
              <div class={styles.ring} />
              <div class={styles.ring} style={{ width: '66%', height: '66%' }} />
              <div class={styles.ring} style={{ width: '33%', height: '33%' }} />
              <div class={styles.sweep} classList={{ [styles.sweepActive]: props.open }} />
              <div class={styles.centerDot}>Tu</div>
            </div>

            {/* Player dots on radar */}
            <For each={players()}>
              {(player, index) => {
                const angle = () => getAngle(index(), players().length);
                const radius = () => getRadius(player.distance, props.maxDistance ?? 5.0);
                const x = () => 50 + radius() * Math.cos((angle() * Math.PI) / 180);
                const y = () => 50 + radius() * Math.sin((angle() * Math.PI) / 180);

                return (
                  <button
                    class={styles.radarDot}
                    style={{ left: `${x()}%`, top: `${y()}%` }}
                    onClick={() => !props.disabled && props.onSelect(player.serverId)}
                    disabled={props.disabled}
                    title={player.name}
                  >
                    <span class={styles.dotPulse} />
                    <span class={styles.dotCore}>{getInitials(player.name)}</span>
                  </button>
                );
              }}
            </For>
          </div>

          {/* Player list */}
          <div class={styles.playerList}>
            <Show when={!scanning() && players().length === 0}>
              <div class={styles.empty}>
                <span>No hay personas cerca</span>
                <small>Acercate a alguien para compartir</small>
              </div>
            </Show>

            <For each={players()}>
              {(player) => (
                <button
                  class={styles.playerRow}
                  onClick={() => !props.disabled && props.onSelect(player.serverId)}
                  disabled={props.disabled}
                >
                  <div class={styles.avatar}>
                    {getInitials(player.name)}
                  </div>
                  <div class={styles.playerInfo}>
                    <strong>{player.name}</strong>
                    <span>{player.distance.toFixed(1)}m</span>
                  </div>
                  <div class={styles.distancePill}>
                    {player.distance <= 2 ? 'Cerca' : player.distance <= 4 ? 'Medio' : 'Lejos'}
                  </div>
                </button>
              )}
            </For>
          </div>

          <Show when={scanning()}>
            <div class={styles.scanStatus}>
              <div class={styles.scanDot} />
              <span>Escaneando...</span>
            </div>
          </Show>

          <button class={styles.cancelBtn} onClick={props.onClose}>Cerrar</button>
        </div>
      </div>
    </Show>
  );
}
