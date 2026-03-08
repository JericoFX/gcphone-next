import { Show, createMemo, createSignal } from 'solid-js';
import { usePhone } from '../../store/phone';
import type { PhoneSetupPayload } from '../../types';
import styles from './PhoneSetup.module.scss';

const LANGUAGES = [
  { code: 'es', label: 'Espanol', meta: 'Telefono y apps en espanol' },
  { code: 'en', label: 'English', meta: 'Phone and apps in English' },
  { code: 'pt', label: 'Portugues', meta: 'Telefone e apps em portugues' },
  { code: 'fr', label: 'Francais', meta: 'Telephone et apps en francais' },
] as const;

const THEMES = [
  { value: 'light', label: 'Claro', meta: 'Siempre iluminado' },
  { value: 'dark', label: 'Oscuro', meta: 'Mas cinematografico' },
  { value: 'auto', label: 'Auto', meta: 'Se adapta al entorno' },
] as const;

const AUDIO_PROFILES = [
  { value: 'normal', label: 'Normal', meta: 'Uso general' },
  { value: 'street', label: 'Calle', meta: 'Exterior ruidoso' },
  { value: 'vehicle', label: 'Vehiculo', meta: 'En movimiento' },
  { value: 'silent', label: 'Silencio', meta: 'Sin sonido' },
] as const;

const STEP_LABELS = ['Idioma', 'Seguridad', 'Identidad'] as const;

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

