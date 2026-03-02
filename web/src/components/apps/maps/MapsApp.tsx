import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { sanitizeText } from '../../../utils/sanitize';
import { LeafletMap } from './LeafletMap';
import styles from './MapsApp.module.scss';

interface SharedLocationItem {
  from: string;
  x: number;
  y: number;
  z: number;
  message?: string;
}

interface ContactItem {
  number: string;
  display: string;
}

interface ManualMarker {
  id: string;
  x: number;
  y: number;
  label: string;
}

let markerIdCounter = 0;

export function MapsApp() {
  const router = useRouter();
  const [locations, setLocations] = createSignal<SharedLocationItem[]>([]);
  const [manualMarkers, setManualMarkers] = createSignal<ManualMarker[]>([]);
  const [coordsX, setCoordsX] = createSignal('');
  const [coordsY, setCoordsY] = createSignal('');
  const [selectedMarker, setSelectedMarker] = createSignal<ManualMarker | null>(null);
  const [shareNumber, setShareNumber] = createSignal('');
  const [contacts, setContacts] = createSignal<ContactItem[]>([]);
  const [shareError, setShareError] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [showFabMenu, setShowFabMenu] = createSignal(false);
  const [showShareSheet, setShowShareSheet] = createSignal(false);
  const [showManualGpsSheet, setShowManualGpsSheet] = createSignal(false);
  const [showLocationsSheet, setShowLocationsSheet] = createSignal(false);
  const [showMarkerSheet, setShowMarkerSheet] = createSignal(false);

  const routeParams = () => router.params();

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  createEffect(() => {
    const load = async () => {
      const bootstrap: SharedLocationItem[] = [
        { from: 'Mecanico', x: 214.12, y: -809.23, z: 30.0, message: 'Taller' },
        { from: 'Amigo', x: -124.2, y: -634.8, z: 35.2, message: 'Nos vemos aqui' },
      ];
      setLocations(bootstrap);
      const list = await fetchNui<ContactItem[]>('getContacts', undefined, []);
      setContacts((list || []).filter((c) => c?.number));
      setLoading(false);
    };
    void load();
  });

  createEffect(() => {
    const params = routeParams();
    const x = Number(params.x);
    const y = Number(params.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    addManualMarker(x, y);
  });

  const addManualMarker = (x: number, y: number, label?: string) => {
    const id = `marker-${++markerIdCounter}`;
    const marker: ManualMarker = {
      id,
      x,
      y,
      label: label || `Punto ${manualMarkers().length + 1}`,
    };
    setManualMarkers(prev => [...prev, marker]);
    setSelectedMarker(marker);
    setCoordsX(x.toFixed(5));
    setCoordsY(y.toFixed(5));
  };

  const removeMarker = (id: string) => {
    setManualMarkers(prev => prev.filter(m => m.id !== id));
    if (selectedMarker()?.id === id) {
      setSelectedMarker(null);
    }
  };

  const clearAllMarkers = () => {
    setManualMarkers([]);
    setSelectedMarker(null);
  };

  const setGps = async (x: number, y: number) => {
    await fetchNui('setGPS', { x, y });
  };

  const setCustomGps = async () => {
    const x = Number(coordsX());
    const y = Number(coordsY());
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    await setGps(x, y);
    setShowManualGpsSheet(false);
  };

  const pins = createMemo(() => {
    const shared = locations().map((location, index) => ({
      id: `shared-${index}`,
      label: `${location.from}: ${location.message || 'Ubicacion'}`,
      x: location.x,
      y: location.y,
      kind: 'shared' as const,
    }));

    const manual = manualMarkers().map(marker => ({
      id: marker.id,
      label: marker.label,
      x: marker.x,
      y: marker.y,
      kind: 'manual' as const,
    }));

    return [...manual, ...shared];
  });

  const shareSelectedCoords = async () => {
    setShareError('');
    const marker = selectedMarker();
    const number = sanitizeText(shareNumber(), 20);
    if (!marker) return;
    if (!number) {
      setShareError('Debes elegir o escribir un numero');
      return;
    }
    if (!/^\+?[0-9\-\s()]{3,20}$/.test(number)) {
      setShareError('Numero invalido');
      return;
    }

    await fetchNui('sendMessage', {
      phoneNumber: number,
      message: `Ubicacion compartida LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`,
    });
    setShareError('');
    setShowShareSheet(false);
  };

  const shareToChirp = async () => {
    const marker = selectedMarker();
    if (!marker) return;
    await fetchNui('chirpPublishTweet', {
      content: `📍 Punto de encuentro LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`,
    });
    setShowShareSheet(false);
  };

  const copyCoords = async () => {
    const marker = selectedMarker();
    if (!marker) return;
    await navigator.clipboard.writeText(`LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`);
  };

  const getMyLocation = async () => {
    const coords = await fetchNui<{ x: number; y: number }>('getPlayerCoords', undefined, { x: 0, y: 0 });
    if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
      addManualMarker(coords.x, coords.y, 'Mi ubicacion');
    }
  };

  const handleMapClick = (x: number, y: number) => {
    addManualMarker(x, y);
  };

  const handlePinClick = (pin: any) => {
    if (pin.kind === 'manual') {
      const marker = manualMarkers().find(m => m.id === pin.id);
      if (marker) {
        setSelectedMarker(marker);
        setCoordsX(marker.x.toFixed(5));
        setCoordsY(marker.y.toFixed(5));
        setShowMarkerSheet(true);
      }
    } else {
      void setGps(pin.x, pin.y);
    }
  };

  return (
    <div class={styles.mapsPage}>
      <div class={styles.mapContainer}>
        <LeafletMap
          pins={pins()}
          onPickCoords={(x, y) => {
            setPickedCoords({ x, y });
            setCoordsX(x.toFixed(5));
            setCoordsY(y.toFixed(5));
          }}
          onPinClick={(pin) => {
            void setGps(pin.x, pin.y);
          }}
        />
      </div>

      <Show when={pickedCoords()}>
        <div class={styles.coordDisplay}>
          <span>📍 Coordenada</span>
          <span class={styles.coordValue}>{coordsX()}, {coordsY()}</span>
        </div>
      </Show>

      <button 
        class={styles.fab} 
        classList={{ [styles.fabMenuOpen]: showFabMenu() }}
        onClick={() => setShowFabMenu(!showFabMenu())}
      >
        <span class={styles.fabIcon}>+</span>
      </button>

      <Show when={showFabMenu()}>
        <div class={styles.fabOverlay} onClick={() => setShowFabMenu(false)} />
        <div class={styles.fabMenu}>
          <button class={styles.fabMenuItem} onClick={() => {
            setShowFabMenu(false);
            setShowManualGpsSheet(true);
          }}>
            <span class={styles.fabMenuIcon}>📍</span>
            <span>GPS Manual</span>
          </button>
          <button class={styles.fabMenuItem} onClick={() => {
            setShowFabMenu(false);
            setShowShareSheet(true);
          }}>
            <span class={styles.fabMenuIcon}>📤</span>
            <span>Compartir ubicacion</span>
          </button>
          <button class={styles.fabMenuItem} onClick={() => {
            setShowFabMenu(false);
            setShowLocationsSheet(true);
          }}>
            <span class={styles.fabMenuIcon}>📋</span>
            <span>Ubicaciones compartidas</span>
          </button>
          <button class={styles.fabMenuItem} onClick={() => {
            setShowFabMenu(false);
            void getMyLocation();
          }}>
            <span class={styles.fabMenuIcon}>🎯</span>
            <span>Mi ubicacion</span>
          </button>
        </div>
      </Show>

      <ActionSheet
        open={showManualGpsSheet()}
        title="GPS Manual"
        onClose={() => setShowManualGpsSheet(false)}
        actions={[
          {
            label: 'Establecer GPS',
            tone: 'primary',
            onClick: () => void setCustomGps(),
          },
        ]}
      >
        <div style="padding: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <input 
            class="ios-input" 
            type="number" 
            step="0.00001"
            placeholder="X" 
            value={coordsX()} 
            onInput={(e) => setCoordsX(e.currentTarget.value)} 
          />
          <input 
            class="ios-input" 
            type="number" 
            step="0.00001"
            placeholder="Y" 
            value={coordsY()} 
            onInput={(e) => setCoordsY(e.currentTarget.value)} 
          />
        </div>
      </ActionSheet>

      <ActionSheet
        open={showShareSheet()}
        title="Compartir Ubicacion"
        onClose={() => setShowShareSheet(false)}
        actions={[
          {
            label: 'Enviar SMS',
            tone: 'primary',
            onClick: () => void sharePickedCoords(),
          },
          {
            label: 'Chirp',
            onClick: () => void shareToChirp(),
          },
          {
            label: 'Copiar coordenadas',
            onClick: () => void copyCoords(),
          },
        ]}
      >
        <div style="padding: 12px;">
          <select class="ios-select" style="width: 100%; margin-bottom: 8px;" onChange={(e) => setShareNumber(e.currentTarget.value)}>
            <option value="">Elegir contacto</option>
            <For each={contacts()}>{(c) => <option value={c.number}>{c.display} ({c.number})</option>}</For>
          </select>
          <input 
            class="ios-input" 
            type="text" 
            placeholder="Numero" 
            value={shareNumber()} 
            onInput={(e) => setShareNumber(e.currentTarget.value)}
            style="width: 100%;"
          />
          <Show when={shareError()}>
            <div style="margin-top: 8px; font-size: 12px; color: #ff4b6f;">{shareError()}</div>
          </Show>
        </div>
      </ActionSheet>

      <ActionSheet
        open={showLocationsSheet()}
        title="Ubicaciones Compartidas"
        onClose={() => setShowLocationsSheet(false)}
        actions={locations().map((loc) => ({
          label: `${loc.from}: ${loc.message || 'Ubicacion'}`,
          onClick: () => {
            void setGps(loc.x, loc.y);
            setShowLocationsSheet(false);
          },
        }))}
      />
    </div>
  );
}
