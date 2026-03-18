import { For, Show, createSignal, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { timeAgo } from '../../../utils/misc';
import { uiAlert } from '../../../utils/uiAlert';
import { AppScaffold } from '../../shared/layout';
import { useAppCache } from '../../../hooks';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { SearchInput } from '../../shared/ui/SearchInput';
import { getStoredLanguage, t } from '../../../i18n';
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
  const language = () => getStoredLanguage();

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

  onMount(() => {
    void loadVehicles();
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (showShareModal()) {
        setShowShareModal(false);
        return;
      }
      if (selectedVehicle()) {
        setSelectedVehicle(null);
        setLocationHistory([]);
        return;
      }
      router.goBack();
    },
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
      uiAlert(result?.error || t('garage.request_error', language()) || 'No se pudo solicitar el vehiculo');
    } else {
      uiAlert(t('garage.vehicle_on_way', language()) || 'Tu vehiculo te espera, sigue el GPS.');
    }
  };

  const goToImpound = async () => {
    const loc = await fetchNui<{ x?: number; y?: number; z?: number; label?: string }>('garageGetImpoundLocation', {}, {});
    if (loc?.x && loc?.y) {
      await fetchNui('garageSetGps', { x: loc.x, y: loc.y });
      uiAlert(`${t('garage.gps_set', language()) || 'GPS marcado'}: ${loc.label || t('garage.impound', language()) || 'Deposito'}`);
    }
  };

  const goToVehicleLocation = async () => {
    const vehicle = selectedVehicle();
    if (!vehicle?.location_x || !vehicle?.location_y) return;
    await fetchNui('garageSetGps', { x: vehicle.location_x, y: vehicle.location_y });
    uiAlert(t('garage.gps_set', language()) || 'GPS marcado');
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
      title={t('garage.title', language())}
      subtitle={t('garage.subtitle', language())}
      onBack={() => router.goBack()}
      bodyClass={styles.body}
    >
      <div class={styles.garageApp}>
        <div class={styles.searchSection}>
          <SearchInput
            class={styles.searchWrap}
            inputClass={styles.searchInput}
            value={searchQuery()}
            onInput={setSearchQuery}
            placeholder={t('garage.search', language())}
          />
        </div>

        <div class={styles.filters}>
          <button
            class={styles.filterBtn}
            classList={{ [styles.active]: filter() === 'all' }}
            onClick={() => setFilter('all')}
          >
            {t('contacts.all', language())}
          </button>
          <button
            class={styles.filterBtn}
            classList={{ [styles.active]: filter() === 'garage' }}
            onClick={() => setFilter('garage')}
          >
            {t('garage.in_garage', language())}
          </button>
          <button
            class={styles.filterBtn}
            classList={{ [styles.active]: filter() === 'impounded' }}
            onClick={() => setFilter('impounded')}
          >
            {t('garage.impounded', language())}
          </button>
        </div>

        <div class={styles.vehicleList}>
          <Show when={loading() && vehicles().length === 0}>
            <div class={styles.loading}>{t('state.loading', language())}</div>
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
                    {vehicle.model_name || t('garage.vehicle', language())}
                  </h3>
                  <span class={styles.vehiclePlate}>{vehicle.plate}</span>

                  <div class={styles.vehicleStatus}>
                    <Show when={vehicle.impounded}>
                      <span class={styles.impoundedBadge}>{t('garage.in_depot', language())}</span>
                    </Show>
                    <Show when={!vehicle.impounded}>
                      <span class={styles.garageBadge}>
                        {vehicle.garage_name || 'Garage'}
                      </span>
                    </Show>
                  </div>

                  <Show when={vehicle.has_location}>
                    <span class={styles.locationBadge}>{t('garage.saved_location', language())}</span>
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
              <p>{t('garage.no_vehicles', language())}</p>
              <p class={styles.emptyHint}>{t('garage.no_vehicles_desc', language())}</p>
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
                  <h2>{selectedVehicle().model_name || t('garage.vehicle', language())}</h2>
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
                      <strong>{t('garage.vehicle_impounded', language())}</strong>
                      <p>{t('garage.vehicle_impounded_desc', language())}</p>
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
                         {t('garage.in_label', language(), { garage: selectedVehicle().garage_name || 'Garage' })}
                      </strong>
                       <p>{t('garage.vehicle_available', language())}</p>
                    </div>
                  </div>
                </Show>
              </div>

              {/* Location Info */}
              <Show when={selectedVehicle().has_location}>
                <div class={styles.locationCard}>
                   <h4>{t('garage.last_location', language())}</h4>
                  <Show when={selectedVehicle().location_updated}>
                    <p class={styles.locationTime}>
                       {t('garage.saved_at', language(), { time: timeAgo(selectedVehicle().location_updated) })}
                    </p>
                  </Show>

                  <div class={styles.locationActions}>
                    <button class={styles.mapBtn} onClick={viewOnMap}>
                       {t('garage.view_map', language())}
                    </button>
                    <button
                      class={styles.shareBtn}
                      onClick={() => setShowShareModal(true)}
                    >
                       {t('garage.share', language())}
                    </button>
                  </div>
                </div>

                {/* Location History */}
                <Show when={locationHistory().length > 0}>
                  <div class={styles.historySection}>
                     <h4>{t('garage.location_history', language())}</h4>
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
              <div class={styles.detailActions}>
                <Show when={!selectedVehicle().impounded}>
                  <button
                    class={styles.requestBtn}
                    onClick={() => requestVehicle(selectedVehicle().plate)}
                  >
                     {t('garage.request_vehicle', language())}
                  </button>
                </Show>
                <Show when={selectedVehicle().impounded}>
                  <button
                    class={styles.mapBtn}
                    onClick={() => void goToImpound()}
                  >
                    {t('garage.go_to_impound', language()) || 'GPS al deposito'}
                  </button>
                </Show>
                <Show when={selectedVehicle().has_location && !selectedVehicle().impounded}>
                  <button
                    class={styles.mapBtn}
                    onClick={() => void goToVehicleLocation()}
                  >
                    {t('garage.gps_to_vehicle', language()) || 'GPS al vehiculo'}
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </Show>

        {/* Share Modal */}
        <Modal
          open={showShareModal()}
          title={t('garage.share_location', language())}
          onClose={() => setShowShareModal(false)}
          size='sm'
        >
          <div class={styles.shareContent}>
            <p>{t('garage.share_vehicle_to', language())}</p>
            <input
              type='text'
              placeholder={t('wallet.phone_number_placeholder', language())}
              value={sharePhone()}
              onInput={(e) => setSharePhone(e.currentTarget.value)}
            />
          </div>

          <ModalActions>
            <ModalButton
              label={t('action.cancel', language())}
              onClick={() => setShowShareModal(false)}
            />
            <ModalButton
              label={t('garage.share', language())}
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
