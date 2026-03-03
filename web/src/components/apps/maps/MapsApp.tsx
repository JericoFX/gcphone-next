import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { sanitizeText } from '../../../utils/sanitize';
import { LeafletMap } from './LeafletMap';
import styles from './MapsApp.module.scss';

interface SharedLocationItem {
  id: string;
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

interface WaveGroup {
  id: number;
  name: string;
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
  const [selectedMarker, setSelectedMarker] = createSignal<ManualMarker | null>(null);
  const [pickedCoords, setPickedCoords] = createSignal<{ x: number; y: number } | null>(null);

  const [coordsX, setCoordsX] = createSignal('');
  const [coordsY, setCoordsY] = createSignal('');

  const [shareApp, setShareApp] = createSignal<'messages' | 'chirp' | 'wavechat'>('messages');
  const [shareNumber, setShareNumber] = createSignal('');
  const [shareGroupId, setShareGroupId] = createSignal('');
  const [shareError, setShareError] = createSignal('');
  const [status, setStatus] = createSignal('Toca el mapa para marcar un punto y compartirlo.');

  const [contacts, setContacts] = createSignal<ContactItem[]>([]);
  const [groups, setGroups] = createSignal<WaveGroup[]>([]);

  const [showFabMenu, setShowFabMenu] = createSignal(false);
  const [showShareSheet, setShowShareSheet] = createSignal(false);
  const [showManualGpsSheet, setShowManualGpsSheet] = createSignal(false);
  const [showLocationsSheet, setShowLocationsSheet] = createSignal(false);
  const [showMarkerSheet, setShowMarkerSheet] = createSignal(false);

  const routeParams = () => router.params();
  let lastRouteKey = '';

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };

    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const loadContactsAndGroups = async () => {
    const list = await fetchNui<ContactItem[]>('getContacts', undefined, []);
    setContacts((list || []).filter((c) => c?.number));

    const waveGroups = await fetchNui<WaveGroup[]>('wavechatGetGroups', {}, []);
    setGroups((waveGroups || []).filter((row) => Number.isFinite(row.id)));
  };

  const loadLiveLocations = async () => {
    const response = await fetchNui<{ success?: boolean; locations?: Array<{ sender_phone: string; sender_name?: string; x: number; y: number }> }>('getActiveLiveLocations', {}, { success: false, locations: [] });
    const rows = Array.isArray(response?.locations) ? response.locations : [];

    setLocations(rows.map((row, index) => ({
      id: `live-${row.sender_phone || index}`,
      from: row.sender_name || row.sender_phone || 'Contacto',
      x: Number(row.x) || 0,
      y: Number(row.y) || 0,
      z: 0,
      message: 'ubicacion activa',
    })));
  };

  onMount(() => {
    void loadContactsAndGroups();
    void loadLiveLocations();

    const timer = window.setInterval(() => {
      void loadLiveLocations();
    }, 8000);

    onCleanup(() => window.clearInterval(timer));
  });

