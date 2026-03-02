import { createEffect, createSignal, For, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import styles from './GarageApp.module.scss';

interface GarageVehicle {
  plate: string;
  model_name?: string;
  garage_name?: string;
  impounded?: boolean;
}

export function GarageApp() {
  const router = useRouter();
  const [vehicles, setVehicles] = createSignal<GarageVehicle[]>([]);
  const [sharePhone, setSharePhone] = createSignal('');

  const load = async () => {
    const result = await fetchNui<GarageVehicle[]>('garageGetVehicles', {}, []);
    setVehicles(result || []);
  };

  createEffect(() => {
    void load();
  });

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const requestVehicle = async (plate: string) => {
    await fetchNui('garageRequestVehicle', { plate });
  };

  const shareLocation = async (plate: string) => {
    if (!sharePhone().trim()) return;
    await fetchNui('garageShareLocation', {
      phoneNumber: sharePhone().trim(),
      x: 0,
      y: 0,
      z: 0,
      message: `Ubicacion del vehiculo ${plate}`
    });
    setSharePhone('');
  };

  return (
    <div class={styles.app}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={() => router.goBack()}>‹</button>
        <h1>Garage</h1>
      </div>

      <div class={styles.shareBar}>
        <input
          type="text"
          placeholder="Numero para compartir"
          value={sharePhone()}
          onInput={(e) => setSharePhone(e.currentTarget.value)}
        />
      </div>

      <div class={styles.list}>
        <For each={vehicles()}>
          {(vehicle) => (
            <article class={styles.card}>
              <strong>{vehicle.model_name || 'Vehiculo'} · {vehicle.plate}</strong>
              <p>{vehicle.garage_name || 'Sin ubicacion'} {vehicle.impounded ? '(Depositado)' : ''}</p>
              <div class={styles.actions}>
                <button onClick={() => requestVehicle(vehicle.plate)}>Solicitar</button>
                <button class={styles.primary} onClick={() => shareLocation(vehicle.plate)}>Compartir</button>
              </div>
            </article>
          )}
        </For>
      </div>
    </div>
  );
}
