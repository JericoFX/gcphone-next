import { Show, createSignal } from 'solid-js';
import { useNuiCustomEvent } from '../../../utils/useNui';
import { usePhoneState } from '../../../store/phone';
import { emitInternalEvent } from '../../../utils/internalEvents';
import { t } from '../../../i18n';
import styles from './CarPlayOverlay.module.scss';

export function CarPlayOverlay() {
  const phoneState = usePhoneState();
  const [active, setActive] = createSignal(false);

  useNuiCustomEvent<{ active?: boolean }>('gcphone:carplay', (payload) => {
    if (typeof payload?.active !== 'boolean') return;
    setActive(payload.active);
  });

  const carplayEnabled = () => phoneState.settings.carplayEnabled !== false;
  const showCarPlay = () => active() && carplayEnabled();

  const openApp = (route: string) => {
    emitInternalEvent('phone:openRoute', { route, data: {} });
  };

  const language = () => phoneState.settings.language || 'es';

  const apps = [
    { icon: './img/icons_ios/map.svg', labelKey: 'carplay.map', route: 'maps' },
    { icon: './img/icons_ios/music.svg', labelKey: 'carplay.music', route: 'music' },
    { icon: './img/icons_ios/calls.svg', labelKey: 'carplay.call', route: 'calls' },
    { icon: './img/icons_ios/messages.svg', labelKey: 'carplay.messages', route: 'messages' },
  ];

  return (
    <Show when={showCarPlay()}>
      <div class={styles.overlay}>
        <div class={styles.header}>
          <span class={styles.carplayBadge}>CarPlay</span>
          <button class={styles.closeBtn} onClick={() => setActive(false)}>✕</button>
        </div>
        <div class={styles.grid}>
          {apps.map((app) => (
            <button class={styles.tile} onClick={() => openApp(app.route)}>
              <img src={app.icon} alt="" draggable={false} />
              <span>{t(app.labelKey, language())}</span>
            </button>
          ))}
        </div>
      </div>
    </Show>
  );
}
