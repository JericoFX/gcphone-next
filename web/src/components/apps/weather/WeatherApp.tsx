import { createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { ScreenState } from '../../shared/ui/ScreenState';
import { formatDate, formatTime, getStoredLanguage, t } from '../../../i18n';
import styles from './WeatherApp.module.scss';

export function WeatherApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const [city] = createSignal('Los Santos');
  const [condition] = createSignal('Soleado');
  const [temperature] = createSignal('27°C');
  const [loading, setLoading] = createSignal(true);
  const [humidity] = createSignal('38%');
  const [wind] = createSignal('11 km/h');
  const [rainChance] = createSignal('12%');
  const [now, setNow] = createSignal(new Date());
  const weatherIcon = createMemo(() => {
    if (condition().toLowerCase().includes('lluv')) return '🌧️';
    if (condition().toLowerCase().includes('nubl')) return '☁️';
    return '☀️';
  });
  const updatedLabel = createMemo(() => formatTime(now(), language(), { hour: '2-digit', minute: '2-digit' }));
  const dateLabel = createMemo(() => formatDate(now(), language(), { weekday: 'long', month: 'long', day: 'numeric' }));

  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  });

  onMount(() => {
    const handle = setTimeout(() => setLoading(false), 120);
    const ticker = window.setInterval(() => setNow(new Date()), 30000);
    onCleanup(() => {
      clearTimeout(handle);
      window.clearInterval(ticker);
    });
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
                <h2 class={styles.city}>{city()}</h2>
              </div>
              <div class={styles.heroIcon}>{weatherIcon()}</div>
            </div>

            <div class={styles.temp}>{temperature()}</div>
            <div class={styles.conditionRow}>
              <span class={styles.condition}>{condition()}</span>
              <span class={styles.updatedAt}>{updatedLabel()}</span>
            </div>

            <div class={styles.metricsGrid}>
              <div class={styles.metricCard}><span>{t('weather.humidity', language())}</span><strong>{humidity()}</strong></div>
              <div class={styles.metricCard}><span>{t('weather.wind', language())}</span><strong>{wind()}</strong></div>
              <div class={styles.metricCard}><span>{t('weather.rain', language())}</span><strong>{rainChance()}</strong></div>
            </div>

            <div class={styles.currentFocus}>
              <p class={styles.focusLabel}>{t('weather.quick_outlook', language())}</p>
              <strong>{condition()}</strong>
              <span>{t('weather.next_hours', language())}</span>
            </div>
          </div>
        </div>
      </ScreenState>
    </AppScaffold>
  );
}
