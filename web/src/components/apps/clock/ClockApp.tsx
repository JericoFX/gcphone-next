import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { ScreenState } from '../../shared/ui/ScreenState';
import styles from './ClockApp.module.scss';

type Tab = 'alarm' | 'timer' | 'stopwatch';

interface AlarmItem {
  id: number;
  time: string;
  label: string;
  enabled: boolean;
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

  let timerHandle: number | undefined;
  let stopwatchHandle: number | undefined;

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };

    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  onCleanup(() => {
    if (timerHandle) clearInterval(timerHandle);
    if (stopwatchHandle) clearInterval(stopwatchHandle);
  });

  createEffect(() => {
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
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>
          ‹
        </button>
        <div class="ios-nav-title">Reloj</div>
      </div>

      <div class="ios-content">
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
        </Show>

        <Show when={tab() === 'timer'}>
          <div class="ios-section-title">Temporizador</div>
          <div class={`ios-card ${styles.timerCard}`}>
            <input class="ios-input" type="number" placeholder="Segundos" value={timerInput()} onInput={(e) => setTimerInput(e.currentTarget.value)} />
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
      </div>
    </div>
  );
}
