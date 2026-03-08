import { createEffect, createSignal } from 'solid-js';
import { FormField, Modal, ModalActions, ModalButton } from './Modal';
import styles from './SocialOnboardingModal.module.scss';

interface SocialOnboardingPayload {
  username: string;
  displayName: string;
}

interface SocialOnboardingModalProps {
  open: boolean;
  appName: string;
  description?: string;
  usernameHint?: string;
  displayNameHint?: string;
  onCreate: (payload: SocialOnboardingPayload) => Promise<boolean | { ok: boolean; error?: string }>;
  onClose?: () => void;
}

function normalizeUsername(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+/, '')
    .slice(0, 24);
}

export function SocialOnboardingModal(props: SocialOnboardingModalProps) {
  const [username, setUsername] = createSignal('');
  const [displayName, setDisplayName] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  createEffect(() => {
    if (!props.open) return;

    setError('');
    setSubmitting(false);
    setUsername((prev) => prev || normalizeUsername(props.usernameHint || ''));
    setDisplayName((prev) => prev || (props.displayNameHint || '').trim());
  });

  const submit = async () => {
    const normalizedUsername = normalizeUsername(username());
    const normalizedDisplayName = displayName().trim().slice(0, 32);

    if (normalizedUsername.length < 3) {
      setError('El usuario debe tener al menos 3 caracteres validos.');
      return;
    }

    if (!normalizedDisplayName) {
      setError('Ingresa un nombre visible.');
      return;
    }

    setSubmitting(true);
    setError('');

    const result = await props.onCreate({
      username: normalizedUsername,
      displayName: normalizedDisplayName,
    });

    const ok = typeof result === 'boolean' ? result : result.ok;
    const reason = typeof result === 'boolean' ? '' : (result.error || 'No se pudo crear la cuenta.');

    if (!ok) {
      setError(reason || 'No se pudo crear la cuenta.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    props.onClose?.();
  };

  return (
    <Modal open={props.open} title={`Configurar ${props.appName}`} onClose={() => props.onClose?.()} size="md">
      <p class={styles.description}>{props.description || `Crea tu cuenta de ${props.appName} para publicar, seguir y recibir solicitudes.`}</p>

      <FormField
        label="Usuario"
        value={username()}
        onChange={(value) => setUsername(normalizeUsername(value))}
        placeholder="usuario"
        disabled={submitting()}
      />

      <FormField
        label="Nombre visible"
        value={displayName()}
        onChange={setDisplayName}
        placeholder="Tu nombre"
        disabled={submitting()}
      />

      <p class={styles.hint}>Solo letras, numeros, punto, guion y guion bajo para el usuario.</p>

      {error() && <div class={styles.error}>{error()}</div>}

      <ModalActions>
        <ModalButton label="Mas tarde" onClick={() => props.onClose?.()} disabled={submitting()} />
        <ModalButton label={submitting() ? 'Creando...' : 'Crear cuenta'} tone="primary" onClick={() => void submit()} disabled={submitting()} />
      </ModalActions>
    </Modal>
  );
}

export type { SocialOnboardingPayload };
