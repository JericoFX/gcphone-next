import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { ScreenState } from '../../shared/ui/ScreenState';
import styles from './ClockApp.module.scss';

type Tab = 'alarm' | 'timer' | 'stopwatch';

interface AlarmItem {
  id: number;
  time: string;
  label: string;
  enabled: boolean;
}

interface WorldClock {
  city: string;
  offsetLabel: string;
  time: string;
}

export function ClockApp() {
  const router = useRouter();
  const [tab, setTab] = createSignal<Tab>('alarm');
  const [alarms, setAlarms] = createSignal<AlarmItem[]>([
    { id: 1, time: '07:30', label: 'Trabajo', enabled: true },
    { id: 2, time: '13:00', label: 'Almuerzo', enabled: false },
  ]);
  const [timerInput, setTimerInput] = createSignal('60');
  const [timerSec, setTimerSec] = createSignal(0);
  const [stopwatchSec, setStopwatchSec] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [worldClocks] = createSignal<WorldClock[]>([
    { city: 'Los Santos', offsetLabel: 'Local', time: '08:24' },
    { city: 'Liberty City', offsetLabel: '+3 h', time: '11:24' },
    { city: 'Vice City', offsetLabel: '+1 h', time: '09:24' },
  ]);

  let timerHandle: number | undefined;
  let stopwatchHandle: number | undefined;

  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  });

  onCleanup(() => {
    if (timerHandle) clearInterval(timerHandle);
    if (stopwatchHandle) clearInterval(stopwatchHandle);
  });

  onMount(() => {
    const handle = setTimeout(() => setLoading(false), 120);
    onCleanup(() => clearTimeout(handle));
  });

  const toggleAlarm = (id: number) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  };

  const startTimer = () => {
    const value = Math.max(0, Math.floor(Number(timerInput()) || 0));
    if (!value) return;

    setTimerSec(value);
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      setTimerSec((sec) => {
        if (sec <= 1) {
          if (timerHandle) clearInterval(timerHandle);
          return 0;
        }
        return sec - 1;
      });
    }, 1000);
  };

  const startStopwatch = () => {
    if (stopwatchHandle) return;
    stopwatchHandle = setInterval(() => setStopwatchSec((s) => s + 1), 1000);
  };

  const pauseStopwatch = () => {
    if (!stopwatchHandle) return;
    clearInterval(stopwatchHandle);
    stopwatchHandle = undefined;
  };

  const resetStopwatch = () => setStopwatchSec(0);

  const applyPreset = (seconds: number) => {
    setTimerInput(String(seconds));
    setTimerSec(seconds);
  };

  const fmt = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <AppScaffold title="Reloj" subtitle="Alarmas y tiempo" onBack={() => router.goBack()}>
      <div class="ios-segment">
        <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'alarm' }} onClick={() => setTab('alarm')}>
          Alarmas
        </button>
        <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': tab() === 'timer' }} onClick={() => setTab('timer')}>
          Temporizador
        </button>
        <button
          class="ios-segment-btn"
          classList={{ 'ios-segment-btn-active': tab() === 'stopwatch' }}
          onClick={() => setTab('stopwatch')}
        >
          Cronometro
        </button>
      </div>

      <ScreenState loading={loading()} empty={false}>
        <Show when={tab() === 'alarm'}>
          <div class={styles.heroAlarm}>
            <div>
              <span>Proxima alarma</span>
              <strong>{alarms().find((alarm) => alarm.enabled)?.time || 'Sin alarmas activas'}</strong>
            </div>
            <small>{alarms().find((alarm) => alarm.enabled)?.label || 'Activa una para verla aqui'}</small>
          </div>
          <div class="ios-section-title">Mis alarmas</div>
          <div class="ios-list">
            <For each={alarms()}>
              {(alarm) => (
                <div class="ios-row">
                  <div>
                    <div class="ios-label">{alarm.time}</div>
                    <div class="ios-value">{alarm.label}</div>
                  </div>
                  <button class="ios-btn" classList={{ 'ios-btn-primary': alarm.enabled }} onClick={() => toggleAlarm(alarm.id)}>
                    {alarm.enabled ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              )}
            </For>
          </div>
          <div class="ios-section-title">Relojes mundiales</div>
          <div class="ios-list">
            <For each={worldClocks()}>
              {(clock) => (
                <div class="ios-row">
                  <div>
                    <div class="ios-label">{clock.city}</div>
                    <div class="ios-value">{clock.offsetLabel}</div>
                  </div>
                  <div class="ios-value">{clock.time}</div>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={tab() === 'timer'}>
          <div class="ios-section-title">Temporizador</div>
          <div class={`ios-card ${styles.timerCard}`}>
            <input class="ios-input" type="number" placeholder="Segundos" value={timerInput()} onInput={(e) => setTimerInput(e.currentTarget.value)} />
            <div class={styles.presetRow}>
              <button class="ios-btn" onClick={() => applyPreset(60)}>1 min</button>
              <button class="ios-btn" onClick={() => applyPreset(300)}>5 min</button>
              <button class="ios-btn" onClick={() => applyPreset(900)}>15 min</button>
            </div>
            <button class="ios-btn ios-btn-primary" onClick={startTimer}>
              Iniciar
            </button>
            <div class={styles.bigClock}>{fmt(timerSec())}</div>
          </div>
        </Show>

        <Show when={tab() === 'stopwatch'}>
          <div class="ios-section-title">Cronometro</div>
          <div class={`ios-card ${styles.timerCard}`}>
            <div class={styles.bigClock}>{fmt(stopwatchSec())}</div>
            <div class={styles.actions}>
              <button class="ios-btn ios-btn-primary" onClick={startStopwatch}>
                Iniciar
              </button>
              <button class="ios-btn" onClick={pauseStopwatch}>
                Pausa
              </button>
              <button class="ios-btn ios-btn-danger" onClick={resetStopwatch}>
                Reset
              </button>
            </div>
          </div>
        </Show>
      </ScreenState>
    </AppScaffold>
  );
}
