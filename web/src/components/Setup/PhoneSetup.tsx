import { For, Show, createMemo, createSignal } from 'solid-js';
import { usePhone } from '../../store/phone';
import { t } from '../../i18n';
import { fetchNui } from '../../utils/fetchNui';
import type { PhoneSetupPayload } from '../../types';
import styles from './PhoneSetup.module.scss';

const LANGUAGES = [
  { code: 'es', labelKey: 'setup.language.es.label', metaKey: 'setup.language.es.meta' },
  { code: 'en', labelKey: 'setup.language.en.label', metaKey: 'setup.language.en.meta' },
  { code: 'pt', labelKey: 'setup.language.pt.label', metaKey: 'setup.language.pt.meta' },
  { code: 'fr', labelKey: 'setup.language.fr.label', metaKey: 'setup.language.fr.meta' },
] as const;

const STEP_LABELS = ['setup.step.language', 'setup.step.security', 'setup.step.identity', 'Resumen'] as const;
const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;

function sanitizeUsername(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '').slice(0, 32);
}

function sanitizeMailAlias(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '').slice(0, 24);
}

function isValidHandle(value: string) {
  return value.length >= 3 && value.length <= 32 && !/^[._-]|[._-]$/.test(value);
}

function isValidMailAlias(value: string) {
  return value.length >= 3 && value.length <= 24 && !/^[._-]|[._-]$/.test(value) && !value.includes('..');
}

function humanizeError(code: string | undefined, language: 'es' | 'en' | 'pt' | 'fr') {
  switch (code) {
    case 'SNAP_USERNAME_TAKEN':
      return t('setup.error.snap_taken', language);
    case 'CHIRP_USERNAME_TAKEN':
      return t('setup.error.chirp_taken', language);
    case 'CLIPS_USERNAME_TAKEN':
      return t('setup.error.clips_taken', language);
    case 'EMAIL_IN_USE':
      return t('setup.error.mail_taken', language);
    case 'INVALID_SETUP_DATA':
      return t('setup.error.invalid_data', language);
    case 'SETUP_FAILED':
      return t('setup.error.failed', language);
    default:
      return code || t('setup.error.generic', language);
  }
}

