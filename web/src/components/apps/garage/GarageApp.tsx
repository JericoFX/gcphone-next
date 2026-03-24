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

  const [vehicles, setVehicles] = createSignal<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = createSignal<Vehicle | null>(null);
  const [locationHistory, setLocationHistory] = createSignal<LocationHistory[]>([]);
  const [filter, setFilter] = createSignal<'all' | 'garage' | 'impounded'>('all');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [showShareModal, setShowShareModal] = createSignal(false);
  const [sharePhone, setSharePhone] = createSignal('');
  const [showHistory, setShowHistory] = createSignal(false);

  const loadVehicles = async () => {
    setLoading(true);
    const cached = cache.get<Vehicle[]>('garage:vehicles');
    const list = cached ?? (await fetchNui<Vehicle[]>('garageGetVehicles', {}, []));
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
        setShowHistory(false);
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
    setShowHistory(false);

    if (vehicle.has_location) {
      const history = await fetchNui<LocationHistory[]>(
        'garageGetLocationHistory',
        vehicle.plate,
        [],
      );
      setLocationHistory(history || []);
    }
  };

  const handleRequestVehicle = async (plate: string) => {
    const result = await fetchNui<{ success?: boolean; error?: string }>(
      'garageRequestVehicle',
      { plate },
      { success: false },
    );
    if (result?.success) {
      uiAlert(t('garage.vehicle_on_way', language()) || 'Tu vehiculo te espera, sigue el GPS.');
      cache.set('garage:vehicles', null as any, 0);
      void loadVehicles();
    } else {
      uiAlert(result?.error || t('garage.request_error', language()) || 'No se pudo solicitar el vehiculo');
    }
  };

  const handlePayBail = async (plate: string) => {
    const result = await fetchNui<{ success?: boolean; paid?: number; error?: string }>(
      'garagePayBail',
      { plate },
      { success: false },
    );
    if (result?.success) {
      const msg = (t('garage.bail_paid', language()) || 'Fianza pagada') + (result.paid ? ` ($${result.paid})` : '');
      uiAlert(msg);
      cache.set('garage:vehicles', null as any, 0);
      void loadVehicles();
      setSelectedVehicle(null);
    } else {
      uiAlert(result?.error || t('garage.error', language()) || 'Error');
    }
  };

  const handleValet = async (plate: string) => {
    const result = await fetchNui<{ success?: boolean; paid?: number; error?: string }>(
      'garageRequestValet',
      { plate },
      { success: false },
    );
    if (result?.success) {
      const msg = (t('garage.valet_requested', language()) || 'Valet solicitado') + (result.paid ? ` ($${result.paid})` : '');
      uiAlert(msg);
      cache.set('garage:vehicles', null as any, 0);
      void loadVehicles();
    } else {
      uiAlert(result?.error || t('garage.error', language()) || 'Error');
    }
  };

  const handleSetWaypoint = async (vehicle: Vehicle) => {
    await fetchNui('garageSetWaypoint', {
      plate: vehicle.plate,
      x: vehicle.location_x,
      y: vehicle.location_y,
    }, { success: false });
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
    uiAlert(t('garage.share_location', language()) || 'Ubicacion compartida');
  };

  const getVehicleIcon = () => './img/icons_ios/garage.svg';

  const getStatusInfo = (vehicle: Vehicle) => {
    if (vehicle.impounded) {
      return { label: t('garage.in_depot', language()) || 'Incautado', cls: styles.statusImpounded };
    }
    if (vehicle.has_location && vehicle.location_x) {
      return { label: t('garage.on_street', language()) || 'En calle', cls: styles.statusStreet };
    }
    return { label: t('garage.in_garage', language()) || 'En Garage', cls: styles.statusGarage };
  };

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
            {(vehicle) => {
              const status = getStatusInfo(vehicle);
              return (
                <div
                  class={styles.vehicleCard}
                  onClick={() => openVehicle(vehicle)}
                >
                  <div class={styles.vehicleIcon}>
                    <img src={getVehicleIcon()} alt="" />
                  </div>

                  <div class={styles.vehicleInfo}>
                    <h3 class={styles.vehicleName}>
                      {vehicle.model_name || t('garage.vehicle', language())}
                    </h3>
                    <span class={styles.vehiclePlate}>{vehicle.plate}</span>

                    <div class={styles.vehicleMeta}>
                      <span class={`${styles.statusBadge} ${status.cls}`}>
                        {status.label}
                      </span>
                      <Show when={vehicle.garage_name && !vehicle.impounded}>
                        <span class={styles.garageName}>{vehicle.garage_name}</span>
                      </Show>
                    </div>

                    <Show when={vehicle.location_updated}>
                      <p class={styles.locationTime}>
                        {timeAgo(vehicle.location_updated)}
                      </p>
                    </Show>
                  </div>

                  <div class={styles.vehicleArrow}>
                    <img src="./img/icons_ios/ui-chevron-right.svg" alt="" />
                  </div>
                </div>
              );
            }}
          </For>

          <Show when={!loading() && filteredVehicles().length === 0}>
            <div class={styles.emptyState}>
              <p>{t('garage.no_vehicles', language())}</p>
              <p class={styles.emptyHint}>{t('garage.no_vehicles_desc', language())}</p>
            </div>
          </Show>
        </div>

        {/* ── Detail overlay ── */}
        <Show when={selectedVehicle()}>
          <div class={styles.detailOverlay}>
            <div class={styles.detailTopBar}>
              <div />
              <button
                class={styles.closeBtn}
                onClick={() => {
                  setSelectedVehicle(null);
                  setLocationHistory([]);
                  setShowHistory(false);
                }}
              >
                <img src="./img/icons_ios/ui-close.svg" alt="" />
              </button>
            </div>

            <div class={styles.detailContent}>
              {/* Header */}
              <div class={styles.detailHeader}>
                <div class={styles.detailIcon}>
                  <img src={getVehicleIcon()} alt="" />
                </div>
                <div class={styles.detailTitle}>
                  <h2>{selectedVehicle()!.model_name || t('garage.vehicle', language())}</h2>
                  <span class={styles.detailPlate}>{selectedVehicle()!.plate}</span>
                </div>
              </div>

              {/* Status */}
              <div class={styles.statusCard}>
                <Show when={selectedVehicle()!.impounded}>
                  <div class={styles.statusRow}>
                    <span class={`${styles.statusDot} ${styles.dotImpounded}`}>
                      <img src="./img/icons_ios/ui-warning.svg" alt="" />
                    </span>
                    <div class={`${styles.statusText} ${styles.textImpounded}`}>
                      <strong>{t('garage.vehicle_impounded', language())}</strong>
                      <p>{t('garage.vehicle_impounded_desc', language())}</p>
                    </div>
                  </div>
                </Show>
                <Show when={!selectedVehicle()!.impounded}>
                  <div class={styles.statusRow}>
                    <span class={`${styles.statusDot} ${styles.dotGarage}`}>
                      <img src="./img/icons_ios/ui-check.svg" alt="" />
                    </span>
                    <div class={`${styles.statusText} ${styles.textGarage}`}>
                      <strong>
                        {t('garage.in_label', language(), { garage: selectedVehicle()!.garage_name || 'Garage' })}
                      </strong>
                      <p>{t('garage.vehicle_available', language())}</p>
                    </div>
                  </div>
                </Show>
              </div>

              {/* Location info */}
              <Show when={selectedVehicle()!.has_location}>
                <div class={styles.locationCard}>
                  <h4>{t('garage.last_location', language())}</h4>
                  <Show when={selectedVehicle()!.location_updated}>
                    <p class={styles.locationTimestamp}>
                      {t('garage.saved_at', language(), { time: timeAgo(selectedVehicle()!.location_updated) })}
                    </p>
                  </Show>
                </div>
              </Show>

              {/* Action buttons (iOS settings style) */}
              <div class={styles.actionsCard}>
                {/* Pedir Vehiculo */}
                <Show when={!selectedVehicle()!.impounded}>
                  <button
                    class={styles.actionRow}
                    onClick={() => handleRequestVehicle(selectedVehicle()!.plate)}
                  >
                    <span class={styles.actionIcon}>&#128663;</span>
                    <div class={styles.actionBody}>
                      <span class={styles.actionLabel}>
                        {t('garage.request_vehicle', language()) || 'Pedir Vehiculo'}
                      </span>
                      <span class={styles.actionSub}>
                        {t('garage.request_vehicle_desc', language()) || 'Solicitar desde el garage'}
                      </span>
                    </div>
                    <span class={styles.actionChevron}>
                      <img src="./img/icons_ios/ui-chevron-right.svg" alt="" />
                    </span>
                  </button>
                </Show>

                {/* Servicio Valet */}
                <Show when={!selectedVehicle()!.impounded}>
                  <button
                    class={styles.actionRow}
                    onClick={() => handleValet(selectedVehicle()!.plate)}
                  >
                    <span class={styles.actionIcon}>&#128718;</span>
                    <div class={styles.actionBody}>
                      <span class={styles.actionLabel}>
                        {t('garage.valet_service', language()) || 'Servicio Valet'}
                      </span>
                      <span class={styles.actionSub}>
                        {t('garage.valet_service_desc', language()) || 'Entrega a domicilio'}
                      </span>
                    </div>
                    <span class={styles.actionChevron}>
                      <img src="./img/icons_ios/ui-chevron-right.svg" alt="" />
                    </span>
                  </button>
                </Show>

                {/* Pagar Fianza */}
                <Show when={!!selectedVehicle()!.impounded}>
                  <button
                    class={`${styles.actionRow} ${styles.actionDanger}`}
                    onClick={() => handlePayBail(selectedVehicle()!.plate)}
                  >
                    <span class={styles.actionIcon}>&#128176;</span>
                    <div class={styles.actionBody}>
                      <span class={styles.actionLabel}>
                        {t('garage.pay_bail', language()) || 'Pagar Fianza'}
                      </span>
                      <span class={styles.actionSub}>
                        {t('garage.pay_bail_desc', language()) || 'Pagar para recuperar el vehiculo'}
                      </span>
                    </div>
                    <span class={styles.actionChevron}>
                      <img src="./img/icons_ios/ui-chevron-right.svg" alt="" />
                    </span>
                  </button>
                </Show>

                {/* Marcar GPS */}
                <button
                  class={styles.actionRow}
                  onClick={() => handleSetWaypoint(selectedVehicle()!)}
                >
                  <span class={styles.actionIcon}>&#128205;</span>
                  <div class={styles.actionBody}>
                    <span class={styles.actionLabel}>
                      {t('garage.set_waypoint', language()) || 'Marcar GPS'}
                    </span>
                    <span class={styles.actionSub}>
                      {t('garage.set_waypoint_desc', language()) || 'Marcar ubicacion en el mapa'}
                    </span>
                  </div>
                  <span class={styles.actionChevron}>
                    <img src="./img/icons_ios/ui-chevron-right.svg" alt="" />
                  </span>
                </button>

                {/* Compartir Ubicacion */}
                <Show when={selectedVehicle()!.has_location}>
                  <button
                    class={styles.actionRow}
                    onClick={() => setShowShareModal(true)}
                  >
                    <span class={styles.actionIcon}>&#128228;</span>
                    <div class={styles.actionBody}>
                      <span class={styles.actionLabel}>
                        {t('garage.share', language()) || 'Compartir Ubicacion'}
                      </span>
                      <span class={styles.actionSub}>
                        {t('garage.share_vehicle_to', language()) || 'Enviar ubicacion a un contacto'}
                      </span>
                    </div>
                    <span class={styles.actionChevron}>
                      <img src="./img/icons_ios/ui-chevron-right.svg" alt="" />
                    </span>
                  </button>
                </Show>

                {/* Historial */}
                <Show when={locationHistory().length > 0}>
                  <button
                    class={styles.actionRow}
                    onClick={() => setShowHistory(!showHistory())}
                  >
                    <span class={styles.actionIcon}>&#128337;</span>
                    <div class={styles.actionBody}>
                      <span class={styles.actionLabel}>
                        {t('garage.location_history', language()) || 'Historial'}
                      </span>
                      <span class={styles.actionSub}>
                        {locationHistory().length} {t('garage.entries', language()) || 'registros'}
                      </span>
                    </div>
                    <span class={styles.actionChevron}>
                      <img src="./img/icons_ios/ui-chevron-right.svg" alt="" />
                    </span>
                  </button>
                </Show>
              </div>

              {/* Location History (toggled) */}
              <Show when={showHistory() && locationHistory().length > 0}>
                <div class={styles.historySection}>
                  <h4>{t('garage.location_history', language())}</h4>
                  <div class={styles.historyList}>
                    <For each={locationHistory().slice(0, 5)}>
                      {(loc) => (
                        <div class={styles.historyItem}>
                          <span class={styles.historyDot}>
                            <img src="./img/icons_ios/ui-location.svg" alt="" />
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
            </div>
          </div>
        </Show>

        {/* Share Modal */}
        <Modal
          open={showShareModal()}
          title={t('garage.share_location', language())}
          onClose={() => setShowShareModal(false)}
          size="sm"
        >
          <div class={styles.shareContent}>
            <p>{t('garage.share_vehicle_to', language())}</p>
            <input
              type="text"
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
              tone="primary"
              disabled={!sharePhone().trim()}
            />
          </ModalActions>
        </Modal>
      </div>
    </AppScaffold>
  );
}
