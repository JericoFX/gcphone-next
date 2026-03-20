import { For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { ActionSheet } from '../../shared/ui/ActionSheet';
import { AppScaffold } from '../../shared/layout';
import { sanitizeText } from '../../../utils/sanitize';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { usePollingTask, useWindowEvent } from '../../../hooks';
import { getStoredLanguage, t } from '../../../i18n';
import { LeafletMap } from './LeafletMap';
import { getPlayerCoords } from '../../../utils/playerLocation';
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
  const language = () => getStoredLanguage();

  const [locations, setLocations] = createSignal<SharedLocationItem[]>([]);
  const [manualMarkers, setManualMarkers] = createSignal<ManualMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = createSignal<ManualMarker | null>(null);
  const [pickedCoords, setPickedCoords] = createSignal<{ x: number; y: number } | null>(null);

  const [coordsX, setCoordsX] = createSignal('');
  const [coordsY, setCoordsY] = createSignal('');

  const [shareApp, setShareApp] = createSignal<'messages' | 'chirp' | 'wavechat' | 'mail'>('messages');
  const [shareNumber, setShareNumber] = createSignal('');
  const [shareGroupId, setShareGroupId] = createSignal('');
  const [shareError, setShareError] = createSignal('');
  const [status, setStatus] = createSignal(t('maps.hint_tap', language()));

  const [contacts, setContacts] = createSignal<ContactItem[]>([]);
  const [groups, setGroups] = createSignal<WaveGroup[]>([]);

  const [showFabMenu, setShowFabMenu] = createSignal(false);
  const [showShareSheet, setShowShareSheet] = createSignal(false);
  const [showManualGpsSheet, setShowManualGpsSheet] = createSignal(false);
  const [showLocationsSheet, setShowLocationsSheet] = createSignal(false);
  const [showMarkerSheet, setShowMarkerSheet] = createSignal(false);
  const [documentVisible, setDocumentVisible] = createSignal(typeof document === 'undefined' ? true : document.visibilityState !== 'hidden');

  const routeParams = () => router.params();
  const routeKey = createMemo(() => {
    const params = routeParams();
    const x = Number(params.x);
    const y = Number(params.y);
    const action = typeof params.action === 'string' ? params.action : '';

    if (Number.isFinite(x) && Number.isFinite(y)) {
      return `coords:${x.toFixed(4)}:${y.toFixed(4)}`;
    }

    if (action) {
      return `action:${action}`;
    }

    return '';
  });
  let lastRouteKey = '';

  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
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
      from: row.sender_name || row.sender_phone || t('maps.unknown_contact', language()),
      x: Number(row.x) || 0,
      y: Number(row.y) || 0,
      z: 0,
      message: t('maps.live_location', language()),
    })));
  };

  onMount(() => {
    void loadContactsAndGroups();
  });

  useWindowEvent('visibilitychange', () => {
    setDocumentVisible(document.visibilityState !== 'hidden');
  });

  usePollingTask(loadLiveLocations, () => 8000, () => documentVisible());

  createEffect(() => {
    const key = routeKey();
    if (!key || key === lastRouteKey) return;

    const params = routeParams();
    const x = Number(params.x);
    const y = Number(params.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    lastRouteKey = key;
    addManualMarker(x, y, t('maps.shared_point', language()));
  });

  createEffect(() => {
    const key = routeKey();
    if (!key || key === lastRouteKey) return;

    const params = routeParams();
    const action = typeof params.action === 'string' ? params.action : '';
    if (action !== 'my-location') return;

    lastRouteKey = key;
    void getMyLocation();
  });

  const addManualMarker = (x: number, y: number, label?: string) => {
    const id = `marker-${++markerIdCounter}`;
    const marker: ManualMarker = {
      id,
      x,
      y,
      label: label || `${t('maps.point_n', language())} ${manualMarkers().length + 1}`,
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
    setStatus(t('maps.markers_cleared', language()));
  };

  const setGps = async (x: number, y: number) => {
    await fetchNui('setGPS', { x, y });
    setStatus(`${t('maps.gps_updated', language())}: ${x.toFixed(2)}, ${y.toFixed(2)}`);
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
      label: `${location.from}: ${location.message || t('maps.location_label', language())}`,
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
        setShareError(t('maps.error.pick_number', language()));
        return;
      }
      if (!/^[\+]?[0-9\-\s()]{3,20}$/.test(number)) {
        setShareError(t('maps.error.invalid_number', language()));
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
        setShareError(t('maps.error.pick_group', language()));
        return;
      }

      await fetchNui('wavechatSendGroupMessage', {
        groupId,
        message: `📍 Coordenadas compartidas LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`,
      });
    }

    if (shareApp() === 'mail') {
      router.navigate('mail', {
        compose: '1',
        subject: 'Ubicacion compartida',
        body: `Te comparto este punto:\n\nLOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`,
        attachmentUrl: `LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`,
        attachmentType: 'link',
        attachmentName: 'Coordenadas',
      });
    }

    setShowShareSheet(false);
    setStatus(t('maps.shared_success', language()));
  };

  const copyCoords = async () => {
    const marker = selectedMarker();
    if (!marker) return;
    await navigator.clipboard.writeText(`LOC:${marker.x.toFixed(2)},${marker.y.toFixed(2)}`);
    setStatus(t('maps.coords_copied', language()));
  };

  const getMyLocation = async () => {
    const coords = await getPlayerCoords();
    if (coords) {
      addManualMarker(coords.x, coords.y, t('maps.my_location', language()));
    }
  };

  return (
    <AppScaffold title={t('maps.title', language())} subtitle={t('maps.subtitle', language())} onBack={() => router.goBack()} bodyPadding="none">
      <div class={styles.mapsPage}>
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
            <span>📍 {t('maps.active_coord', language())}</span>
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
              <span>{t('maps.manual_gps', language())}</span>
            </button>
            <button class={styles.fabMenuItem} onClick={() => {
              setShowFabMenu(false);
              setShowShareSheet(true);
            }}>
              <span class={styles.fabMenuIcon}>📤</span>
              <span>{t('maps.share_point', language())}</span>
            </button>
            <button class={styles.fabMenuItem} onClick={() => {
              setShowFabMenu(false);
              setShowLocationsSheet(true);
            }}>
              <span class={styles.fabMenuIcon}>📋</span>
              <span>{t('maps.active_locations', language())}</span>
            </button>
            <button class={styles.fabMenuItem} onClick={() => {
              setShowFabMenu(false);
              void getMyLocation();
            }}>
              <span class={styles.fabMenuIcon}>🎯</span>
              <span>{t('maps.my_location', language())}</span>
            </button>
            <button class={styles.fabMenuItem} onClick={() => {
              setShowFabMenu(false);
              clearAllMarkers();
            }}>
              <span class={styles.fabMenuIcon}><img src="./img/icons_ios/ui-trash.svg" alt="" draggable={false} /></span>
              <span>{t('maps.clear_markers', language())}</span>
            </button>
          </div>
        </Show>

        <Show when={showManualGpsSheet()}>
          <div class={styles.sheetOverlay} onClick={() => setShowManualGpsSheet(false)}>
            <div class={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <h3>{t('maps.manual_gps', language())}</h3>
              <div class={styles.sheetGrid}>
                <input class="ios-input" type="number" step="0.00001" placeholder="X" value={coordsX()} onInput={(e) => setCoordsX(e.currentTarget.value)} />
                <input class="ios-input" type="number" step="0.00001" placeholder="Y" value={coordsY()} onInput={(e) => setCoordsY(e.currentTarget.value)} />
              </div>
              <div class={styles.sheetActions}>
                <button class="ios-btn" onClick={() => setShowManualGpsSheet(false)}>{t('action.cancel', language())}</button>
                <button class="ios-btn ios-btn-primary" onClick={() => void setCustomGps()}>{t('maps.set', language())}</button>
              </div>
            </div>
          </div>
        </Show>

        <Show when={showShareSheet()}>
          <div class={styles.sheetOverlay} onClick={() => setShowShareSheet(false)}>
            <div class={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <h3>{t('maps.share_location', language())}</h3>
              <select class="ios-select" value={shareApp()} onChange={(e) => setShareApp(e.currentTarget.value as 'messages' | 'chirp' | 'wavechat' | 'mail')}>
                <option value="messages">{t('app.messages', language())}</option>
                <option value="chirp">Chirp</option>
                <option value="wavechat">{t('maps.wavechat_group', language())}</option>
                <option value="mail">Mail</option>
              </select>

              <Show when={shareApp() === 'messages'}>
                <>
                  <select class="ios-select" onChange={(e) => setShareNumber(e.currentTarget.value)}>
                    <option value="">{t('maps.pick_contact', language())}</option>
                    <For each={contacts()}>{(contact) => <option value={contact.number}>{contact.display} ({contact.number})</option>}</For>
                  </select>
                  <input class="ios-input" type="text" placeholder={t('maps.number', language())} value={shareNumber()} onInput={(e) => setShareNumber(e.currentTarget.value)} />
                </>
              </Show>

              <Show when={shareApp() === 'wavechat'}>
                <select class="ios-select" value={shareGroupId()} onChange={(e) => setShareGroupId(e.currentTarget.value)}>
                  <option value="">{t('maps.pick_group', language())}</option>
                  <For each={groups()}>{(group) => <option value={String(group.id)}>{group.name}</option>}</For>
                </select>
              </Show>

              <Show when={shareError()}>
                <div class={styles.sheetError}>{shareError()}</div>
              </Show>

              <div class={styles.sheetActions}>
                <button class="ios-btn" onClick={() => void copyCoords()}>{t('maps.copy', language())}</button>
                <button class="ios-btn ios-btn-primary" onClick={() => void shareSelectedCoords()}>{t('maps.share_location', language())}</button>
              </div>
            </div>
          </div>
        </Show>

        <ActionSheet
          open={showLocationsSheet()}
          title={t('maps.active_locations', language())}
          onClose={() => {
            setShowLocationsSheet(false);
          }}
          actions={[
            ...locations().map((location) => ({
              label: `${location.from}: ${location.message || t('maps.location_label', language())}`,
              onClick: () => {
                void setGps(location.x, location.y);
                setShowLocationsSheet(false);
              },
            })),
            {
              label: t('maps.stop_sharing', language()),
              tone: 'danger' as const,
              onClick: async () => {
                await fetchNui('stopLiveLocation', {}, { success: false });
                setShowLocationsSheet(false);
              },
            },
          ]}
        />

        <ActionSheet
          open={showMarkerSheet()}
          title={t('maps.point_marked', language())}
          onClose={() => {
            setShowMarkerSheet(false);
          }}
          actions={[
            {
              label: t('maps.go_gps', language()),
              tone: 'primary',
              onClick: () => {
                const marker = selectedMarker();
                if (!marker) return;
                void setGps(marker.x, marker.y);
              },
            },
            {
              label: t('maps.share_location', language()),
              onClick: () => {
                setShowShareSheet(true);
              },
            },
            {
              label: t('maps.delete_point', language()),
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
    </AppScaffold>
  );
}
