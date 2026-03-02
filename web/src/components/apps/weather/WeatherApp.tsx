import { For, createEffect, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
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

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  createEffect(() => {
    const handle = setTimeout(() => setLoading(false), 120);
    onCleanup(() => clearTimeout(handle));
  });

  return (
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>
          ‹
        </button>
        <div class="ios-nav-title">Clima</div>
      </div>

      <div class="ios-content">
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
      </div>
    </div>
  );
}
