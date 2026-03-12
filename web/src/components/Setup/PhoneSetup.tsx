import { Show, createMemo, createSignal } from 'solid-js';
import { usePhone } from '../../store/phone';
import { t } from '../../i18n';
import type { PhoneSetupPayload } from '../../types';
import styles from './PhoneSetup.module.scss';

const LANGUAGES = [
  { code: 'es', labelKey: 'setup.language.es.label', metaKey: 'setup.language.es.meta' },
  { code: 'en', labelKey: 'setup.language.en.label', metaKey: 'setup.language.en.meta' },
  { code: 'pt', labelKey: 'setup.language.pt.label', metaKey: 'setup.language.pt.meta' },
  { code: 'fr', labelKey: 'setup.language.fr.label', metaKey: 'setup.language.fr.meta' },
] as const;

const AUDIO_PROFILES = [
  { value: 'normal', labelKey: 'setup.audio.normal.label', metaKey: 'setup.audio.normal.meta' },
  { value: 'street', labelKey: 'setup.audio.street.label', metaKey: 'setup.audio.street.meta' },
  { value: 'vehicle', labelKey: 'setup.audio.vehicle.label', metaKey: 'setup.audio.vehicle.meta' },
  { value: 'silent', labelKey: 'setup.audio.silent.label', metaKey: 'setup.audio.silent.meta' },
] as const;

const STEP_LABELS = ['setup.step.language', 'setup.step.security', 'setup.step.identity'] as const;

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

export function PhoneSetup() {
  const [phoneState, phoneActions] = usePhone();
  const [step, setStep] = createSignal(0);
  const [pin, setPin] = createSignal('');
  const [mailAlias, setMailAlias] = createSignal('');
  const [snapUsername, setSnapUsername] = createSignal('');
  const [chirpUsername, setChirpUsername] = createSignal('');
  const [clipsUsername, setClipsUsername] = createSignal('');
  const [language, setLanguage] = createSignal<'es' | 'en' | 'pt' | 'fr'>(phoneState.settings.language || 'es');
  const [audioProfile, setAudioProfile] = createSignal<'normal' | 'street' | 'vehicle' | 'silent'>(phoneState.settings.audioProfile || 'normal');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const currentLanguage = () => language();

  const mailEnabled = createMemo(() => phoneState.featureFlags.mail !== false);
  const mailDomain = createMemo(() => phoneState.setup.mailDomain || 'jericofx.gg');
  const payload = createMemo<PhoneSetupPayload>(() => ({
    pin: pin().trim(),
    snapUsername: snapUsername().trim(),
    chirpUsername: chirpUsername().trim(),
    clipsUsername: clipsUsername().trim(),
    mailAlias: mailEnabled() ? mailAlias().trim() : undefined,
    language: language(),
    audioProfile: audioProfile(),
  }));

  const validateStep = (targetStep: number) => {
    const draft = payload();

    if (targetStep >= 1) {
      if (!draft.pin || draft.pin.length < 4 || draft.pin.length > 6) {
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
              type='button'
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
              <span>{t(label, currentLanguage())}</span>
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
                  type='button'
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
                  onInput={(event) => setPin(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder='0000'
                  inputmode='numeric'
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
                      placeholder='tu.alias'
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
                <input value={snapUsername()} onInput={(event) => setSnapUsername(sanitizeUsername(event.currentTarget.value))} placeholder='snap.user' />
              </label>

              <label class={styles.field}>
                <span>{t('setup.identity.chirp', currentLanguage())}</span>
                <input value={chirpUsername()} onInput={(event) => setChirpUsername(sanitizeUsername(event.currentTarget.value))} placeholder='chirp.user' />
              </label>

              <label class={styles.field}>
                <span>{t('setup.identity.clips', currentLanguage())}</span>
                <input value={clipsUsername()} onInput={(event) => setClipsUsername(sanitizeUsername(event.currentTarget.value))} placeholder='clips.user' />
              </label>
            </div>

            <div class={styles.preferenceStack}>
              <div class={styles.preferenceGroup}>
                <div class={styles.preferenceHeader}>
                  <strong>{t('setup.audio.title', currentLanguage())}</strong>
                  <span>{t('setup.audio.description', currentLanguage())}</span>
                </div>
                <div class={styles.optionGrid}>
                  {AUDIO_PROFILES.map((option) => (
                    <button
                      type='button'
                      class={styles.optionCard}
                      classList={{ [styles.optionCardActive]: audioProfile() === option.value }}
                      onClick={() => setAudioProfile(option.value)}
                    >
                        <strong>{t(option.labelKey, currentLanguage())}</strong>
                        <span>{t(option.metaKey, currentLanguage())}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </section>
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
          <button type='button' class={styles.secondaryButton} onClick={goBack} disabled={step() === 0 || loading()}>
            {t('setup.action.back', currentLanguage())}
          </button>

          <Show
            when={step() === STEP_LABELS.length - 1}
            fallback={
              <button type='button' class={styles.primaryButton} onClick={goNext} disabled={loading()}>
                {t('setup.action.next', currentLanguage())}
              </button>
            }
          >
            <button type='button' class={styles.primaryButton} onClick={() => void submitSetup()} disabled={loading()}>
              {loading() ? t('setup.action.saving', currentLanguage()) : t('setup.action.finish', currentLanguage())}
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