function summaryText(language: 'es' | 'en' | 'pt' | 'fr') {
  if (language === 'en') {
    return {
      summaryTitle: 'Review your setup',
      summaryDesc: 'Check your data before finishing the phone setup.',
      emergencyTitle: 'Emergency calls only',
      emergencyDesc: 'This quick dial only accepts emergency numbers defined in Lua.',
      callAction: 'Call',
      imeiTitle: 'Device IMEI',
      imeiHint: 'Dial *#06# to check the IMEI before finishing.',
      invalidEmergency: 'This dialer only allows configured emergency numbers.',
      noEmergency: 'No emergency numbers configured.',
      callFailed: 'Unable to start the emergency call.',
      reviewLanguage: 'Language',
      reviewPin: 'PIN',
      reviewMail: 'Mail',
      reviewSnap: 'Snap',
      reviewChirp: 'Chirp',
      reviewClips: 'Clips',
      hiddenPin: 'Configured',
      imeiModalTitle: 'IMEI',
      close: 'Close',
    };
  }

  if (language === 'pt') {
    return {
      summaryTitle: 'Revise sua configuracao',
      summaryDesc: 'Confira seus dados antes de finalizar a configuracao do telefone.',
      emergencyTitle: 'Somente chamadas de emergencia',
      emergencyDesc: 'Este teclado rapido aceita apenas numeros de emergencia definidos em Lua.',
      callAction: 'Ligar',
      imeiTitle: 'IMEI do aparelho',
      imeiHint: 'Digite *#06# para consultar o IMEI antes de terminar.',
      invalidEmergency: 'Este teclado so permite numeros de emergencia configurados.',
      noEmergency: 'Nenhum numero de emergencia configurado.',
      callFailed: 'Nao foi possivel iniciar a chamada de emergencia.',
      reviewLanguage: 'Idioma',
      reviewPin: 'PIN',
      reviewMail: 'Mail',
      reviewSnap: 'Snap',
      reviewChirp: 'Chirp',
      reviewClips: 'Clips',
      hiddenPin: 'Configurado',
      imeiModalTitle: 'IMEI',
      close: 'Fechar',
    };
  }

  if (language === 'fr') {
    return {
      summaryTitle: 'Verifiez votre configuration',
      summaryDesc: 'Controlez vos donnees avant de terminer la configuration du telephone.',
      emergencyTitle: 'Appels d urgence uniquement',
      emergencyDesc: 'Ce clavier rapide accepte uniquement les numeros d urgence definis en Lua.',
      callAction: 'Appeler',
      imeiTitle: 'IMEI de l appareil',
      imeiHint: 'Composez *#06# pour consulter l IMEI avant de terminer.',
      invalidEmergency: 'Ce clavier autorise seulement les numeros d urgence configures.',
      noEmergency: 'Aucun numero d urgence configure.',
      callFailed: 'Impossible de lancer l appel d urgence.',
      reviewLanguage: 'Langue',
      reviewPin: 'PIN',
      reviewMail: 'Mail',
      reviewSnap: 'Snap',
      reviewChirp: 'Chirp',
      reviewClips: 'Clips',
      hiddenPin: 'Configure',
      imeiModalTitle: 'IMEI',
      close: 'Fermer',
    };
  }

  return {
    summaryTitle: 'Revisa tu configuracion',
    summaryDesc: 'Comprueba tus datos antes de terminar la configuracion del telefono.',
    emergencyTitle: 'Solo llamadas de emergencia',
    emergencyDesc: 'Este teclado rapido solo acepta numeros de emergencia definidos en Lua.',
    callAction: 'Llamar',
    imeiTitle: 'IMEI del dispositivo',
    imeiHint: 'Marca *#06# para consultar el IMEI antes de finalizar.',
    invalidEmergency: 'Este teclado solo permite numeros de emergencia configurados.',
    noEmergency: 'No hay numeros de emergencia configurados.',
    callFailed: 'No se pudo iniciar la llamada de emergencia.',
    reviewLanguage: 'Idioma',
    reviewPin: 'PIN',
    reviewMail: 'Mail',
    reviewSnap: 'Snap',
    reviewChirp: 'Chirp',
    reviewClips: 'Clips',
    hiddenPin: 'Configurado',
    imeiModalTitle: 'IMEI',
    close: 'Cerrar',
  };
}

