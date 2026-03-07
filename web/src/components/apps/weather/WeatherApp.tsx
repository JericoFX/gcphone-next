import { For, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { ScreenState } from '../../shared/ui/ScreenState';
import styles from './WeatherApp.module.scss';

interface ForecastItem {
  day: string;
  condition: string;
  temp: string;
}

export function WeatherApp() {
  const router = useRouter();
  const [city] = createSignal('Los Santos');
  const [condition] = createSignal('Soleado');
  const [temperature] = createSignal('27°C');
  const [loading, setLoading] = createSignal(true);
  const [forecast] = createSignal<ForecastItem[]>([
    { day: 'Hoy', condition: 'Soleado', temp: '27°C' },
    { day: 'Mañana', condition: 'Nublado', temp: '23°C' },
    { day: 'Mié', condition: 'Lluvia', temp: '19°C' },
    { day: 'Jue', condition: 'Soleado', temp: '25°C' },
  ]);

  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  });

  onMount(() => {
    const handle = setTimeout(() => setLoading(false), 120);
    onCleanup(() => clearTimeout(handle));
  });

  return (
    <AppScaffold title="Clima" onBack={() => router.goBack()}>
        <ScreenState loading={loading()} empty={forecast().length === 0} emptyTitle="Sin clima" emptyDescription="No hay datos meteorologicos disponibles.">
        <div class={styles.hero}>
          <div class={styles.city}>{city()}</div>
          <div class={styles.temp}>{temperature()}</div>
          <div class={styles.condition}>{condition()}</div>
        </div>

        <div class="ios-section-title">Pronostico</div>
        <div class="ios-list">
          <For each={forecast()}>
            {(item) => (
              <div class="ios-row">
                <span class="ios-label">{item.day}</span>
                <span class="ios-value">{item.condition}</span>
                <span class="ios-value">{item.temp}</span>
              </div>
            )}
          </For>
        </div>
        </ScreenState>
    </AppScaffold>
  );
}
