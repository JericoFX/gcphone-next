import { JSX, Show } from 'solid-js';
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
  return (
    <Show when={props.visible}>
      <div class={styles.dock}>
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

        <Show when={props.enabled}>
          <div class={styles.badge} classList={{ [styles.badgeLight]: props.theme === 'light' }}>
            {props.kelvin}K · {props.lumens}lm
          </div>
        </Show>

        <Show when={props.panelOpen}>
          <div class={styles.panel} classList={{ [styles.panelLight]: props.theme === 'light' }}>
            <div class={styles.panelHeader}>
              <strong>Tono de linterna</strong>
              <span>Manten presionado para abrir</span>
            </div>

            <div class={styles.stats}>
              <span>{props.kelvin}K</span>
              <span>{props.lumens} lm</span>
            </div>

            <label class={styles.control}>
              <span>Kelvin</span>
              <input
                type="range"
                min={props.kelvinRange.min}
                max={props.kelvinRange.max}
                step="100"
                value={props.kelvin}
                onInput={(event) => props.onKelvinInput(Number(event.currentTarget.value))}
              />
            </label>

            <label class={styles.control}>
              <span>Lumenes</span>
              <input
                type="range"
                min={props.lumensRange.min}
                max={props.lumensRange.max}
                step="50"
                value={props.lumens}
                onInput={(event) => props.onLumensInput(Number(event.currentTarget.value))}
              />
            </label>

            <div class={styles.presets}>
              <button type="button" onClick={() => props.onPreset(3200, 950)}>Calida</button>
              <button type="button" onClick={() => props.onPreset(5200, 1200)}>Neutra</button>
              <button type="button" onClick={() => props.onPreset(7600, 1500)}>Fria</button>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