export function PhoneSetup() {
  const [phoneState, phoneActions] = usePhone();
  const [step, setStep] = createSignal(0);
  const [pin, setPin] = createSignal('');
  const [mailAlias, setMailAlias] = createSignal('');
  const [snapUsername, setSnapUsername] = createSignal('');
  const [chirpUsername, setChirpUsername] = createSignal('');
  const [clipsUsername, setClipsUsername] = createSignal('');
  const [language, setLanguage] = createSignal<'es' | 'en' | 'pt' | 'fr'>(phoneState.settings.language || 'es');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [dialValue, setDialValue] = createSignal('');
  const [dialStatus, setDialStatus] = createSignal('');
  const [imeiModalOpen, setImeiModalOpen] = createSignal(false);
  const currentLanguage = () => language();
  const copy = createMemo(() => summaryText(currentLanguage()));

  const mailEnabled = createMemo(() => phoneState.featureFlags.mail !== false);
  const mailDomain = createMemo(() => phoneState.setup.mailDomain || 'jericofx.gg');
  const emergencyContacts = createMemo(() => phoneState.setup.emergencyContacts || []);
  const matchedEmergencyContact = createMemo(() => emergencyContacts().find((entry) => entry.number === dialValue().trim()));
  const payload = createMemo<PhoneSetupPayload>(() => ({
    pin: pin().trim(),
    snapUsername: snapUsername().trim(),
    chirpUsername: chirpUsername().trim(),
    clipsUsername: clipsUsername().trim(),
    mailAlias: mailEnabled() ? mailAlias().trim() : undefined,
    language: language(),
    audioProfile: phoneState.settings.audioProfile || 'normal',
  }));

  const validateStep = (targetStep: number) => {
    const draft = payload();

    if (targetStep >= 1) {
      if (!draft.pin || draft.pin.length !== 4) {
        return t('setup.validation.pin_length', currentLanguage());
      }

      if (mailEnabled()) {
        if (!draft.mailAlias) return t('setup.validation.mail_required', currentLanguage());
        if (!isValidMailAlias(draft.mailAlias)) return t('setup.validation.mail_invalid', currentLanguage());
      }
    }

    if (targetStep >= 2) {
      if (!isValidHandle(draft.snapUsername)) return t('setup.validation.snap_invalid', currentLanguage());
      if (!isValidHandle(draft.chirpUsername)) return t('setup.validation.chirp_invalid', currentLanguage());
      if (!isValidHandle(draft.clipsUsername)) return t('setup.validation.clips_invalid', currentLanguage());
    }

    return '';
  };

  const goNext = () => {
    const nextError = validateStep(step());
    if (nextError) {
      setError(nextError);
      return;
    }

    setError('');
    setStep((current) => Math.min(current + 1, STEP_LABELS.length - 1));
  };

  const goBack = () => {
    setError('');
    setDialStatus('');
    setStep((current) => Math.max(current - 1, 0));
  };

  const submitSetup = async () => {
    if (loading()) return;

    const nextError = validateStep(2);
    if (nextError) {
      setError(nextError);
      return;
    }

    setLoading(true);
    setError('');
    const result = await phoneActions.completeSetup(payload());
    setLoading(false);

    if (!result.success) {
      setError(humanizeError(result.error, currentLanguage()));
      return;
    }

    await phoneActions.refreshSetupState();
    phoneActions.lock();
  };

  const appendDial = (value: string) => {
    setDialStatus('');
    setDialValue((current) => (current + value).slice(0, 20));
  };

  const deleteDial = () => {
    setDialStatus('');
    setDialValue((current) => current.slice(0, -1));
  };

  const startEmergencyCall = async () => {
    const dialed = dialValue().trim();
    if (dialed === '*#06#') {
      await fetchNui('phoneReportImeiViewed', { context: 'setup' }, { success: true });
      setImeiModalOpen(true);
      setDialStatus('');
      return;
    }

    const target = matchedEmergencyContact();
    if (!target) {
      setDialStatus(emergencyContacts().length > 0 ? copy().invalidEmergency : copy().noEmergency);
      return;
    }

    const result = await fetchNui<{ error?: string }>('startCall', { phoneNumber: target.number, extraData: { source: 'setup' } }, {});
    if (result?.error) {
      setDialStatus(copy().callFailed);
      return;
    }

    setDialStatus(`${copy().callAction}: ${target.label}`);
  };

  const selectedLanguageLabel = createMemo(() => {
    const selected = LANGUAGES.find((entry) => entry.code === language());
    return selected ? t(selected.labelKey, currentLanguage()) : language();
  });

  return (
    <div class={styles.setupRoot}>
      <div class={styles.card}>
        <div class={styles.hero}>
          <p class={styles.eyebrow}>{t('setup.hero.eyebrow', currentLanguage())}</p>
          <h2>{t('setup.hero.title', currentLanguage())}</h2>
          <p class={styles.lead}>{t('setup.hero.lead', currentLanguage())}</p>
        </div>

        <div class={styles.progress}>
          {STEP_LABELS.map((label, index) => (
            <button
              type="button"
              class={styles.progressStep}
              classList={{ [styles.progressStepActive]: index === step(), [styles.progressStepDone]: index < step() }}
              onClick={() => {
                if (index <= step()) {
                  setError('');
                  setStep(index);
                }
              }}
            >
              <span class={styles.progressIndex}>{index + 1}</span>
              <span>{label.startsWith('setup.') ? t(label, currentLanguage()) : label}</span>
            </button>
          ))}
        </div>

        <div class={styles.content}>
          <Show when={step() === 0}>
            <section class={styles.section}>
              <div class={styles.sectionHeader}>
                <h3>{t('setup.language.title', currentLanguage())}</h3>
                <p>{t('setup.language.description', currentLanguage())}</p>
              </div>

              <div class={styles.optionGrid}>
                {LANGUAGES.map((option) => (
                  <button
                    type="button"
                    class={styles.optionCard}
                    classList={{ [styles.optionCardActive]: language() === option.code }}
                    onClick={() => setLanguage(option.code)}
                  >
                    <strong>{t(option.labelKey, currentLanguage())}</strong>
                    <span>{t(option.metaKey, currentLanguage())}</span>
                  </button>
                ))}
              </div>
            </section>
          </Show>

          <Show when={step() === 1}>
            <section class={styles.section}>
              <div class={styles.sectionHeader}>
                <h3>{t('setup.security.title', currentLanguage())}</h3>
                <p>{t('setup.security.description', currentLanguage())}</p>
              </div>

              <div class={styles.formGrid}>
                <label class={styles.field}>
                  <span>{t('setup.security.pin', currentLanguage())}</span>
                  <input
                    value={pin()}
                    onInput={(event) => setPin(event.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    inputmode="numeric"
                  />
                  <small>{t('setup.security.pin_hint', currentLanguage())}</small>
                </label>

                <Show when={mailEnabled()}>
                  <label class={styles.field}>
                    <span>{t('setup.security.mail_alias', currentLanguage())}</span>
                    <div class={styles.inputWrap}>
                      <input
                        value={mailAlias()}
                        onInput={(event) => setMailAlias(sanitizeMailAlias(event.currentTarget.value))}
                        placeholder="tu.alias"
                      />
                      <span class={styles.domainBadge}>@{mailDomain()}</span>
                    </div>
                    <small>{t('setup.security.mail_hint', currentLanguage())}</small>
                  </label>
                </Show>
              </div>
            </section>
          </Show>

          <Show when={step() === 2}>
            <section class={styles.section}>
              <div class={styles.sectionHeader}>
                <h3>{t('setup.identity.title', currentLanguage())}</h3>
                <p>{t('setup.identity.description', currentLanguage())}</p>
              </div>

              <div class={styles.identityGrid}>
                <label class={styles.field}>
                  <span>{t('setup.identity.snap', currentLanguage())}</span>
                  <input value={snapUsername()} onInput={(event) => setSnapUsername(sanitizeUsername(event.currentTarget.value))} placeholder="snap.user" />
                </label>

                <label class={styles.field}>
                  <span>{t('setup.identity.chirp', currentLanguage())}</span>
                  <input value={chirpUsername()} onInput={(event) => setChirpUsername(sanitizeUsername(event.currentTarget.value))} placeholder="chirp.user" />
                </label>

                <label class={styles.field}>
                  <span>{t('setup.identity.clips', currentLanguage())}</span>
                  <input value={clipsUsername()} onInput={(event) => setClipsUsername(sanitizeUsername(event.currentTarget.value))} placeholder="clips.user" />
                </label>
              </div>
            </section>
          </Show>

          <Show when={step() === 3}>
            <>
              <section class={styles.section}>
                <div class={styles.sectionHeader}>
                  <h3>{copy().summaryTitle}</h3>
                  <p>{copy().summaryDesc}</p>
                </div>

                <div class={styles.summaryGrid}>
                  <div class={styles.summaryRow}><span>{copy().reviewLanguage}</span><strong>{selectedLanguageLabel()}</strong></div>
                  <div class={styles.summaryRow}><span>{copy().reviewPin}</span><strong>{copy().hiddenPin}</strong></div>
                  <Show when={mailEnabled()}>
                    <div class={styles.summaryRow}><span>{copy().reviewMail}</span><strong>{mailAlias()}@{mailDomain()}</strong></div>
                  </Show>
                  <div class={styles.summaryRow}><span>{copy().reviewSnap}</span><strong>{snapUsername()}</strong></div>
                  <div class={styles.summaryRow}><span>{copy().reviewChirp}</span><strong>{chirpUsername()}</strong></div>
                  <div class={styles.summaryRow}><span>{copy().reviewClips}</span><strong>{clipsUsername()}</strong></div>
                </div>
              </section>

              <section class={styles.section}>
                <div class={styles.sectionHeader}>
                  <h3>{copy().emergencyTitle}</h3>
                  <p>{copy().emergencyDesc}</p>
                </div>

                <div class={styles.emergencyBlock}>
                  <div class={styles.dialHeader}>
                    <div>
                      <strong>{dialValue() || '...'}</strong>
                      <span>{matchedEmergencyContact() ? `${matchedEmergencyContact()?.label}: ${matchedEmergencyContact()?.number}` : copy().imeiHint}</span>
                    </div>
                    <button type="button" class={styles.emergencyCallButton} onClick={() => void startEmergencyCall()}>
                      <span class={styles.emergencyPhoneIcon}>☎</span>
                      <span>{copy().callAction}</span>
                    </button>
                  </div>

                  <div class={styles.emergencyTags}>
                    <For each={emergencyContacts()}>
                      {(contact) => <button type="button" class={styles.emergencyTag} onClick={() => setDialValue(contact.number)}>{contact.label}: {contact.number}</button>}
                    </For>
                  </div>

                  <div class={styles.dialPad}>
                    <For each={DIAL_KEYS}>
                      {(key) => <button type="button" class={styles.dialKey} onClick={() => appendDial(key)}>{key}</button>}
                    </For>
                  </div>

                  <div class={styles.dialActions}>
                    <button type="button" class={styles.secondaryButton} onClick={deleteDial}>⌫</button>
                    <button type="button" class={styles.secondaryButton} onClick={() => setDialValue('')}>C</button>
                  </div>

                  <Show when={dialStatus()}>
                    <p class={styles.statusNote}>{dialStatus()}</p>
                  </Show>
                </div>
              </section>
            </>
          </Show>

          <Show when={error()}>
            <p class={styles.error}>{error()}</p>
          </Show>
        </div>
      </div>

      <div class={styles.footer}>
        <p class={styles.hint}>
          {t('setup.footer.step', currentLanguage(), { current: step() + 1, total: STEP_LABELS.length })}
        </p>

        <div class={styles.buttonRow}>
          <button type="button" class={styles.secondaryButton} onClick={goBack} disabled={step() === 0 || loading()}>
            {t('setup.action.back', currentLanguage())}
          </button>

          <Show
            when={step() === STEP_LABELS.length - 1}
            fallback={
              <button type="button" class={styles.primaryButton} onClick={goNext} disabled={loading()}>
                {t('setup.action.next', currentLanguage())}
              </button>
            }
          >
            <button type="button" class={styles.primaryButton} onClick={() => void submitSetup()} disabled={loading()}>
              {loading() ? t('setup.action.saving', currentLanguage()) : t('setup.action.finish', currentLanguage())}
            </button>
          </Show>
        </div>
      </div>

      <Show when={imeiModalOpen()}>
        <div class={styles.modalOverlay} onClick={() => setImeiModalOpen(false)}>
          <div class={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h3>{copy().imeiModalTitle}</h3>
            <p>{phoneState.imei || 'N/A'}</p>
            <button type="button" class={styles.primaryButton} onClick={() => setImeiModalOpen(false)}>
              {copy().close}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
