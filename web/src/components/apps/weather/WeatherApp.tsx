import { For, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
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

interface HourlyItem {
  hour: string;
  temp: string;
  icon: string;
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
  const [hourly] = createSignal<HourlyItem[]>([
    { hour: 'Ahora', temp: '27°C', icon: '☀️' },
    { hour: '13:00', temp: '28°C', icon: '🌤️' },
    { hour: '16:00', temp: '25°C', icon: '⛅' },
    { hour: '19:00', temp: '22°C', icon: '🌥️' },
    { hour: '22:00', temp: '19°C', icon: '🌙' },
  ]);
  const [humidity] = createSignal('38%');
  const [wind] = createSignal('11 km/h');
  const [rainChance] = createSignal('12%');
  const weatherIcon = createMemo(() => {
    if (condition().toLowerCase().includes('lluv')) return '🌧️';
    if (condition().toLowerCase().includes('nubl')) return '☁️';
    return '☀️';
  });

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
    <AppScaffold title="Clima" subtitle="Panorama rapido" onBack={() => router.goBack()}>
      <ScreenState loading={loading()} empty={forecast().length === 0} emptyTitle="Sin clima" emptyDescription="No hay datos meteorologicos disponibles.">
        <div class={styles.hero}>
          <div class={styles.heroTopLine}>
            <div class={styles.city}>{city()}</div>
            <div class={styles.heroIcon}>{weatherIcon()}</div>
          </div>
          <div class={styles.temp}>{temperature()}</div>
          <div class={styles.condition}>{condition()}</div>
          <div class={styles.metricsGrid}>
            <div class={styles.metricCard}><span>Humedad</span><strong>{humidity()}</strong></div>
            <div class={styles.metricCard}><span>Viento</span><strong>{wind()}</strong></div>
            <div class={styles.metricCard}><span>Lluvia</span><strong>{rainChance()}</strong></div>
          </div>
        </div>

        <div class="ios-section-title">Proximas horas</div>
        <div class={styles.hourlyRail}>
          <For each={hourly()}>
            {(item) => (
              <div class={styles.hourCard}>
                <span>{item.hour}</span>
                <strong>{item.icon}</strong>
                <small>{item.temp}</small>
              </div>
            )}
          </For>
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
