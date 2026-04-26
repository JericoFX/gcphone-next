import { For, Show, createMemo, createSignal } from 'solid-js';
import { usePhone } from '../../store/phone';
import { t } from '../../i18n';
import type { AppLanguage } from '../../i18n';
import type { PhoneSetupPayload } from '../../types';
import { languages } from '../apps/settings/settingsShared';
import styles from './PhoneSetup.module.scss';

const STEP_LABELS = ['setup.step.language', 'setup.step.security', 'setup.step.identity', 'setup.step.summary', 'setup.step.theme'] as const;

function sanitizeUsername(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '').slice(0, 32);
}

function sanitizeMailAlias(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '').slice(0, 24);
}

function hasAlphaCharacter(value: string) {
  return /[a-z]/.test(value);
}

function isValidHandle(value: string) {
  return (
    value.length >= 3 &&
    value.length <= 32 &&
    hasAlphaCharacter(value) &&
    !/^[._-]/.test(value) &&
    !/[._-]{2,}/.test(value)
  );
}

function isValidMailAlias(value: string) {
  return (
    value.length >= 3 &&
    value.length <= 24 &&
    hasAlphaCharacter(value) &&
    !/^[._-]|[._-]$/.test(value) &&
    !value.includes('..')
  );
}

function humanizeError(code: string | undefined, language: AppLanguage) {
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

function summaryText(language: AppLanguage) {
  const texts: Record<string, Record<string, string>> = {
    en: { summaryTitle: 'Review your setup', summaryDesc: 'Check your data before finishing.', reviewLanguage: 'Language', reviewPin: 'PIN', reviewMail: 'Mail', reviewSnap: 'Snap', reviewChirp: 'Chirp', reviewClips: 'Clips', hiddenPin: 'Configured' },
    pt: { summaryTitle: 'Revise sua configuracao', summaryDesc: 'Confira seus dados antes de finalizar.', reviewLanguage: 'Idioma', reviewPin: 'PIN', reviewMail: 'Mail', reviewSnap: 'Snap', reviewChirp: 'Chirp', reviewClips: 'Clips', hiddenPin: 'Configurado' },
    fr: { summaryTitle: 'Verifiez votre configuration', summaryDesc: 'Controlez vos donnees avant de terminer.', reviewLanguage: 'Langue', reviewPin: 'PIN', reviewMail: 'Mail', reviewSnap: 'Snap', reviewChirp: 'Chirp', reviewClips: 'Clips', hiddenPin: 'Configure' },
    es: { summaryTitle: 'Revisa tu configuracion', summaryDesc: 'Comprueba tus datos antes de terminar.', reviewLanguage: 'Idioma', reviewPin: 'PIN', reviewMail: 'Mail', reviewSnap: 'Snap', reviewChirp: 'Chirp', reviewClips: 'Clips', hiddenPin: 'Configurado' },
  };
  return texts[language] || texts.es;
}

function PhonePreviewSvg(props: { theme: 'light' | 'dark' | 'auto' }) {
  const lightBg = '#f2f2f7';
  const darkBg = '#000000';
  const lightSurface = '#ffffff';
  const darkSurface = '#1c1c1e';
  const lightText = '#111111';
  const darkText = '#ffffff';
  const lightNav = '#f8f8fa';
  const darkNav = '#1c1c1e';

  const bg = () => props.theme === 'dark' ? darkBg : lightBg;
  const surface = () => props.theme === 'dark' ? darkSurface : lightSurface;
  const text = () => props.theme === 'dark' ? darkText : lightText;
  const nav = () => props.theme === 'dark' ? darkNav : lightNav;

  return (
    <svg viewBox="0 0 140 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="136" height="256" rx="20" fill={bg()} stroke="var(--border)" stroke-width="2"/>
      <rect x="42" y="6" width="56" height="6" rx="3" fill={props.theme === 'dark' ? '#333' : '#ddd'}/>
      <rect x="6" y="18" width="128" height="28" rx="4" fill={nav()}/>
      <rect x="14" y="28" width="40" height="6" rx="2" fill={text()} opacity="0.6"/>
      <rect x="6" y="54" width="128" height="36" rx="8" fill={surface()}/>
      <rect x="14" y="62" width="50" height="5" rx="2" fill={text()} opacity="0.5"/>
      <rect x="14" y="72" width="30" height="4" rx="2" fill={text()} opacity="0.2"/>
      <rect x="6" y="96" width="128" height="36" rx="8" fill={surface()}/>
      <rect x="14" y="104" width="60" height="5" rx="2" fill={text()} opacity="0.5"/>
      <rect x="14" y="114" width="35" height="4" rx="2" fill={text()} opacity="0.2"/>
      <rect x="6" y="138" width="128" height="36" rx="8" fill={surface()}/>
      <rect x="14" y="146" width="45" height="5" rx="2" fill={text()} opacity="0.5"/>
      <rect x="14" y="156" width="28" height="4" rx="2" fill={text()} opacity="0.2"/>
      <Show when={props.theme === 'auto'}>
        <clipPath id="rightHalf"><rect x="70" y="2" width="70" height="256"/></clipPath>
        <g clip-path="url(#rightHalf)">
          <rect x="2" y="2" width="136" height="256" rx="20" fill={darkBg}/>
          <rect x="42" y="6" width="56" height="6" rx="3" fill="#333"/>
          <rect x="6" y="18" width="128" height="28" rx="4" fill={darkNav}/>
          <rect x="14" y="28" width="40" height="6" rx="2" fill={darkText} opacity="0.6"/>
          <rect x="6" y="54" width="128" height="36" rx="8" fill={darkSurface}/>
          <rect x="14" y="62" width="50" height="5" rx="2" fill={darkText} opacity="0.5"/>
          <rect x="14" y="72" width="30" height="4" rx="2" fill={darkText} opacity="0.2"/>
          <rect x="6" y="96" width="128" height="36" rx="8" fill={darkSurface}/>
          <rect x="14" y="104" width="60" height="5" rx="2" fill={darkText} opacity="0.5"/>
          <rect x="14" y="114" width="35" height="4" rx="2" fill={darkText} opacity="0.2"/>
          <rect x="6" y="138" width="128" height="36" rx="8" fill={darkSurface}/>
          <rect x="14" y="146" width="45" height="5" rx="2" fill={darkText} opacity="0.5"/>
          <rect x="14" y="156" width="28" height="4" rx="2" fill={darkText} opacity="0.2"/>
        </g>
      </Show>
      <rect x="46" y="244" width="48" height="4" rx="2" fill={text()} opacity="0.3"/>
    </svg>
  );
}

export function PhoneSetup() {
  const [phoneState, phoneActions] = usePhone();
  const [step, setStep] = createSignal(0);
  const [pin, setPin] = createSignal('');
  const [mailAlias, setMailAlias] = createSignal('');
  const [snapUsername, setSnapUsername] = createSignal('');
  const [chirpUsername, setChirpUsername] = createSignal('');
  const [clipsUsername, setClipsUsername] = createSignal('');
  const [language, setLanguage] = createSignal<AppLanguage>(phoneState.settings.language || 'es');
  const [theme, setTheme] = createSignal<'auto' | 'light' | 'dark'>('auto');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const currentLanguage = () => language();
  const copy = createMemo(() => summaryText(currentLanguage()));

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

  const selectedLanguageLabel = createMemo(() => {
    const selected = languages.find((entry) => entry.code === language());
    return selected?.name || language();
  });

  const setupHighlights = createMemo(() => [
    { label: t('setup.step.language', currentLanguage()), value: selectedLanguageLabel() },
    { label: t('setup.step.security', currentLanguage()), value: pin().length === 4 ? copy().hiddenPin : t('setup.security.pin', currentLanguage()) },
    { label: t('setup.security.mail_alias', currentLanguage()), value: mailAlias() ? `${mailAlias()}@${mailDomain()}` : mailDomain() },
  ]);

  return (
    <div class={styles.setupRoot}>
      <div class={styles.card}>
        <div class={styles.hero}>
          <p class={styles.eyebrow}>{t('setup.hero.eyebrow', currentLanguage())}</p>
          <h2>{t('setup.hero.title', currentLanguage())}</h2>
          <p class={styles.lead}>{t('setup.hero.lead', currentLanguage())}</p>
          <div class={styles.heroSummary}>
            <For each={setupHighlights()}>
              {(item) => (
                <div class={styles.heroSummaryItem}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              )}
            </For>
          </div>
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
              <div class="ios18-list">
                <For each={languages}>
                  {(lang) => (
                    <button
                      class="ios18-cell"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setLanguage(lang.code as AppLanguage)}
                    >
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
                        <span style={{ 'font-size': 'var(--fs-caption1)', 'font-weight': '700', color: 'var(--text-2)', 'min-width': '24px' }}>{lang.label}</span>
                        <span class="ios18-cell__title">{lang.name}</span>
                      </div>
                      <Show when={language() === lang.code}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8.5L6.5 12L13 4" stroke="var(--tint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </Show>
                    </button>
                  )}
                </For>
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
          </Show>

          <Show when={step() === 4}>
            <section class={styles.section}>
              <div class={styles.sectionHeader}>
                <h3>{t('setup.theme.title', currentLanguage()) || 'Tema'}</h3>
                <p>{t('setup.theme.description', currentLanguage()) || 'Elige como se ve tu telefono'}</p>
              </div>
              <div class={styles.themePicker}>
                <div class={styles.themePreview}>
                  <PhonePreviewSvg theme={theme()} />
                </div>
                <div class={`ios-segment ${styles.themeSegment}`}>
                  <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': theme() === 'light' }} onClick={() => setTheme('light')}>Light</button>
                  <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': theme() === 'dark' }} onClick={() => setTheme('dark')}>Dark</button>
                  <button class="ios-segment-btn" classList={{ 'ios-segment-btn-active': theme() === 'auto' }} onClick={() => setTheme('auto')}>Auto</button>
                </div>
                <p class={styles.themeHint}>
                  {t('setup.theme.auto_hint', currentLanguage()) || 'Auto usa el tema del sistema'}
                </p>
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
    </div>
  );
}
