import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { ScreenState } from '../../shared/ui/ScreenState';
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

export function MapsApp() {
  const router = useRouter();
  const [locations, setLocations] = createSignal<SharedLocationItem[]>([]);
  const [coordsX, setCoordsX] = createSignal('');
  const [coordsY, setCoordsY] = createSignal('');
  const [pickedCoords, setPickedCoords] = createSignal<{ x: number; y: number } | null>(null);
  const [shareNumber, setShareNumber] = createSignal('');
  const [contacts, setContacts] = createSignal<ContactItem[]>([]);
  const [shareError, setShareError] = createSignal('');
  const [loading, setLoading] = createSignal(true);

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
    setPickedCoords({ x, y });
    setCoordsX(x.toFixed(2));
    setCoordsY(y.toFixed(2));
  });

  const setGps = async (x: number, y: number) => {
    await fetchNui('setGPS', { x, y });
  };

  const setCustomGps = async () => {
    const x = Number(coordsX());
    const y = Number(coordsY());
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    await setGps(x, y);
  };

  const pins = createMemo(() => {
    const shared = locations().map((location, index) => ({
      id: `shared-${index}`,
      label: `${location.from}: ${location.message || 'Ubicacion'}`,
      x: location.x,
      y: location.y,
      kind: 'shared' as const,
    }));

    const picked = pickedCoords()
      ? [{ id: 'picked', label: 'Coordenada seleccionada', x: pickedCoords()!.x, y: pickedCoords()!.y, kind: 'manual' as const }]
      : [];

    return [...picked, ...shared];
  });

  const sharePickedCoords = async () => {
    setShareError('');
    const selected = pickedCoords();
    const number = sanitizeText(shareNumber(), 20);
    if (!selected) return;
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
      message: `Ubicacion compartida LOC:${selected.x.toFixed(2)},${selected.y.toFixed(2)}`,
    });
    setShareError('');
  };

  const shareToChirp = async () => {
    const selected = pickedCoords();
    if (!selected) return;
    await fetchNui('chirpPublishTweet', {
      content: `📍 Punto de encuentro LOC:${selected.x.toFixed(2)},${selected.y.toFixed(2)}`,
    });
  };

  const copyCoords = async () => {
    const selected = pickedCoords();
    if (!selected) return;
    await navigator.clipboard.writeText(`LOC:${selected.x.toFixed(2)},${selected.y.toFixed(2)}`);
  };

  return (
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>
          ‹
        </button>
        <div class="ios-nav-title">Mapas</div>
      </div>

      <div class="ios-content">
        <div class={styles.mapWrap}>
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

        <ScreenState loading={loading()} empty={locations().length === 0} emptyTitle="Sin ubicaciones" emptyDescription="Cuando compartan ubicaciones apareceran aqui.">
        <div class="ios-section-title">Ubicaciones compartidas</div>
        <div class="ios-list">
          <For each={locations()}>
            {(location) => (
              <div class="ios-row">
                <div>
                  <div class="ios-label">{location.from}</div>
                  <div class="ios-value">{location.message || 'Ubicacion'}</div>
                </div>
                <button class="ios-btn ios-btn-primary" onClick={() => setGps(location.x, location.y)}>
                  Marcar
                </button>
              </div>
            )}
          </For>
        </div>

        <div class="ios-section-title">GPS manual</div>
        <div class={`ios-card ${styles.manual}`}>
          <input class="ios-input" type="number" placeholder="X" value={coordsX()} onInput={(e) => setCoordsX(e.currentTarget.value)} />
          <input class="ios-input" type="number" placeholder="Y" value={coordsY()} onInput={(e) => setCoordsY(e.currentTarget.value)} />
          <button class="ios-btn ios-btn-primary" onClick={setCustomGps}>
            Establecer GPS
          </button>
        </div>

        <Show when={pickedCoords()}>
          <div class="ios-section-title">Compartir coordenada elegida</div>
          <div class={`ios-card ${styles.shareRow}`}>
            <select class="ios-select" onChange={(e) => setShareNumber(e.currentTarget.value)}>
              <option value="">Elegir contacto</option>
              <For each={contacts()}>{(c) => <option value={c.number}>{c.display} ({c.number})</option>}</For>
            </select>
            <input class="ios-input" type="text" placeholder="Numero" value={shareNumber()} onInput={(e) => setShareNumber(e.currentTarget.value)} />
            <button class="ios-btn ios-btn-primary" onClick={sharePickedCoords} disabled={!shareNumber().trim()}>Enviar a numero</button>
            <button class="ios-btn" onClick={shareToChirp}>Chirp</button>
            <button class="ios-btn" onClick={copyCoords}>Copiar</button>
          </div>
          <Show when={shareNumber().trim()}>
            <div class={styles.sendTo}>Enviar a: {shareNumber()}</div>
          </Show>
          <Show when={shareError()}>
            <div class={styles.error}>{shareError()}</div>
          </Show>
        </Show>
        </ScreenState>
      </div>
    </div>
  );
}
