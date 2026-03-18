import { createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { ScreenState } from '../../shared/ui/ScreenState';
import { formatDate, formatTime, getStoredLanguage, t } from '../../../i18n';
import styles from './WeatherApp.module.scss';

interface WeatherData {
  condition?: string;
  temperature?: number;
  gameHour?: number;
  gameMinute?: number;
  wind?: number;
  humidity?: number;
  rainChance?: number;
}

export function WeatherApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const [condition, setCondition] = createSignal('Cargando...');
  const [temperature, setTemperature] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [humidity, setHumidity] = createSignal(0);
  const [wind, setWind] = createSignal(0);
  const [rainChance, setRainChance] = createSignal(0);
  const [gameHour, setGameHour] = createSignal(12);
  const [gameMinute, setGameMinute] = createSignal(0);
  const [now, setNow] = createSignal(new Date());

  const weatherIcon = createMemo(() => {
    const c = condition().toLowerCase();
    if (c.includes('lluv') || c.includes('rain')) return '🌧️';
    if (c.includes('torment') || c.includes('thunder')) return '⛈️';
    if (c.includes('niev') || c.includes('snow') || c.includes('ventis') || c.includes('blizzard')) return '🌨️';
    if (c.includes('niebla') || c.includes('fog') || c.includes('smog')) return '🌫️';
    if (c.includes('nubl') || c.includes('cloud') || c.includes('cubiert') || c.includes('overcast')) return '☁️';
    if (c.includes('despej') || c.includes('clear') || c.includes('despe')) return '☀️';
    return '🌤️';
  });

  const updatedLabel = createMemo(() => formatTime(now(), language(), { hour: '2-digit', minute: '2-digit' }));
  const dateLabel = createMemo(() => formatDate(now(), language(), { weekday: 'long', month: 'long', day: 'numeric' }));
  const gameTimeLabel = createMemo(() => `${String(gameHour()).padStart(2, '0')}:${String(gameMinute()).padStart(2, '0')}`);

  const loadWeather = async () => {
    const data = await fetchNui<WeatherData>('getWeatherData', {}, {
      condition: 'Despejado', temperature: 24, gameHour: 14, gameMinute: 30, wind: 12, humidity: 45, rainChance: 5,
    });
    setCondition(data.condition || 'Despejado');
    setTemperature(data.temperature ?? 22);
    setGameHour(data.gameHour ?? 12);
    setGameMinute(data.gameMinute ?? 0);
    setWind(data.wind ?? 10);
    setHumidity(data.humidity ?? 40);
    setRainChance(data.rainChance ?? 0);
    setLoading(false);
  };

  usePhoneKeyHandler({ Backspace: () => router.goBack() });

  onMount(() => {
    void loadWeather();
    const ticker = window.setInterval(() => {
      setNow(new Date());
      void loadWeather();
    }, 30000);
    onCleanup(() => window.clearInterval(ticker));
  });

  return (
    <AppScaffold
      title={t('weather.title', language())}
      subtitle={t('weather.quick_outlook', language())}
      onBack={() => router.goBack()}
      bodyPadding='none'
      transparent
      bodyClass={styles.body}
    >
      <ScreenState loading={loading()} empty={false} emptyTitle={t('weather.empty_title', language())} emptyDescription={t('weather.empty_desc', language())}>
        <div class={styles.screen}>
          <div class={styles.glow} aria-hidden='true' />
          <div class={styles.hero}>
            <div class={styles.topMeta}>
              <div>
                <p class={styles.eyebrow}>{dateLabel()}</p>
                <h2 class={styles.city}>Los Santos</h2>
              </div>
              <div class={styles.heroIcon}>{weatherIcon()}</div>
            </div>

            <div class={styles.temp}>{temperature()}°C</div>
            <div class={styles.conditionRow}>
              <span class={styles.condition}>{condition()}</span>
              <span class={styles.updatedAt}>{updatedLabel()}</span>
            </div>

            <div class={styles.metricsGrid}>
              <div class={styles.metricCard}><span>{t('weather.humidity', language())}</span><strong>{humidity()}%</strong></div>
              <div class={styles.metricCard}><span>{t('weather.wind', language())}</span><strong>{wind()} km/h</strong></div>
              <div class={styles.metricCard}><span>{t('weather.rain', language())}</span><strong>{rainChance()}%</strong></div>
            </div>

            <div class={styles.currentFocus}>
              <p class={styles.focusLabel}>In-Game</p>
              <strong>{gameTimeLabel()}</strong>
              <span>{condition()}</span>
            </div>
          </div>
        </div>
      </ScreenState>
    </AppScaffold>
  );
}
