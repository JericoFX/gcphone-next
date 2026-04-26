import { For, Show, createSignal } from 'solid-js';
import { t } from '../../../i18n';
import { IconImage, ICONS, PIN_LENGTH } from './settingsShared';
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
  const beginPinSetup = () => {
    resetSecurityFlow();
    props.phoneActions.setScreenLockEnabled(true);
    props.phoneActions.setSwipeUnlock(false);
    setSecurityFlow('change-new');
  };

  const getCurrentPin = () => securityFlow() === 'change-confirm' ? pinConfirm() : pinCode();

  const hasPinSet = () => {
    const code = props.phoneState.settings.lockCode;
    return props.phoneState.setup?.hasPin === true || (code && code !== '0000');
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
    props.phoneActions.setSwipeUnlock(false);
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
      <div class="ios18-list">
        <div class="ios18-cell">
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
            <div class={`${styles.settingsIcon} ${styles.iconBlue}`}>
              <IconImage src={ICONS.security} class={styles.settingsIconImg} />
            </div>
            <span class="ios18-cell__title">
              {t('settings.screen_lock', props.language()) || 'Bloqueo de pantalla'}
            </span>
          </div>
          <div
            class="ios18-switch"
            role="switch"
            aria-checked={props.screenLockEnabled()}
            onClick={() => {
              setStatus(null);
              if (props.screenLockEnabled()) {
                resetSecurityFlow();
                setSecurityFlow('disable-lock');
                return;
              }
              if (hasPinSet()) {
                props.phoneActions.setScreenLockEnabled(true);
                props.phoneActions.setSwipeUnlock(false);
                return;
              }
              beginPinSetup();
            }}
          >
            <div class="ios18-switch__thumb" />
          </div>
        </div>

        {/* Swipe to Unlock: only when screen lock ON and NO PIN set */}
        <Show when={props.screenLockEnabled() && !hasPinSet()}>
          <div class="ios18-cell">
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <div class={`${styles.settingsIcon} ${styles.iconGray}`}>
                <IconImage src={ICONS.security} class={styles.settingsIconImg} />
              </div>
              <span class="ios18-cell__title">
                {t('settings.swipe_unlock', props.language()) || 'Deslizar para desbloquear'}
              </span>
            </div>
            <div
              class="ios18-switch"
              role="switch"
              aria-checked={props.phoneState.settings.swipeUnlock ?? false}
              onClick={() => props.phoneActions.setSwipeUnlock(!(props.phoneState.settings.swipeUnlock ?? false))}
            >
              <div class="ios18-switch__thumb" />
            </div>
          </div>
        </Show>
      </div>

      <div class="ios18-list">
        <button
          class="ios18-cell"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setStatus(null);
            resetSecurityFlow();
            if (hasPinSet()) {
              setSecurityFlow('change-verify');
            } else {
              beginPinSetup();
            }
          }}
        >
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
            <div class={`${styles.settingsIcon} ${styles.iconRed}`}>
              <IconImage src={ICONS.security} class={styles.settingsIconImg} />
            </div>
            <span class="ios18-cell__title">
              {t('settings.pin_lock', props.language()) || 'PIN Lock'}
            </span>
          </div>
          <span style={{ 'font-size': 'var(--fs-caption1)', color: 'var(--text-3)' }}>
            {hasPinSet()
              ? (t('settings.pin_active', props.language()) || 'Activo')
              : (t('settings.pin_inactive', props.language()) || 'Inactivo')}
          </span>
          <div class={styles.chevron} />
        </button>

        <Show when={securityFlow() !== 'idle'}>
          <div class={styles.pinContainer}>
            <div class={styles.pinTitle}>{securityTitle()}</div>
            <Show when={securityFlow() === 'change-new' || securityFlow() === 'change-confirm'}>
              <div class={styles.pinSubtitle}>
                {t('settings.pin_enter', props.language()) || 'Enter a 4-digit PIN'}
              </div>
            </Show>
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
        </Show>
      </div>
    </div>
  );
}
