import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { uiAlert } from '../../../utils/uiAlert';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import styles from './GarageApp.module.scss';

interface Vehicle {
  id?: number;
  plate: string;
  model: string;
  model_name?: string;
  garage_name?: string;
  impounded: number;
  properties?: any;
  location_x?: number;
  location_y?: number;
  location_z?: number;
  location_updated?: string;
  has_location: number;
}

interface LocationHistory {
  id: number;
  location_x: number;
  location_y: number;
  location_z: number;
  created_at: string;
}

export function GarageApp() {
  const router = useRouter();
  const cache = useAppCache('garage');

  // Data
  const [vehicles, setVehicles] = createSignal<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = createSignal<Vehicle | null>(
    null,
  );
  const [locationHistory, setLocationHistory] = createSignal<LocationHistory[]>(
    [],
  );

  // Filters
  const [filter, setFilter] = createSignal<'all' | 'garage' | 'impounded'>(
    'all',
  );
  const [searchQuery, setSearchQuery] = createSignal('');

  // UI State
  const [loading, setLoading] = createSignal(false);
  const [showShareModal, setShowShareModal] = createSignal(false);
  const [showLocationModal, setShowLocationModal] = createSignal(false);
  const [sharePhone, setSharePhone] = createSignal('');

  const loadVehicles = async () => {
    setLoading(true);
    const cached = cache.get<Vehicle[]>('garage:vehicles');
    const list =
      cached ?? (await fetchNui<Vehicle[]>('garageGetVehicles', {}, []));
    if (!cached) cache.set('garage:vehicles', list || [], 60000);
    setVehicles(list || []);
    setLoading(false);
  };

  createEffect(() => {
    void loadVehicles();
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
        if (showShareModal()) {
          setShowShareModal(false);
          return;
        }
        if (showLocationModal()) {
          setShowLocationModal(false);
          return;
        }
        if (selectedVehicle()) {
          setSelectedVehicle(null);
          setLocationHistory([]);
          return;
        }
        router.goBack();
      }
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() =>
      window.removeEventListener('phone:keyUp', onKey as EventListener),
    );
  });

  const filteredVehicles = () => {
    let list = vehicles();

    if (filter() === 'garage') {
      list = list.filter((v) => !v.impounded);
    } else if (filter() === 'impounded') {
      list = list.filter((v) => v.impounded);
    }

    if (searchQuery()) {
      const q = searchQuery().toLowerCase();
      list = list.filter(
        (v) =>
          v.plate.toLowerCase().includes(q) ||
          (v.model_name || '').toLowerCase().includes(q),
      );
    }

    return list;
  };

  const openVehicle = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);

    if (vehicle.has_location) {
      const history = await fetchNui<LocationHistory[]>(
        'garageGetLocationHistory',
        vehicle.plate,
        [],
      );
      setLocationHistory(history || []);
    }
  };

  const requestVehicle = async (plate: string) => {
    const result = await fetchNui<{ success?: boolean; error?: string }>(
      'garageRequestVehicle',
      plate,
    );
    if (!result?.success) {
      uiAlert(result?.error || 'No se pudo solicitar el vehiculo');
    }
  };

  const shareLocation = async () => {
    const vehicle = selectedVehicle();
    if (!vehicle || !sharePhone().trim()) return;

    await fetchNui('garageShareLocation', {
      plate: vehicle.plate,
      phoneNumber: sharePhone().trim(),
      x: vehicle.location_x,
      y: vehicle.location_y,
      z: vehicle.location_z,
    });

    setSharePhone('');
    setShowShareModal(false);
    uiAlert('Ubicacion compartida');
  };

  const viewOnMap = () => {
    const vehicle = selectedVehicle();
    if (!vehicle || !vehicle.location_x) return;

    router.navigate('maps', {
      x: vehicle.location_x,
      y: vehicle.location_y,
      z: vehicle.location_z,
      label: vehicle.model_name || vehicle.plate,
    });
  };

  const getVehicleIcon = () => './img/icons_ios/garage.svg';

  return (
    <AppScaffold
      title='Garage'
      subtitle='Tus vehiculos'
      onBack={() => router.goBack()}
      bodyClass={styles.body}
    >
      <div class={styles.garageApp}>
        <div class={styles.searchSection}>
          <div class={styles.searchBar}>
            <input
              type='text'
              placeholder='Buscar por placa o modelo...'
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </div>
        </div>

        <div class={styles.filters}>
          <button
            class={styles.filterBtn}
            classList={{ [styles.active]: filter() === 'all' }}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button
            class={styles.filterBtn}
            classList={{ [styles.active]: filter() === 'garage' }}
            onClick={() => setFilter('garage')}
          >
            En Garage
          </button>
          <button
            class={styles.filterBtn}
            classList={{ [styles.active]: filter() === 'impounded' }}
            onClick={() => setFilter('impounded')}
          >
            Depositados
          </button>
        </div>

        <div class={styles.vehicleList}>
          <Show when={loading() && vehicles().length === 0}>
            <div class={styles.loading}>Cargando vehiculos...</div>
          </Show>

          <For each={filteredVehicles()}>
            {(vehicle) => (
              <div
                class={styles.vehicleCard}
                onClick={() => openVehicle(vehicle)}
              >
                <div class={styles.vehicleIcon}>
                  <img src={getVehicleIcon()} alt='' />
                </div>

                <div class={styles.vehicleInfo}>
                  <h3 class={styles.vehicleName}>
                    {vehicle.model_name || 'Vehiculo'}
                  </h3>
                  <span class={styles.vehiclePlate}>{vehicle.plate}</span>

                  <div class={styles.vehicleStatus}>
                    <Show when={vehicle.impounded}>
                      <span class={styles.impoundedBadge}>En Deposito</span>
                    </Show>
                    <Show when={!vehicle.impounded}>
                      <span class={styles.garageBadge}>
                        {vehicle.garage_name || 'Garage'}
                      </span>
                    </Show>
                  </div>

                  <Show when={vehicle.has_location}>
                    <span class={styles.locationBadge}>Ubicacion guardada</span>
                  </Show>
                </div>

                <div class={styles.vehicleArrow}>
                  <img src='./img/icons_ios/ui-chevron-right.svg' alt='' />
                </div>
              </div>
            )}
          </For>

          <Show when={!loading() && filteredVehicles().length === 0}>
            <div class={styles.emptyState}>
              <p>No hay vehiculos</p>
              <p class={styles.emptyHint}>
                Los vehiculos apareceran aqui cuando los guardes
              </p>
            </div>
          </Show>
        </div>

        <Show when={selectedVehicle()}>
          <div class={styles.detailModal}>
            <button
              class={styles.closeBtn}
              onClick={() => {
                setSelectedVehicle(null);
                setLocationHistory([]);
              }}
            >
              <img src='./img/icons_ios/ui-close.svg' alt='' />
            </button>

            <div class={styles.detailContent}>
              {/* Vehicle Header */}
              <div class={styles.detailHeader}>
                <div class={styles.detailIcon}>
                  <img src={getVehicleIcon()} alt='' />
                </div>
                <div class={styles.detailTitle}>
                  <h2>{selectedVehicle().model_name || 'Vehiculo'}</h2>
                  <span class={styles.detailPlate}>
                    {selectedVehicle().plate}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div class={styles.statusCard}>
                <Show when={selectedVehicle().impounded}>
                  <div class={styles.statusImpounded}>
                    <span class={styles.statusIcon}>
                      <img src='./img/icons_ios/ui-warning.svg' alt='' />
                    </span>
                    <div>
                      <strong>Vehiculo en deposito</strong>
                      <p>Debes pagar la multa para recuperarlo</p>
                    </div>
                  </div>
                </Show>
                <Show when={!selectedVehicle().impounded}>
                  <div class={styles.statusGarage}>
                    <span class={styles.statusIcon}>
                      <img src='./img/icons_ios/ui-check.svg' alt='' />
                    </span>
                    <div>
                      <strong>
                        En {selectedVehicle().garage_name || 'Garage'}
                      </strong>
                      <p>Vehiculo disponible</p>
                    </div>
                  </div>
                </Show>
              </div>

              {/* Location Info */}
              <Show when={selectedVehicle().has_location}>
                <div class={styles.locationCard}>
                  <h4>Ultima Ubicacion</h4>
                  <Show when={selectedVehicle().location_updated}>
                    <p class={styles.locationTime}>
                      Guardada {timeAgo(selectedVehicle().location_updated)}
                    </p>
                  </Show>

                  <div class={styles.locationActions}>
                    <button class={styles.mapBtn} onClick={viewOnMap}>
                      Ver en Mapa
                    </button>
                    <button
                      class={styles.shareBtn}
                      onClick={() => setShowShareModal(true)}
                    >
                      Compartir
                    </button>
                  </div>
                </div>

                {/* Location History */}
                <Show when={locationHistory().length > 0}>
                  <div class={styles.historySection}>
                    <h4>Historial de Ubicaciones</h4>
                    <div class={styles.historyList}>
                      <For each={locationHistory().slice(0, 5)}>
                        {(loc) => (
                          <div class={styles.historyItem}>
                            <span class={styles.historyDot}>
                              <img
                                src='./img/icons_ios/ui-location.svg'
                                alt=''
                              />
                            </span>
                            <span class={styles.historyTime}>
                              {timeAgo(loc.created_at)}
                            </span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </Show>

              {/* Actions */}
              <Show when={!selectedVehicle().impounded}>
                <div class={styles.detailActions}>
                  <button
                    class={styles.requestBtn}
                    onClick={() => requestVehicle(selectedVehicle().plate)}
                  >
                    Solicitar Vehiculo
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        {/* Share Modal */}
        <Modal
          open={showShareModal()}
          title='Compartir Ubicacion'
          onClose={() => setShowShareModal(false)}
          size='sm'
        >
          <div class={styles.shareContent}>
            <p>Enviar ubicacion del vehiculo a:</p>
            <input
              type='text'
              placeholder='Numero de telefono'
              value={sharePhone()}
              onInput={(e) => setSharePhone(e.currentTarget.value)}
            />
          </div>

          <ModalActions>
            <ModalButton
              label='Cancelar'
              onClick={() => setShowShareModal(false)}
            />
            <ModalButton
              label='Compartir'
              onClick={() => void shareLocation()}
              tone='primary'
              disabled={!sharePhone().trim()}
            />
          </ModalActions>
        </Modal>
      </div>
    </AppScaffold>
  );
}
