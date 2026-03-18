import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { getStoredLanguage, t } from '../../../i18n';
import styles from './ClockApp.module.scss';

type Tab = 'clock' | 'timer' | 'stopwatch';

export function ClockApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const [tab, setTab] = createSignal<Tab>('clock');
  const [realTime, setRealTime] = createSignal(new Date());
  const [gameHour, setGameHour] = createSignal(12);
  const [gameMinute, setGameMinute] = createSignal(0);
  const [gameSecond, setGameSecond] = createSignal(0);
  const [timerInput, setTimerInput] = createSignal('60');
  const [timerSec, setTimerSec] = createSignal(0);
  const [timerRunning, setTimerRunning] = createSignal(false);
  const [stopwatchSec, setStopwatchSec] = createSignal(0);
  const [stopwatchRunning, setStopwatchRunning] = createSignal(false);

  let timerHandle: number | undefined;
  let stopwatchHandle: number | undefined;

  usePhoneKeyHandler({ Backspace: () => router.goBack() });

  const pollGameTime = async () => {
    const data = await fetchNui<{ hour?: number; minute?: number; second?: number }>('getGameTime', {}, { hour: 12, minute: 0, second: 0 });
    setGameHour(data.hour ?? 12);
    setGameMinute(data.minute ?? 0);
    setGameSecond(data.second ?? 0);
  };

  onMount(() => {
    void pollGameTime();
    const realTicker = setInterval(() => setRealTime(new Date()), 1000);
    const gameTicker = setInterval(() => void pollGameTime(), 2000);
    onCleanup(() => { clearInterval(realTicker); clearInterval(gameTicker); });
  });

  onCleanup(() => {
    if (timerHandle) clearInterval(timerHandle);
    if (stopwatchHandle) clearInterval(stopwatchHandle);
  });

  const startTimer = () => {
    const value = Math.max(0, Math.floor(Number(timerInput()) || 0));
    if (!value) return;
    setTimerSec(value);
    setTimerRunning(true);
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      setTimerSec((sec) => {
        if (sec <= 1) { clearInterval(timerHandle!); setTimerRunning(false); return 0; }
        return sec - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerHandle) clearInterval(timerHandle);
    setTimerRunning(false);
  };

  const startStopwatch = () => {
    if (stopwatchRunning()) return;
    setStopwatchRunning(true);
    stopwatchHandle = setInterval(() => setStopwatchSec((s) => s + 1), 1000);
  };

  const pauseStopwatch = () => {
    if (stopwatchHandle) clearInterval(stopwatchHandle);
    stopwatchHandle = undefined;
    setStopwatchRunning(false);
  };

  const resetStopwatch = () => { pauseStopwatch(); setStopwatchSec(0); };

  const fmt = (seconds: number) => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const realTimeStr = () => `${pad2(realTime().getHours())}:${pad2(realTime().getMinutes())}:${pad2(realTime().getSeconds())}`;
  const gameTimeStr = () => `${pad2(gameHour())}:${pad2(gameMinute())}`;

  return (
    <AppScaffold title={t('clock.title', language()) || 'Reloj'} subtitle={t('clock.subtitle', language()) || 'Hora y temporizador'} onBack={() => router.goBack()}>
      <div class="ios-segment">
        <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'clock' }} onClick={() => setTab('clock')}>
          {t('clock.tab_clock', language()) || 'Reloj'}
        </button>
        <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'timer' }} onClick={() => setTab('timer')}>
          {t('clock.tab_timer', language()) || 'Timer'}
        </button>
        <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'stopwatch' }} onClick={() => setTab('stopwatch')}>
          {t('clock.tab_stopwatch', language()) || 'Crono'}
        </button>
      </div>

      <Show when={tab() === 'clock'}>
        <div class={styles.clockDual}>
          <div class={styles.clockCard}>
            <span class={styles.clockLabel}>{t('clock.real_time', language()) || 'Hora real'}</span>
            <div class={styles.bigClock}>{realTimeStr()}</div>
            <span class={styles.clockSub}>{realTime().toLocaleDateString(language(), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
          <div class={styles.clockCard}>
            <span class={styles.clockLabel}>{t('clock.game_time', language()) || 'In-Game'}</span>
            <div class={styles.bigClock}>{gameTimeStr()}</div>
            <span class={styles.clockSub}>Los Santos</span>
          </div>
        </div>
      </Show>

      <Show when={tab() === 'timer'}>
        <div class={`ios-card ${styles.timerCard}`}>
          <div class={styles.bigClock}>{fmt(timerSec())}</div>
          <Show when={!timerRunning()}>
            <input class="ios-input" type="number" placeholder={t('clock.seconds', language()) || 'Segundos'} value={timerInput()} onInput={(e) => setTimerInput(e.currentTarget.value)} />
            <div class={styles.presetRow}>
              <button class="ios-btn" onClick={() => { setTimerInput('60'); }}>1m</button>
              <button class="ios-btn" onClick={() => { setTimerInput('300'); }}>5m</button>
              <button class="ios-btn" onClick={() => { setTimerInput('900'); }}>15m</button>
            </div>
            <button class="ios-btn ios-btn-primary" onClick={startTimer}>{t('clock.start', language()) || 'Iniciar'}</button>
          </Show>
          <Show when={timerRunning()}>
            <button class="ios-btn ios-btn-danger" onClick={stopTimer}>{t('clock.stop', language()) || 'Detener'}</button>
          </Show>
        </div>
      </Show>

      <Show when={tab() === 'stopwatch'}>
        <div class={`ios-card ${styles.timerCard}`}>
          <div class={styles.bigClock}>{fmt(stopwatchSec())}</div>
          <div class={styles.actions}>
            <Show when={!stopwatchRunning()}>
              <button class="ios-btn ios-btn-primary" onClick={startStopwatch}>{t('clock.start', language()) || 'Iniciar'}</button>
            </Show>
            <Show when={stopwatchRunning()}>
              <button class="ios-btn" onClick={pauseStopwatch}>{t('clock.pause', language()) || 'Pausa'}</button>
            </Show>
            <button class="ios-btn ios-btn-danger" onClick={resetStopwatch}>Reset</button>
          </div>
        </div>
      </Show>
    </AppScaffold>
  );
}
