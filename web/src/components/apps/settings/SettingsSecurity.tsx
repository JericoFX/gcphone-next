import { For, Show, createSignal } from 'solid-js';
import { t } from '../../../i18n';
import { Group, IconImage, ICONS, PIN_LENGTH } from './settingsShared';
import styles from './SettingsApp.module.scss';

type SecurityFlow = 'idle' | 'disable-lock' | 'change-verify' | 'change-new' | 'change-confirm';

interface SettingsSecurityProps {
  language: () => string;
  phoneActions: any;
  screenLockEnabled: () => boolean;
}

export function SettingsSecurity(props: SettingsSecurityProps) {
  const [securityFlow, setSecurityFlow] = createSignal<SecurityFlow>('idle');
  const [pinCode, setPinCode] = createSignal('');
  const [pinConfirm, setPinConfirm] = createSignal('');
  const [status, setStatus] = createSignal<{ type: 'ok' | 'error'; text: string } | null>(null);

  const resetSecurityFlow = () => { setSecurityFlow('idle'); setPinCode(''); setPinConfirm(''); };

  const getCurrentPin = () => securityFlow() === 'change-confirm' ? pinConfirm() : pinCode();

  const validateAndSavePin = () => {
    if (pinCode() !== pinConfirm()) {
      setStatus({ type: 'error', text: t('settings.pin_mismatch', props.language()) });
      setSecurityFlow('change-new');
      setPinCode(''); setPinConfirm('');
      return;
    }
    props.phoneActions.setLockCode(pinCode());
    props.phoneActions.setScreenLockEnabled(true);
    setStatus({ type: 'ok', text: t('settings.pin_saved', props.language()) });
    setTimeout(() => { resetSecurityFlow(); setStatus(null); }, 2000);
  };

  const processSecurityEntry = async (value: string) => {
    if (securityFlow() === 'disable-lock') {
      const valid = await props.phoneActions.verifyPin(value);
      if (!valid) { setStatus({ type: 'error', text: 'PIN actual incorrecto' }); setPinCode(''); return; }
      props.phoneActions.setScreenLockEnabled(false);
      setStatus({ type: 'ok', text: 'Bloqueo de pantalla desactivado' });
      setTimeout(() => { resetSecurityFlow(); setStatus(null); }, 1600);
      return;
    }
    if (securityFlow() === 'change-verify') {
      const valid = await props.phoneActions.verifyPin(value);
      if (!valid) { setStatus({ type: 'error', text: 'PIN actual incorrecto' }); setPinCode(''); return; }
      setStatus(null); setSecurityFlow('change-new'); setPinCode('');
      return;
    }
    if (securityFlow() === 'change-new') { setPinCode(value); setPinConfirm(''); setSecurityFlow('change-confirm'); return; }
    if (securityFlow() === 'change-confirm') { setPinConfirm(value); setTimeout(validateAndSavePin, 0); }
  };

  const handlePinDigit = (digit: string) => {
    if (securityFlow() === 'idle') return;
    const target = getCurrentPin();
    if (target.length >= PIN_LENGTH) return;
    const next = `${target}${digit}`;
    securityFlow() === 'change-confirm' ? setPinConfirm(next) : setPinCode(next);
    if (next.length === PIN_LENGTH) void processSecurityEntry(next);
  };

  const handlePinBackspace = () => {
    securityFlow() === 'change-confirm' ? setPinConfirm(pinConfirm().slice(0, -1)) : setPinCode(pinCode().slice(0, -1));
    setStatus(null);
  };

  const securityTitle = () => {
    switch (securityFlow()) {
      case 'disable-lock': return 'Confirma tu PIN actual';
      case 'change-verify': return 'Introduce tu PIN actual';
      case 'change-new': return 'Introduce el nuevo PIN';
      case 'change-confirm': return 'Confirma el nuevo PIN';
      default: return t('settings.tab.security', props.language());
    }
  };

  const securitySubtitle = () => {
    switch (securityFlow()) {
      case 'disable-lock': return 'Necesitamos validar el PIN antes de quitar el bloqueo de pantalla.';
      case 'change-verify': return 'Verifica el PIN actual antes de cambiarlo.';
      case 'change-new': return 'El PIN debe tener 4 digitos.';
      case 'change-confirm': return 'Vuelve a introducir el nuevo PIN.';
      default: return 'Configura el bloqueo de pantalla y administra el PIN del dispositivo.';
    }
  };

  return (
    <div class={styles.content}>
      <Group>
        <div class={styles.locationRow}>
          <div class={styles.locationLeft}>
            <div class={`${styles.cellIcon} ${styles.iconGreen}`}><IconImage src={ICONS.security} class={styles.cellIconImage} /></div>
            <div>
              <div class={styles.cellTitle}>Bloqueo de pantalla</div>
              <div class={styles.cellSubtitle}>{props.screenLockEnabled() ? 'El telefono pide PIN al abrirse.' : 'El telefono abre directo sin lock screen.'}</div>
            </div>
          </div>
          <div class={`${styles.switch} ${props.screenLockEnabled() ? styles.switchActive : ''}`} onClick={() => {
            setStatus(null);
            if (props.screenLockEnabled()) { resetSecurityFlow(); setSecurityFlow('disable-lock'); return; }
            props.phoneActions.setScreenLockEnabled(true);
            setStatus({ type: 'ok', text: 'Bloqueo de pantalla activado' });
          }} role="switch" aria-checked={props.screenLockEnabled()}>
            <div class={styles.switchThumb} />
          </div>
        </div>

        <div class={styles.locationRow}>
          <div class={styles.locationLeft}>
            <div class={`${styles.cellIcon} ${styles.iconRed}`}><IconImage src={ICONS.security} class={styles.cellIconImage} /></div>
            <div>
              <div class={styles.cellTitle}>Cambiar PIN</div>
              <div class={styles.cellSubtitle}>Verifica tu PIN actual y despues introduce el nuevo.</div>
            </div>
          </div>
          <button class={styles.clearBtn} style={{ width: 'auto', margin: '0', padding: '10px 14px' }} onClick={() => { setStatus(null); resetSecurityFlow(); setSecurityFlow('change-verify'); }}>
            Cambiar
          </button>
        </div>
      </Group>

      <Show when={securityFlow() !== 'idle'}>
        <div class={styles.pinContainer}>
          <div class={styles.pinTitle}>{securityTitle()}</div>
          <div class={styles.cellSubtitle} style={{ 'text-align': 'center', 'margin-bottom': '12px' }}>{securitySubtitle()}</div>
          <div class={styles.pinDots}>
            <For each={[0, 1, 2, 3]}>{(i) => <div class={styles.pinDot} classList={{ [styles.filled]: getCurrentPin().length > i }} />}</For>
          </div>
          <div class={styles.pinKeypad}>
            <For each={['1','2','3','4','5','6','7','8','9']}>{(d) => <button class={styles.pinKey} onClick={() => handlePinDigit(d)}>{d}</button>}</For>
            <div />
            <button class={styles.pinKey} onClick={() => handlePinDigit('0')}>0</button>
            <button class={styles.pinBackspace} onClick={handlePinBackspace}><IconImage src={ICONS.backspace} class={styles.keypadIcon} /></button>
          </div>
          <button class={styles.clearBtn} onClick={resetSecurityFlow}>Cancelar</button>
        </div>
      </Show>

      <Show when={status()}>
        {(msg) => <div class={`${styles.pinMessage} ${styles[msg().type]}`}>{msg().text}</div>}
      </Show>
    </div>
  );
}
