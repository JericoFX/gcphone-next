import { For, Show } from 'solid-js';
import { t } from '../../../i18n';
import {
  RadioStation,
  getCategoryGradient,
  getCategoryLabel,
} from './radioShared';
import styles from './RadioApp.module.scss';

interface RadioStationListProps {
  stations: () => RadioStation[];
  loading: () => boolean;
  error: () => string | null;
  language: () => string;
  onJoin: (stationId: number) => void;
  onCreate: () => void;
}

export function RadioStationList(props: RadioStationListProps) {
  return (
    <div class={styles.radioContent}>
      {/* Loading */}
      <Show when={props.loading()}>
        <div class={styles.emptyState}>
          <span class={styles.stationName}>
            {t('radio.loading', props.language()) || 'Cargando...'}
          </span>
        </div>
      </Show>

      {/* Error */}
      <Show when={!props.loading() && props.error() !== null}>
        <div class={styles.emptyState}>
          <span class={styles.activeDesc}>{props.error()}</span>
        </div>
      </Show>

      {/* Empty */}
      <Show
        when={
          !props.loading() &&
          props.error() === null &&
          props.stations().length === 0
        }
      >
        <div class={styles.emptyState}>
          <img
            src="./img/icons_ios/radio.svg"
            alt=""
            width={64}
            height={64}
            style={{ opacity: '0.3' }}
          />
          <span class={styles.stationName}>
            {t('radio.empty_title', props.language()) ||
              'No hay estaciones en vivo'}
          </span>
          <span class={styles.hostLabel}>
            {t('radio.empty_desc', props.language()) || ''}
          </span>
        </div>
      </Show>

      {/* Station cards */}
      <Show
        when={
          !props.loading() &&
          props.error() === null &&
          props.stations().length > 0
        }
      >
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: 'var(--s-3)' }}>
          <For each={props.stations()}>
            {(station) => (
              <button
                class={styles.stationCard}
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => props.onJoin(station.id)}
              >
                {/* Gradient left strip */}
                <div
                  class={styles.stationStrip}
                  style={{ background: getCategoryGradient(station.category) }}
                />

                {/* Content */}
                <div class={styles.stationContent}>
                  <span class={styles.stationName}>{station.stationName}</span>

                  <div class={styles.stationMeta}>
                    <span class={styles.categoryPill}>
                      {getCategoryLabel(station.category, props.language())}
                    </span>
                    <span class={styles.listenerCount}>
                      {'👤'} {station.listenerCount}
                    </span>
                  </div>

                  <span class={styles.hostName}>
                    {station.hostName}
                  </span>
                </div>

                {/* EN VIVO badge */}
                <div class={styles.liveBadge}>
                  <span class={styles.pulseDot} />
                  {'EN VIVO'}
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Floating create button */}
      <button class={styles.fabCreate} onClick={props.onCreate}>
        +
      </button>
    </div>
  );
}
