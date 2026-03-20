import { For, Show, createSignal, onMount, onCleanup, batch, createMemo } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeText } from '../../../utils/sanitize';
import { uiConfirm } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { EmptyState } from '../../shared/ui/EmptyState';
import { SegmentedTabs } from '../../shared/ui/SegmentedTabs';
import { LeafletMap, type LeafletPin } from '../maps/LeafletMap';
import { t } from '../../../i18n';
import { usePhone } from '../../../store/phone';
import styles from './CityRideApp.module.scss';

interface Coords {
  x: number;
  y: number;
  z: number;
}

interface RideData {
  id: number;
  passengerPhone?: string;
  driverPhone?: string;
  driverName?: string;
  driverVehicle?: string;
  driverPlate?: string;
  driverRating?: number;
  pickup?: Coords;
  dest?: Coords;
  distance: number;
  price: number;
  status: string;
  role?: string;
  createdAt?: number;
  acceptedAt?: number;
  completedAt?: number;
}

interface DriverProfile {
  id: number;
  display_name: string;
  vehicle_name: string;
  vehicle_plate: string;
  is_available: boolean;
  rating: number;
  rating_count: number;
  total_rides: number;
}

interface HistoryItem {
  id: number;
  passenger_phone?: string;
  driver_phone?: string;
  distance: number;
  price: number;
  status: string;
  created_at: string;
  completed_at: string;
  role: string;
}

type TabId = 'passenger' | 'driver';

const STATUS_ORDER = ['accepted', 'pickup', 'in_progress', 'completed'];

function formatMoney(amount: number) {
  return '$' + amount.toLocaleString('es-ES');
}

