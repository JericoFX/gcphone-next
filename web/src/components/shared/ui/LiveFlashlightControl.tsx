import { createSignal, JSX, Show } from 'solid-js';
import styles from './LiveFlashlightControl.module.scss';

interface RangeValue {
  min: number;
  max: number;
}

interface LiveFlashlightControlProps {
  visible: boolean;
  enabled: boolean;
  panelOpen: boolean;
  kelvin: number;
  lumens: number;
  kelvinRange: RangeValue;
  lumensRange: RangeValue;
  buttonLabel: JSX.Element;
  buttonTitle?: string;
  theme?: 'dark' | 'light';
  variant?: 'circle' | 'pill';
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onKelvinInput: (value: number) => void;
  onLumensInput: (value: number) => void;
  onPreset: (kelvin: number, lumens: number) => void;
}

export function LiveFlashlightControl(props: LiveFlashlightControlProps) {
  let sliderRef: HTMLDivElement | undefined;
  const [dragging, setDragging] = createSignal(false);

  const lumensPercent = () => {
    const range = props.lumensRange;
    return ((props.lumens - range.min) / (range.max - range.min)) * 100;
  };

  const handleSliderDrag = (clientY: number) => {
    if (!sliderRef) return;
    const rect = sliderRef.getBoundingClientRect();
    const offsetFromBottom = rect.bottom - clientY;
    const ratio = Math.max(0, Math.min(1, offsetFromBottom / rect.height));
    const range = props.lumensRange;
    const step = 50;
    const raw = range.min + ratio * (range.max - range.min);
    const snapped = Math.round(raw / step) * step;
    const clamped = Math.max(range.min, Math.min(range.max, snapped));
    props.onLumensInput(clamped);
  };

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handleSliderDrag(e.clientY);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging()) return;
    handleSliderDrag(e.clientY);
  };

  const onPointerUp = () => {
    setDragging(false);
  };

  return (
    <Show when={props.visible}>
      <div class={styles.dock}>
        {/* Toggle button (tap on/off, long-press opens slider) */}
        <button
          class={styles.button}
          classList={{
            [styles.buttonActive]: props.enabled,
            [styles.buttonLight]: props.theme === 'light',
            [styles.buttonPill]: props.variant === 'pill',
          }}
          onPointerDown={props.onPointerDown}
          onPointerUp={props.onPointerUp}
          onPointerLeave={props.onPointerLeave}
          onPointerCancel={props.onPointerCancel}
          title={props.buttonTitle || 'Linterna'}
        >
          {props.buttonLabel}
        </button>

        {/* iOS 18 vertical slider — appears on long press */}
        <Show when={props.panelOpen}>
          <div
            class={styles.slider}
            classList={{ [styles.sliderLight]: props.theme === 'light' }}
          >
            {/* Vertical drag track */}
            <div
              ref={sliderRef}
              class={styles.sliderTrack}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                class={styles.sliderFill}
                style={{ height: `${lumensPercent()}%` }}
              />
              <div class={styles.sliderIcon}>
                <img src="./img/icons_ios/ui-flashlight.svg" alt="" draggable={false} />
              </div>
            </div>

            {/* Value label */}
            <div class={styles.sliderValue}>
              {props.lumens}<small>lm</small>
            </div>

            {/* Color temperature presets */}
            <div class={styles.sliderPresets}>
              <button
                type="button"
                classList={{ [styles.presetActive]: props.kelvin <= 3800 }}
                onClick={() => props.onPreset(3200, props.lumens)}
                title="Calida"
              >
                <span class={styles.presetDot} style={{ background: '#ffb347' }} />
              </button>
              <button
                type="button"
                classList={{ [styles.presetActive]: props.kelvin > 3800 && props.kelvin < 6400 }}
                onClick={() => props.onPreset(5200, props.lumens)}
                title="Neutra"
              >
                <span class={styles.presetDot} style={{ background: '#fffbe6' }} />
              </button>
              <button
                type="button"
                classList={{ [styles.presetActive]: props.kelvin >= 6400 }}
                onClick={() => props.onPreset(7600, props.lumens)}
                title="Fria"
              >
                <span class={styles.presetDot} style={{ background: '#c8e6ff' }} />
              </button>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