function humanizeError(code?: string) {
  switch (code) {
    case 'SNAP_USERNAME_TAKEN':
      return 'El username de Snap ya esta ocupado.';
    case 'CHIRP_USERNAME_TAKEN':
      return 'El username de Chirp ya esta ocupado.';
    case 'CLIPS_USERNAME_TAKEN':
      return 'El username de Clips ya esta ocupado.';
    case 'EMAIL_IN_USE':
      return 'Ese alias de mail ya esta en uso.';
    case 'INVALID_SETUP_DATA':
      return 'Revisa el PIN, el alias de mail y los usernames.';
    case 'SETUP_FAILED':
      return 'No se pudo completar la configuracion inicial.';
    default:
      return code || 'No se pudo completar el setup';
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
  const [theme, setTheme] = createSignal<'auto' | 'light' | 'dark'>(phoneState.settings.theme || 'light');
  const [audioProfile, setAudioProfile] = createSignal<'normal' | 'street' | 'vehicle' | 'silent'>(phoneState.settings.audioProfile || 'normal');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const mailEnabled = createMemo(() => phoneState.featureFlags.mail !== false);
  const mailDomain = createMemo(() => phoneState.setup.mailDomain || 'jericofx.gg');
  const payload = createMemo<PhoneSetupPayload>(() => ({
    pin: pin().trim(),
    snapUsername: snapUsername().trim(),
    chirpUsername: chirpUsername().trim(),
    clipsUsername: clipsUsername().trim(),
    mailAlias: mailEnabled() ? mailAlias().trim() : undefined,
    language: language(),
    theme: theme(),
    audioProfile: audioProfile(),
  }));

  const validateStep = (targetStep: number) => {
    const draft = payload();

    if (targetStep >= 1) {
      if (!draft.pin || draft.pin.length < 4 || draft.pin.length > 6) {
        return 'Tu PIN debe tener entre 4 y 6 digitos.';
      }

      if (mailEnabled()) {
        if (!draft.mailAlias) return 'El alias de mail es obligatorio.';
        if (!isValidMailAlias(draft.mailAlias)) return 'El alias de mail debe tener entre 3 y 24 caracteres validos.';
      }
    }

    if (targetStep >= 2) {
      if (!isValidHandle(draft.snapUsername)) return 'El username de Snap no es valido.';
      if (!isValidHandle(draft.chirpUsername)) return 'El username de Chirp no es valido.';
      if (!isValidHandle(draft.clipsUsername)) return 'El username de Clips no es valido.';
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
      setError(humanizeError(result.error));
      return;
    }

    await phoneActions.refreshSetupState();
    phoneActions.lock();
  };

  return (
    <div class={styles.setupRoot}>
      <div class={styles.card}>
        <div class={styles.hero}>
          <p class={styles.eyebrow}>Bienvenido</p>
          <h2>Deja tu telefono listo para salir a la calle</h2>
          <p class={styles.lead}>Configura idioma, seguridad, mail y tus identidades sociales en una sola pasada.</p>
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
              <span>{label}</span>
            </button>
          ))}
        </div>

        <Show when={step() === 0}>
          <section class={styles.section}>
            <div class={styles.sectionHeader}>
              <h3>Elige tu idioma</h3>
              <p>Este ajuste se aplica desde el primer desbloqueo y luego puedes cambiarlo en Settings.</p>
            </div>

            <div class={styles.optionGrid}>
              {LANGUAGES.map((option) => (
                <button
                  type='button'
                  class={styles.optionCard}
                  classList={{ [styles.optionCardActive]: language() === option.code }}
                  onClick={() => setLanguage(option.code)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.meta}</span>
                </button>
              ))}
            </div>
          </section>
        </Show>

        <Show when={step() === 1}>
          <section class={styles.section}>
            <div class={styles.sectionHeader}>
              <h3>Protege tu telefono</h3>
              <p>El PIN protege el bloqueo y tambien asegura tu mail inicial.</p>
            </div>

            <div class={styles.formGrid}>
              <label class={styles.field}>
                <span>PIN</span>
                <input
                  value={pin()}
                  onInput={(event) => setPin(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder='0000'
                  inputmode='numeric'
                />
                <small>Usa entre 4 y 6 digitos.</small>
              </label>

              <Show when={mailEnabled()}>
                <label class={styles.field}>
                  <span>Alias de Mail</span>
                  <div class={styles.inputWrap}>
                    <input
                      value={mailAlias()}
                      onInput={(event) => setMailAlias(sanitizeMailAlias(event.currentTarget.value))}
                      placeholder='tu.alias'
                    />
                    <span class={styles.domainBadge}>@{mailDomain()}</span>
                  </div>
                  <small>Se crea como cuenta principal para la app Mail.</small>
                </label>
              </Show>
            </div>
          </section>
        </Show>

        <Show when={step() === 2}>
          <section class={styles.section}>
            <div class={styles.sectionHeader}>
              <h3>Activa tu identidad</h3>
              <p>Define tus perfiles sociales y el estilo general del telefono.</p>
            </div>

            <div class={styles.identityGrid}>
              <label class={styles.field}>
                <span>Username Snap</span>
                <input value={snapUsername()} onInput={(event) => setSnapUsername(sanitizeUsername(event.currentTarget.value))} placeholder='snap.user' />
              </label>

              <label class={styles.field}>
                <span>Username Chirp</span>
                <input value={chirpUsername()} onInput={(event) => setChirpUsername(sanitizeUsername(event.currentTarget.value))} placeholder='chirp.user' />
              </label>

              <label class={styles.field}>
                <span>Username Clips</span>
                <input value={clipsUsername()} onInput={(event) => setClipsUsername(sanitizeUsername(event.currentTarget.value))} placeholder='clips.user' />
              </label>
            </div>

            <div class={styles.preferenceStack}>
              <div class={styles.preferenceGroup}>
                <div class={styles.preferenceHeader}>
                  <strong>Apariencia</strong>
                  <span>Elige como quieres ver el sistema.</span>
                </div>
                <div class={styles.optionGrid}>
                  {THEMES.map((option) => (
                    <button
                      type='button'
                      class={styles.optionCard}
                      classList={{ [styles.optionCardActive]: theme() === option.value }}
                      onClick={() => setTheme(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.meta}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div class={styles.preferenceGroup}>
                <div class={styles.preferenceHeader}>
                  <strong>Perfil de audio</strong>
                  <span>Ajusta el comportamiento base para tus llamadas y alertas.</span>
                </div>
                <div class={styles.optionGrid}>
                  {AUDIO_PROFILES.map((option) => (
                    <button
                      type='button'
                      class={styles.optionCard}
                      classList={{ [styles.optionCardActive]: audioProfile() === option.value }}
                      onClick={() => setAudioProfile(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.meta}</span>
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

        <div class={styles.footer}>
          <p class={styles.hint}>
            Este setup es obligatorio y define tus cuentas iniciales para usar el telefono desde el primer desbloqueo.
          </p>

          <div class={styles.buttonRow}>
            <button type='button' class={styles.secondaryButton} onClick={goBack} disabled={step() === 0 || loading()}>
              Atras
            </button>

            <Show
              when={step() === STEP_LABELS.length - 1}
              fallback={
                <button type='button' class={styles.primaryButton} onClick={goNext} disabled={loading()}>
                  Continuar
                </button>
              }
            >
              <button type='button' class={styles.primaryButton} onClick={() => void submitSetup()} disabled={loading()}>
                {loading() ? 'Guardando...' : 'Finalizar configuracion'}
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