export function CityRideApp() {
  const router = useRouter();
  const [phoneState] = usePhone();
  const language = () => phoneState.settings.language || 'es';

  const tabs = () => [
    { id: 'passenger', label: t('cityride.tab.passenger', language()) },
    { id: 'driver', label: t('cityride.tab.driver', language()) },
  ];

  const getStatusLabel = (status: string) => t('cityride.status.' + status, language()) || status;

  const [activeTab, setActiveTab] = createSignal<TabId>('passenger');
  const [loading, setLoading] = createSignal(false);

  // Passenger state
  const [activeRide, setActiveRide] = createSignal<RideData | null>(null);
  const [completedRide, setCompletedRide] = createSignal<RideData | null>(null);
  const [estimatedPrice, setEstimatedPrice] = createSignal(0);
  const [estimatedDistance, setEstimatedDistance] = createSignal(0);
  const [pickupCoords, setPickupCoords] = createSignal<Coords | null>(null);
  const [destCoords, setDestCoords] = createSignal<Coords | null>(null);
  const [destInput, setDestInput] = createSignal('');
  const [rating, setRating] = createSignal(0);
  const [ratingSubmitted, setRatingSubmitted] = createSignal(false);

  // Driver state
  const [driverProfile, setDriverProfile] = createSignal<DriverProfile | null>(null);
  const [availableRides, setAvailableRides] = createSignal<RideData[]>([]);
  const [driverActiveRide, setDriverActiveRide] = createSignal<RideData | null>(null);
  const [vehicleNameInput, setVehicleNameInput] = createSignal('');
  const [vehiclePlateInput, setVehiclePlateInput] = createSignal('');

  // History
  const [history, setHistory] = createSignal<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = createSignal(false);

  // Map picker
  const [showMap, setShowMap] = createSignal(false);
  const [mapTarget, setMapTarget] = createSignal<'pickup' | 'dest'>('dest');

  // Driver count
  const [availableDriverCount, setAvailableDriverCount] = createSignal<number | null>(null);

  const isDriverRegistered = createMemo(() => driverProfile() !== null);

  const loadState = async () => {
    setLoading(true);
    const [ride, profile, hist, driverCount] = await Promise.all([
      fetchNui<RideData | false>('cityrideGetActiveRide', {}, false),
      fetchNui<DriverProfile | false>('cityrideGetDriverProfile', {}, false),
      fetchNui<HistoryItem[]>('cityrideGetRideHistory', {}, []),
      fetchNui<{ count: number }>('cityrideGetAvailableDriverCount', {}, { count: 0 }),
    ]);

    batch(() => {
      if (ride && typeof ride === 'object' && ride.id) {
        if (ride.role === 'driver') {
          setDriverActiveRide(ride);
          setActiveRide(null);
        } else {
          setActiveRide(ride);
          setDriverActiveRide(null);
        }
      } else {
        setActiveRide(null);
        setDriverActiveRide(null);
      }

      if (profile && typeof profile === 'object' && profile.id) {
        setDriverProfile(profile);
        setVehicleNameInput(profile.vehicle_name || '');
        setVehiclePlateInput(profile.vehicle_plate || '');
      } else {
        setDriverProfile(null);
      }

      setHistory(hist || []);
      setAvailableDriverCount(driverCount?.count ?? 0);
      setLoading(false);
    });
  };

  onMount(() => {
    void loadState();
  });

  // Listen for NUI messages from client events
  onMount(() => {
    const handler = (e: MessageEvent) => {
      const { action, data } = e.data || {};
      if (action === 'cityRideNewRequest') {
        if (data && activeTab() === 'driver') {
          setAvailableRides((prev) => {
            const exists = prev.some((r) => r.id === data.id);
            return exists ? prev : [...prev, data];
          });
        }
      } else if (action === 'cityRideAccepted') {
        if (data) setActiveRide(data);
      } else if (action === 'cityRideUpdate') {
        if (data) {
          setActiveRide((prev) => (prev && prev.id === data.id ? data : prev));
          setDriverActiveRide((prev) => (prev && prev.id === data.id ? data : prev));
        }
      } else if (action === 'cityRideCancelled') {
        if (data) {
          setActiveRide((prev) => (prev && prev.id === data.rideId ? null : prev));
          setDriverActiveRide((prev) => (prev && prev.id === data.rideId ? null : prev));
          uiAlert(t('cityride.cancelled', language()), 'CityRide');
        }
      } else if (action === 'cityRideCompleted') {
        if (data) {
          setDriverActiveRide(null);
          if (activeRide()?.id === data.id) {
            setActiveRide(null);
            setCompletedRide(data);
          }
        }
      }
    };
    window.addEventListener('message', handler);
    onCleanup(() => window.removeEventListener('message', handler));
  });

  usePhoneKeyHandler({
    Backspace: () => {
      if (showMap()) {
        setShowMap(false);
        return;
      }
      if (showHistory()) {
        setShowHistory(false);
        return;
      }
      if (completedRide()) {
        setCompletedRide(null);
        return;
      }
      router.goBack();
    },
  });

  // ── Passenger Actions ──

  const getPlayerCoords = async (): Promise<Coords> => {
    const coords = await fetchNui<Coords>('cityrideGetPlayerCoords', {}, { x: 0, y: 0, z: 0 });
    return coords;
  };

  const useCurrentLocation = async () => {
    const coords = await getPlayerCoords();
    setPickupCoords(coords);
  };

  const openMapPicker = (target: 'pickup' | 'dest') => {
    setMapTarget(target);
    setShowMap(true);
  };

  const handleMapPickCoords = (x: number, y: number) => {
    if (mapTarget() === 'pickup') {
      setPickupCoords({ x, y, z: 0 });
    } else {
      setDestCoords({ x, y, z: 0 });
    }
    setShowMap(false);
    updateEstimate();
  };

  const mapPins = createMemo<LeafletPin[]>(() => {
    const pins: LeafletPin[] = [];
    const pickup = pickupCoords();
    const dest = destCoords();
    if (pickup) pins.push({ id: 'pickup', label: t('cityride.pickup_label', language()), x: pickup.x, y: pickup.y, kind: 'manual' });
    if (dest) pins.push({ id: 'dest', label: t('cityride.dest_label', language()), x: dest.x, y: dest.y, kind: 'manual' });
    return pins;
  });

  const updateEstimate = async () => {
    const pickup = pickupCoords();
    const dest = destCoords();
    if (!pickup || !dest) return;

    const result = await fetchNui<{ price: number; distance: number }>('cityrideEstimatePrice', { pickup, dest }, { price: 0, distance: 0 });
    setEstimatedPrice(result.price);
    setEstimatedDistance(result.distance);
  };

  const requestRide = async () => {
    const pickup = pickupCoords();
    const dest = destCoords();
    if (!pickup || !dest) {
      uiAlert(t('cityride.select_locations', language()), 'CityRide');
      return;
    }

    const result = await fetchNui<{ success?: boolean; ride?: RideData; error?: string }>('cityrideRequestRide', { pickup, dest }, { success: false });
    if (result.success && result.ride) {
      setActiveRide(result.ride);
    } else {
      uiAlert(result.error || t('cityride.request_failed', language()), 'CityRide');
    }
  };

  const cancelRide = async (rideId: number) => {
    const ok = await uiConfirm(t('cityride.cancel_confirm', language()), { title: 'CityRide' });
    if (!ok) return;

    const result = await fetchNui<{ success?: boolean; error?: string }>('cityrideCancelRide', { rideId }, { success: false });
    if (result.success) {
      setActiveRide(null);
      setDriverActiveRide(null);
    } else {
      uiAlert(result.error || t('cityride.cancel_failed', language()), 'CityRide');
    }
  };

  const setWaypoint = (coords: Coords | undefined) => {
    if (!coords) return;
    void fetchNui('cityrideSetWaypoint', { x: coords.x, y: coords.y }, {});
  };

  const submitRating = async () => {
    const ride = completedRide();
    if (!ride || rating() < 1) return;

    const result = await fetchNui<{ success?: boolean; error?: string }>('cityrideRateDriver', { rideId: ride.id, score: rating() }, { success: false });
    if (result.success) {
      setRatingSubmitted(true);
    } else {
      uiAlert(result.error || t('cityride.rate_failed', language()), 'CityRide');
    }
  };

  // ── Driver Actions ──

  const registerDriver = async () => {
    const vName = sanitizeText(vehicleNameInput(), 50);
    const vPlate = sanitizeText(vehiclePlateInput(), 10);
    if (!vName || !vPlate) {
      uiAlert(t('cityride.vehicle_data_required', language()), 'CityRide');
      return;
    }

    const result = await fetchNui<{ success?: boolean; error?: string }>('cityrideRegisterDriver', { vehicle_name: vName, vehicle_plate: vPlate }, { success: false });
    if (result.success) {
      void loadState();
    } else {
      uiAlert(result.error || t('cityride.register_failed', language()), 'CityRide');
    }
  };

  const updateVehicle = async () => {
    const vName = sanitizeText(vehicleNameInput(), 50);
    const vPlate = sanitizeText(vehiclePlateInput(), 10);
    if (!vName || !vPlate) return;

    const result = await fetchNui<{ success?: boolean; error?: string }>('cityrideUpdateDriver', { vehicle_name: vName, vehicle_plate: vPlate }, { success: false });
    if (result.success) {
      void loadState();
    } else {
      uiAlert(result.error || t('cityride.update_failed', language()), 'CityRide');
    }
  };

  const toggleAvailability = async () => {
    const profile = driverProfile();
    if (!profile) return;

    const result = await fetchNui<{ success?: boolean; is_available?: boolean; error?: string }>(
      'cityrideSetDriverAvailability',
      { available: !profile.is_available },
      { success: false }
    );
    if (result.success) {
      setDriverProfile({ ...profile, is_available: result.is_available ?? !profile.is_available });
      if (result.is_available) {
        const rides = await fetchNui<RideData[]>('cityrideGetAvailableRides', {}, []);
        setAvailableRides(rides);
      }
    }
  };

  const acceptRide = async (rideId: number) => {
    const result = await fetchNui<{ success?: boolean; ride?: RideData; error?: string }>('cityrideAcceptRide', { rideId }, { success: false });
    if (result.success && result.ride) {
      setDriverActiveRide(result.ride);
      setAvailableRides([]);
    } else {
      uiAlert(result.error || t('cityride.accept_failed', language()), 'CityRide');
      setAvailableRides((prev) => prev.filter((r) => r.id !== rideId));
    }
  };

  const confirmPickup = async (rideId: number, status: string) => {
    const result = await fetchNui<{ success?: boolean; ride?: RideData; error?: string }>('cityrideConfirmPickup', { rideId, status }, { success: false });
    if (result.success && result.ride) {
      setDriverActiveRide(result.ride);
    } else {
      uiAlert(result.error || t('cityride.error_generic', language()), 'CityRide');
    }
  };

  const completeRide = async (rideId: number) => {
    const ok = await uiConfirm(t('cityride.complete_confirm', language()), { title: 'CityRide' });
    if (!ok) return;

    const result = await fetchNui<{ success?: boolean; ride?: RideData; error?: string }>('cityrideCompleteRide', { rideId }, { success: false });
    if (result.success) {
      setDriverActiveRide(null);
      void loadState();
    } else {
      uiAlert(result.error || t('cityride.complete_failed', language()), 'CityRide');
    }
  };

  const loadAvailableRides = async () => {
    const rides = await fetchNui<RideData[]>('cityrideGetAvailableRides', {}, []);
    setAvailableRides(rides);
  };

  // ── Render helpers ──

  const getStatusStepIndex = (status: string) => STATUS_ORDER.indexOf(status);

  const PassengerCompletedView = (props: { ride: RideData }) => (
    <div class={styles.section}>
      <div class={styles.rideCompleteView}>
        <div class={styles.completeIcon}>&#10003;</div>
        <div class={styles.completeSummary}>
          <div class={styles.completePrice}>{formatMoney(props.ride.price)}</div>
          <div class={styles.completeDistance}>{props.ride.distance.toFixed(1)} m</div>
        </div>

        <Show when={!ratingSubmitted()}>
          <div class={styles.ratingSection}>
            <span class={styles.ratingLabel}>{t('cityride.rate_driver', language())}</span>
            <div class={styles.stars}>
              <For each={[1, 2, 3, 4, 5]}>
                {(star) => (
                  <button
                    class={styles.star}
                    classList={{ [styles.starActive]: rating() >= star }}
                    onClick={() => setRating(star)}
                    type="button"
                  >
                    &#9733;
                  </button>
                )}
              </For>
            </div>
            <button class={styles.requestBtn} onClick={submitRating} disabled={rating() < 1} type="button">
              {t('cityride.rate_btn', language())}
            </button>
          </div>
        </Show>

        <Show when={ratingSubmitted()}>
          <p class={styles.formLabel} style={{ 'text-align': 'center' }}>{t('cityride.rate_thanks', language())}</p>
        </Show>

        <button class={styles.cancelBtn} onClick={() => { setCompletedRide(null); setRating(0); setRatingSubmitted(false); }} type="button">
          {t('common.close', language())}
        </button>
      </div>
    </div>
  );

  const PassengerWaitingView = (props: { ride: RideData }) => (
    <div class={styles.section}>
      <div class={styles.waitingView}>
        <div class={styles.spinner} />
        <span class={styles.waitingText}>{t('cityride.searching', language())}</span>
        <span class={styles.waitingPrice}>{formatMoney(props.ride.price)}</span>
        <button class={styles.cancelBtn} onClick={() => cancelRide(props.ride.id)} type="button">
          {t('cityride.cancel', language())}
        </button>
      </div>
    </div>
  );

  const PassengerActiveView = (props: { ride: RideData }) => (
    <div class={styles.section}>
      <div class={styles.rideActiveView}>
        <div class={styles.driverCard}>
          <div class={styles.driverAvatar}>
            {(props.ride.driverName || 'C')[0].toUpperCase()}
          </div>
          <div class={styles.driverInfo}>
            <p class={styles.driverName}>{props.ride.driverName || t('cityride.driver_label', language())}</p>
            <span class={styles.driverVehicle}>
              {props.ride.driverVehicle || ''} - {props.ride.driverPlate || ''}
            </span>
          </div>
          <Show when={props.ride.driverRating && props.ride.driverRating > 0}>
            <span class={styles.driverRatingBadge}>&#9733; {props.ride.driverRating?.toFixed(1)}</span>
          </Show>
        </div>

        <div class={styles.statusSteps}>
          <For each={STATUS_ORDER}>
            {(step, i) => {
              const current = getStatusStepIndex(props.ride.status);
              const idx = i();
              const isActive = idx === current;
              const isCompleted = idx < current;
              return (
                <div
                  class={styles.step}
                  classList={{
                    [styles.stepActive]: isActive,
                    [styles.stepCompleted]: isCompleted,
                  }}
                >
                  <div class={styles.stepDot} />
                  <span class={styles.stepLabel}>{getStatusLabel(step)}</span>
                  <Show when={idx < STATUS_ORDER.length - 1}>
                    <div class={styles.stepLine} />
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        <div class={styles.priceEstimate}>
          <span class={styles.priceLabel}>{t('cityride.price', language())}</span>
          <span class={styles.priceValue}>{formatMoney(props.ride.price)}</span>
        </div>

        <div class={styles.actionRow}>
          <button class={styles.actionBtn} onClick={() => setWaypoint(props.ride.pickup)} type="button">
            {t('cityride.gps_pickup', language())}
          </button>
          <button class={styles.actionBtn} onClick={() => setWaypoint(props.ride.dest)} type="button">
            {t('cityride.gps_dest', language())}
          </button>
        </div>

        <Show when={props.ride.status !== 'in_progress'}>
          <button class={styles.cancelBtn} onClick={() => cancelRide(props.ride.id)} type="button">
            {t('cityride.cancel_ride', language())}
          </button>
        </Show>
      </div>
    </div>
  );

  const PassengerRequestForm = () => (
    <div class={styles.section}>
      <Show when={availableDriverCount() !== null}>
        <div class={styles.driverCountBadge} classList={{ [styles.driverCountZero]: availableDriverCount() === 0 }}>
          <Show when={availableDriverCount()! > 0} fallback={
            <span>{t('cityride.no_drivers', language())}</span>
          }>
            <span>{t('cityride.drivers_count', language(), { count: availableDriverCount()!, plural: availableDriverCount()! !== 1 ? 'es' : '', plurals: availableDriverCount()! !== 1 ? 's' : '' })}</span>
          </Show>
        </div>
      </Show>

      <div class={styles.requestForm}>
        <p class={styles.formLabel}>{t('cityride.pickup_label', language())}</p>
        <div class={styles.coordsRow}>
          <Show when={pickupCoords()} fallback={<span class={styles.distanceValue}>{t('cityride.no_location', language())}</span>}>
            <span class={styles.distanceValue}>
              {pickupCoords()!.x.toFixed(0)}, {pickupCoords()!.y.toFixed(0)}
            </span>
          </Show>
          <button class={styles.gpsBtn} onClick={useCurrentLocation} type="button">
            {t('cityride.my_gps', language())}
          </button>
          <button class={styles.gpsBtn} onClick={() => openMapPicker('pickup')} type="button">
            {t('cityride.map', language())}
          </button>
        </div>

        <p class={styles.formLabel}>{t('cityride.dest_label', language())}</p>
        <div class={styles.coordsRow}>
          <input
            class={styles.formInput}
            type="text"
            placeholder={t('cityride.dest_placeholder', language())}
            value={destInput()}
            onInput={(e) => setDestInput(e.currentTarget.value)}
          />
          <button class={styles.gpsBtn} onClick={() => openMapPicker('dest')} type="button">
            {t('cityride.map', language())}
          </button>
        </div>

        <Show when={estimatedPrice() > 0}>
          <div class={styles.priceEstimate}>
            <div>
              <span class={styles.priceLabel}>{t('cityride.estimated', language())}</span>
              <div class={styles.distanceValue}>{estimatedDistance().toFixed(0)} m</div>
            </div>
            <span class={styles.priceValue}>{formatMoney(estimatedPrice())}</span>
          </div>
        </Show>

        <button
          class={styles.requestBtn}
          onClick={requestRide}
          disabled={!pickupCoords() || !destCoords()}
          type="button"
        >
          {t('cityride.request_ride', language())}
        </button>
      </div>

      <Show when={history().length > 0}>
        <button class={styles.actionBtn} onClick={() => setShowHistory(true)} type="button" style={{ width: '100%' }}>
          {t('cityride.view_history', language())}
        </button>
      </Show>
    </div>
  );

  const PassengerView = () => (
    <>
      <Show when={completedRide()}>
        {(completed) => <PassengerCompletedView ride={completed()} />}
      </Show>
      <Show when={!completedRide() && activeRide()}>
        {(ride) => (
          <Show when={ride().status === 'requested'} fallback={<PassengerActiveView ride={ride()} />}>
            <PassengerWaitingView ride={ride()} />
          </Show>
        )}
      </Show>
      <Show when={!completedRide() && !activeRide()}>
        <PassengerRequestForm />
      </Show>
    </>
  );

  const DriverActiveRideView = (props: { ride: RideData }) => (
    <div class={styles.section}>
      <div class={styles.rideActiveView}>
        <div class={styles.driverCard}>
          <div class={styles.driverAvatar}>P</div>
          <div class={styles.driverInfo}>
            <p class={styles.driverName}>{t('cityride.passenger_label', language())}</p>
            <span class={styles.driverVehicle}>{props.ride.passengerPhone || ''}</span>
          </div>
          <span class={styles.driverRatingBadge}>{formatMoney(props.ride.price)}</span>
        </div>

        <div class={styles.statusSteps}>
          <For each={STATUS_ORDER}>
            {(step, i) => {
              const current = getStatusStepIndex(props.ride.status);
              const idx = i();
              return (
                <div
                  class={styles.step}
                  classList={{
                    [styles.stepActive]: idx === current,
                    [styles.stepCompleted]: idx < current,
                  }}
                >
                  <div class={styles.stepDot} />
                  <span class={styles.stepLabel}>{getStatusLabel(step)}</span>
                  <Show when={idx < STATUS_ORDER.length - 1}>
                    <div class={styles.stepLine} />
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        <div class={styles.actionRow}>
          <button class={styles.actionBtn} onClick={() => setWaypoint(props.ride.pickup)} type="button">
            {t('cityride.gps_pickup', language())}
          </button>
          <button class={styles.actionBtn} onClick={() => setWaypoint(props.ride.dest)} type="button">
            {t('cityride.gps_dest', language())}
          </button>
        </div>

        <Show when={props.ride.status === 'accepted'}>
          <button class={styles.progressBtn} onClick={() => confirmPickup(props.ride.id, 'pickup')} type="button">
            {t('cityride.confirm_pickup', language())}
          </button>
        </Show>
        <Show when={props.ride.status === 'pickup'}>
          <button class={styles.progressBtn} onClick={() => confirmPickup(props.ride.id, 'in_progress')} type="button">
            {t('cityride.start_ride', language())}
          </button>
        </Show>
        <Show when={props.ride.status === 'in_progress'}>
          <button class={styles.progressBtn} onClick={() => completeRide(props.ride.id)} type="button">
            {t('cityride.complete_ride', language())}
          </button>
        </Show>

        <Show when={props.ride.status !== 'in_progress'}>
          <button class={styles.cancelBtn} onClick={() => cancelRide(props.ride.id)} type="button">
            {t('cityride.cancel', language())}
          </button>
        </Show>
      </div>
    </div>
  );

  const DriverRegistrationForm = () => (
    <div class={styles.section}>
      <div class={styles.registrationForm}>
        <h3 class={styles.registrationTitle}>{t('cityride.register_title', language())}</h3>
        <p class={styles.registrationHint}>{t('cityride.register_hint', language())}</p>

        <p class={styles.formLabel}>{t('cityride.vehicle_name', language())}</p>
        <input
          class={styles.formInput}
          type="text"
          placeholder="Ej: Sultan RS"
          value={vehicleNameInput()}
          onInput={(e) => setVehicleNameInput(e.currentTarget.value)}
          maxLength={50}
        />

        <p class={styles.formLabel}>{t('cityride.vehicle_plate', language())}</p>
        <input
          class={styles.formInput}
          type="text"
          placeholder="Ej: ABC 123"
          value={vehiclePlateInput()}
          onInput={(e) => setVehiclePlateInput(e.currentTarget.value)}
          maxLength={10}
        />

        <button class={styles.requestBtn} onClick={registerDriver} type="button">
          {t('cityride.register_btn', language())}
        </button>
      </div>
    </div>
  );

  const DriverDashboard = (props: { profile: DriverProfile }) => (
    <div class={styles.section}>
      <div class={styles.driverView}>
        <div class={styles.profileCard}>
          <div class={styles.driverAvatar}>
            {(props.profile.display_name || 'C')[0].toUpperCase()}
          </div>
          <div class={styles.profileInfo}>
            <p class={styles.profileName}>{props.profile.display_name}</p>
            <span class={styles.profileStats}>
              {t('cityride.rides_count', language(), { count: props.profile.total_rides })}
              <Show when={props.profile.rating > 0}>
                {' '} &middot; &#9733; {props.profile.rating.toFixed(1)} ({props.profile.rating_count})
              </Show>
            </span>
          </div>
          <Show when={props.profile.is_available} fallback={<span class={styles.offlineBadge}>Offline</span>}>
            <span class={styles.onlineBadge}>Online</span>
          </Show>
        </div>

        <div class={styles.toggleRow}>
          <span class={styles.toggleLabel}>{t('cityride.available_toggle', language())}</span>
          <button
            class={styles.toggleSwitch}
            classList={{ [styles.toggleOn]: props.profile.is_available }}
            onClick={toggleAvailability}
            type="button"
          />
        </div>

        <div class={styles.editForm}>
          <h4 class={styles.editFormTitle}>{t('cityride.vehicle_section', language())}</h4>
          <div class={styles.editRow}>
            <input
              class={styles.formInput}
              type="text"
              placeholder={t('cityride.vehicle_section', language())}
              value={vehicleNameInput()}
              onInput={(e) => setVehicleNameInput(e.currentTarget.value)}
              maxLength={50}
            />
            <input
              class={styles.formInput}
              type="text"
              placeholder={t('cityride.vehicle_plate', language())}
              value={vehiclePlateInput()}
              onInput={(e) => setVehiclePlateInput(e.currentTarget.value)}
              maxLength={10}
            />
          </div>
          <button class={styles.saveBtn} onClick={updateVehicle} type="button">
            {t('common.save', language())}
          </button>
        </div>

        <Show when={props.profile.is_available}>
          <p class={styles.sectionHeader}>{t('cityride.available_rides', language())}</p>
          <Show when={availableRides().length === 0}>
            <EmptyState title={t('cityride.no_requests', language())} description={t('cityride.no_requests_desc', language())} />
          </Show>
          <For each={availableRides()}>
            {(ride) => (
              <div class={styles.requestCard}>
                <div class={styles.requestCardHeader}>
                  <span class={styles.requestCardPrice}>{formatMoney(ride.price)}</span>
                  <span class={styles.requestCardDistance}>{ride.distance.toFixed(0)} m</span>
                </div>
                <Show when={ride.passengerPhone}>
                  <span class={styles.requestCardPhone}>{ride.passengerPhone}</span>
                </Show>
                <button class={styles.acceptBtn} onClick={() => acceptRide(ride.id)} type="button">
                  {t('cityride.accept_ride', language())}
                </button>
              </div>
            )}
          </For>
          <button class={styles.actionBtn} onClick={loadAvailableRides} type="button" style={{ width: '100%' }}>
            {t('common.update', language())}
          </button>
        </Show>

        <Show when={history().length > 0}>
          <button class={styles.actionBtn} onClick={() => setShowHistory(true)} type="button" style={{ width: '100%', 'margin-top': 'var(--s-2)' }}>
            {t('cityride.view_history', language())}
          </button>
        </Show>
      </div>
    </div>
  );

  const DriverView = () => (
    <>
      <Show when={driverActiveRide()}>
        {(ride) => <DriverActiveRideView ride={ride()} />}
      </Show>
      <Show when={!driverActiveRide() && !driverProfile()}>
        <DriverRegistrationForm />
      </Show>
      <Show when={!driverActiveRide() && driverProfile()}>
        {(profile) => <DriverDashboard profile={profile()} />}
      </Show>
    </>
  );

  const HistoryView = () => (
    <div class={styles.section}>
      <p class={styles.sectionHeader}>{t('cityride.history_title', language())}</p>
      <Show when={history().length === 0}>
        <EmptyState title={t('cityride.no_history', language())} description={t('cityride.no_history_desc', language())} />
      </Show>
      <div class={styles.historyList}>
        <For each={history()}>
          {(item) => (
            <div class={styles.historyCard}>
              <div class={styles.historyCardInfo}>
                <span class={styles.historyCardDate}>{item.completed_at || item.created_at}</span>
                <span class={styles.historyCardRole}>{item.role === 'driver' ? 'Conductor' : 'Pasajero'}</span>
              </div>
              <span
                class={styles.historyCardPrice}
                classList={{ [styles.historyCardOut]: item.role === 'passenger' }}
              >
                {item.role === 'passenger' ? '-' : '+'}{formatMoney(item.price)}
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );

  return (
    <AppScaffold
      title="CityRide"
      onBack={() => {
        if (showMap()) {
          setShowMap(false);
          return;
        }
        if (showHistory()) {
          setShowHistory(false);
          return;
        }
        if (completedRide()) {
          setCompletedRide(null);
          return;
        }
        router.goBack();
      }}
      bodyClass={styles.body}
    >
      <Show when={showMap()}>
        <div class={styles.mapOverlay}>
          <div class={styles.mapHeader}>
            <span>Selecciona {mapTarget() === 'pickup' ? 'recogida' : 'destino'}</span>
            <button class={styles.mapCloseBtn} onClick={() => setShowMap(false)} type="button">Cerrar</button>
          </div>
          <div class={styles.mapContainer}>
            <LeafletMap
              pins={mapPins()}
              onPickCoords={handleMapPickCoords}
            />
          </div>
        </div>
      </Show>

      <div class={styles.rideApp}>
        <Show when={!showHistory()}>
          <div class={styles.tabs}>
            <SegmentedTabs items={tabs()} active={activeTab()} onChange={(id) => setActiveTab(id as TabId)} />
          </div>
        </Show>

        <Show when={loading()}>
          <div class={styles.loading}>Cargando...</div>
        </Show>

        <Show when={!loading()}>
          <Show when={showHistory()}>
            <HistoryView />
          </Show>

          <Show when={!showHistory()}>
            <Show when={activeTab() === 'passenger'}>
              <PassengerView />
            </Show>
            <Show when={activeTab() === 'driver'}>
              <DriverView />
            </Show>
          </Show>
        </Show>
      </div>
    </AppScaffold>
  );
}