  createEffect(() => {
    const params = routeParams();
    const x = Number(params.x);
    const y = Number(params.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const key = `${x.toFixed(4)}:${y.toFixed(4)}`;
    if (key === lastRouteKey) return;
    lastRouteKey = key;
    addManualMarker(x, y, 'Punto compartido');
  });

  const addManualMarker = (x: number, y: number, label?: string) => {
    const id = `marker-${++markerIdCounter}`;
    const marker: ManualMarker = {
      id,
      x,
      y,
      label: label || `Punto ${manualMarkers().length + 1}`,
    };

    setManualMarkers((prev) => [...prev, marker]);
    setSelectedMarker(marker);
    setPickedCoords({ x, y });
    setCoordsX(x.toFixed(5));
    setCoordsY(y.toFixed(5));
    setStatus(`${marker.label}: ${x.toFixed(2)}, ${y.toFixed(2)}`);
  };

  const removeMarker = (id: string) => {
    setManualMarkers((prev) => prev.filter((marker) => marker.id !== id));
    if (selectedMarker()?.id === id) {
      setSelectedMarker(null);
    }
  };

  const clearAllMarkers = () => {
    setManualMarkers([]);
    setSelectedMarker(null);
    setPickedCoords(null);
    setStatus('Puntos manuales limpiados.');
  };

  const setGps = async (x: number, y: number) => {
    await fetchNui('setGPS', { x, y });
    setStatus(`GPS actualizado: ${x.toFixed(2)}, ${y.toFixed(2)}`);
  };

  const setCustomGps = async () => {
    const x = Number(coordsX());
    const y = Number(coordsY());
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    await setGps(x, y);
    setShowManualGpsSheet(false);
  };

  const pins = createMemo(() => {
    const shared = locations().map((location) => ({
      id: location.id,
      label: `${location.from}: ${location.message || 'Ubicacion'}`,
      x: location.x,
      y: location.y,
      kind: 'shared' as const,
    }));

    const manual = manualMarkers().map((marker) => ({
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
    if (!marker) return;

    if (shareApp() === 'messages') {
      const number = sanitizeText(shareNumber(), 20);
      if (!number) {
        setShareError('Debes elegir o escribir un numero');
        return;
      }
      if (!/^[\+]?[0-9\-\s()]{3,20}$/.test(number)) {
        setShareError('Numero invalido');
        return;
      }

      await fetchNui('sendMessage', {
        phoneNumber: number,
        message: `Ubicacion compartida LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`,
      });
    }

    if (shareApp() === 'chirp') {
      await fetchNui('chirpPublishTweet', {
        content: `📍 Punto de encuentro LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`,
      });
    }

    if (shareApp() === 'wavechat') {
      const groupId = Number(shareGroupId());
      if (!Number.isFinite(groupId) || groupId <= 0) {
        setShareError('Elige un grupo de WaveChat');
        return;
      }

      await fetchNui('wavechatSendGroupMessage', {
        groupId,
        message: `📍 Coordenadas compartidas LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`,
      });
    }

    setShowShareSheet(false);
    setStatus('Ubicacion compartida correctamente.');
  };

  const copyCoords = async () => {
    const marker = selectedMarker();
    if (!marker) return;
    await navigator.clipboard.writeText(`LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`);
    setStatus('Coordenadas copiadas al portapapeles.');
  };

  const getMyLocation = async () => {
    const coords = await fetchNui<{ x: number; y: number }>('getPlayerCoords', undefined, { x: 0, y: 0 });
    if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
      addManualMarker(coords.x, coords.y, 'Mi ubicacion');
    }
  };

  return (
    <div class={styles.mapsPage}>
      <div class={`ios-nav ${styles.navBar}`}>
        <button class="ios-icon-btn" onClick={() => router.goBack()}>‹</button>
        <div class="ios-nav-title">Mapas</div>
      </div>

      <div class={styles.topHud}>
        <div class={styles.hudText}>
          <span>{status()}</span>
        </div>
      </div>

      <div class={styles.mapContainer}>
        <LeafletMap
          pins={pins()}
          onPickCoords={(x, y) => {
            addManualMarker(x, y);
            setShowMarkerSheet(true);
          }}
          onPinClick={(pin) => {
            if (pin.kind === 'manual') {
              const marker = manualMarkers().find((row) => row.id === pin.id);
              if (marker) {
                setSelectedMarker(marker);
                setPickedCoords({ x: marker.x, y: marker.y });
                setCoordsX(marker.x.toFixed(5));
                setCoordsY(marker.y.toFixed(5));
                setShowMarkerSheet(true);
              }
              return;
            }
            void setGps(pin.x, pin.y);
          }}
        />
      </div>

      <Show when={pickedCoords()}>
        <div class={styles.coordDisplay}>
          <span>📍 Coordenada activa</span>
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
            <span>Compartir punto</span>
          </button>
          <button class={styles.fabMenuItem} onClick={() => {
            setShowFabMenu(false);
            setShowLocationsSheet(true);
          }}>
            <span class={styles.fabMenuIcon}>📋</span>
            <span>Ubicaciones activas</span>
          </button>
          <button class={styles.fabMenuItem} onClick={() => {
            setShowFabMenu(false);
            void getMyLocation();
          }}>
            <span class={styles.fabMenuIcon}>🎯</span>
            <span>Mi ubicacion</span>
          </button>
          <button class={styles.fabMenuItem} onClick={() => {
            setShowFabMenu(false);
            clearAllMarkers();
          }}>
            <span class={styles.fabMenuIcon}>🗑️</span>
            <span>Limpiar puntos</span>
          </button>
        </div>
      </Show>

      <Show when={showManualGpsSheet()}>
        <div class={styles.sheetOverlay} onClick={() => setShowManualGpsSheet(false)}>
          <div class={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <h3>GPS Manual</h3>
            <div class={styles.sheetGrid}>
              <input class="ios-input" type="number" step="0.00001" placeholder="X" value={coordsX()} onInput={(e) => setCoordsX(e.currentTarget.value)} />
              <input class="ios-input" type="number" step="0.00001" placeholder="Y" value={coordsY()} onInput={(e) => setCoordsY(e.currentTarget.value)} />
            </div>
            <div class={styles.sheetActions}>
              <button class="ios-btn" onClick={() => setShowManualGpsSheet(false)}>Cancelar</button>
              <button class="ios-btn ios-btn-primary" onClick={() => void setCustomGps()}>Establecer</button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showShareSheet()}>
        <div class={styles.sheetOverlay} onClick={() => setShowShareSheet(false)}>
          <div class={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <h3>Compartir ubicacion</h3>
            <select class="ios-select" value={shareApp()} onChange={(e) => setShareApp(e.currentTarget.value as 'messages' | 'chirp' | 'wavechat')}>
              <option value="messages">Mensajes</option>
              <option value="chirp">Chirp</option>
              <option value="wavechat">WaveChat Grupo</option>
            </select>

            <Show when={shareApp() === 'messages'}>
              <>
                <select class="ios-select" onChange={(e) => setShareNumber(e.currentTarget.value)}>
                  <option value="">Elegir contacto</option>
                  <For each={contacts()}>{(contact) => <option value={contact.number}>{contact.display} ({contact.number})</option>}</For>
                </select>
                <input class="ios-input" type="text" placeholder="Numero" value={shareNumber()} onInput={(e) => setShareNumber(e.currentTarget.value)} />
              </>
            </Show>

            <Show when={shareApp() === 'wavechat'}>
              <select class="ios-select" value={shareGroupId()} onChange={(e) => setShareGroupId(e.currentTarget.value)}>
                <option value="">Elegir grupo</option>
                <For each={groups()}>{(group) => <option value={String(group.id)}>{group.name}</option>}</For>
              </select>
            </Show>

            <Show when={shareError()}>
              <div class={styles.sheetError}>{shareError()}</div>
            </Show>

            <div class={styles.sheetActions}>
              <button class="ios-btn" onClick={() => void copyCoords()}>Copiar</button>
              <button class="ios-btn ios-btn-primary" onClick={() => void shareSelectedCoords()}>Compartir</button>
            </div>
          </div>
        </div>
      </Show>

      <ActionSheet
        open={showLocationsSheet()}
        title="Ubicaciones activas"
        onClose={() => {
          setShowLocationsSheet(false);
        }}
        actions={locations().map((location) => ({
          label: `${location.from}: ${location.message || 'Ubicacion'}`,
          onClick: () => {
            void setGps(location.x, location.y);
            setShowLocationsSheet(false);
          },
        }))}
      />

      <ActionSheet
        open={showMarkerSheet()}
        title="Punto marcado"
        onClose={() => {
          setShowMarkerSheet(false);
        }}
        actions={[
          {
            label: 'Ir con GPS',
            tone: 'primary',
            onClick: () => {
              const marker = selectedMarker();
              if (!marker) return;
              void setGps(marker.x, marker.y);
            },
          },
          {
            label: 'Compartir',
            onClick: () => {
              setShowShareSheet(true);
            },
          },
          {
            label: 'Eliminar punto',
            tone: 'danger',
            onClick: () => {
              const marker = selectedMarker();
              if (!marker) return;
              removeMarker(marker.id);
              setShowMarkerSheet(false);
            },
          },
        ]}
      />
    </div>
  );
}
