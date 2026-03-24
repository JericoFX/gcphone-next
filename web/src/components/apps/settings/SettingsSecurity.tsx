import { For, Show, createSignal } from 'solid-js';
import { t } from '../../../i18n';
import { Cell, Group, IconImage, ICONS, InlineExpander, PIN_LENGTH } from './settingsShared';
import styles from './SettingsApp.module.scss';

type SecurityFlow = 'idle' | 'disable-lock' | 'change-verify' | 'change-new' | 'change-confirm';

interface SettingsSecurityProps {
  language: () => string;
  phoneActions: any;
  phoneState: any;
  screenLockEnabled: () => boolean;
}

export function SettingsSecurity(props: SettingsSecurityProps) {
  const [securityFlow, setSecurityFlow] = createSignal<SecurityFlow>('idle');
  const [pinCode, setPinCode] = createSignal('');
  const [pinConfirm, setPinConfirm] = createSignal('');
  const [status, setStatus] = createSignal<{ type: 'ok' | 'error'; text: string } | null>(null);

  const resetSecurityFlow = () => { setSecurityFlow('idle'); setPinCode(''); setPinConfirm(''); };

  const getCurrentPin = () => securityFlow() === 'change-confirm' ? pinConfirm() : pinCode();

  const hasPinSet = () => {
    const code = props.phoneState.settings.lockCode;
    return code && code !== '0000';
  };

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
      if (!valid) { setStatus({ type: 'error', text: t('settings.pin.wrong', props.language()) }); setPinCode(''); return; }
      props.phoneActions.setScreenLockEnabled(false);
      setStatus({ type: 'ok', text: t('settings.pin.lock_disabled', props.language()) });
      setTimeout(() => { resetSecurityFlow(); setStatus(null); }, 1600);
      return;
    }
    if (securityFlow() === 'change-verify') {
      const valid = await props.phoneActions.verifyPin(value);
      if (!valid) { setStatus({ type: 'error', text: t('settings.pin.wrong', props.language()) }); setPinCode(''); return; }
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
      case 'disable-lock': return t('settings.pin.confirm_current', props.language());
      case 'change-verify': return t('settings.pin_verify_current', props.language()) || t('settings.pin.enter_current', props.language());
      case 'change-new': return t('settings.pin.enter_new', props.language());
      case 'change-confirm': return t('settings.pin.confirm_new', props.language());
      default: return '';
    }
  };

  return (
    <div class={styles.content}>
      <Group>
        <Cell
          icon={ICONS.security} iconBg="iconBlue"
          title={t('settings.screen_lock', props.language()) || 'Bloqueo de pantalla'}
          right="switch"
          switchValue={props.screenLockEnabled()}
          onSwitch={() => {
            setStatus(null);
            if (props.screenLockEnabled()) {
              resetSecurityFlow();
              setSecurityFlow('disable-lock');
              return;
            }
            props.phoneActions.setScreenLockEnabled(true);
          }}
        />
        {/* Swipe to Unlock: only when screen lock ON and NO PIN set */}
        <Show when={props.screenLockEnabled() && !hasPinSet()}>
          <Cell
            icon={ICONS.security} iconBg="iconGray"
            title={t('settings.swipe_unlock', props.language()) || 'Deslizar para desbloquear'}
            right="switch"
            switchValue={props.phoneState.settings.swipeUnlock ?? false}
            onSwitch={() => props.phoneActions.setSwipeUnlock(!(props.phoneState.settings.swipeUnlock ?? false))}
          />
        </Show>
      </Group>

      <Group>
        <Cell
          icon={ICONS.security} iconBg="iconRed"
          title={t('settings.pin_lock', props.language()) || 'PIN Lock'}
          right="value+chevron"
          value={hasPinSet() ? (t('settings.pin_active', props.language()) || 'Activo') : (t('settings.pin_inactive', props.language()) || 'Inactivo')}
          onClick={() => {
            setStatus(null);
            resetSecurityFlow();
            if (hasPinSet()) {
              setSecurityFlow('change-verify');
            } else {
              setSecurityFlow('change-new');
            }
          }}
        />
        <InlineExpander open={() => securityFlow() !== 'idle'}>
          <div class={styles.pinContainer}>
            <div class={styles.pinTitle}>{securityTitle()}</div>
            <div class={styles.pinDots}>
              <For each={[0, 1, 2, 3]}>
                {(i) => <div class={styles.pinDot} classList={{ [styles.filled]: getCurrentPin().length > i }} />}
              </For>
            </div>
            <div class={styles.pinKeypad}>
              <For each={['1','2','3','4','5','6','7','8','9']}>
                {(d) => <button class={styles.pinKey} onClick={() => handlePinDigit(d)}>{d}</button>}
              </For>
              <div />
              <button class={styles.pinKey} onClick={() => handlePinDigit('0')}>0</button>
              <button class={styles.pinBackspace} onClick={handlePinBackspace}>
                <IconImage src={ICONS.backspace} class={styles.keypadIcon} />
              </button>
            </div>
            <button class={styles.pinCancel} onClick={resetSecurityFlow}>
              {t('action.cancel', props.language())}
            </button>
            <Show when={status()}>
              {(msg) => <div class={`${styles.pinMessage} ${styles[msg().type]}`}>{msg().text}</div>}
            </Show>
          </div>
        </InlineExpander>
      </Group>
    </div>
  );
}
