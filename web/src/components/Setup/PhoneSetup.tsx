import { Show, createSignal } from 'solid-js';
import { usePhone } from '../../store/phone';
import styles from './PhoneSetup.module.scss';

export function PhoneSetup() {
  const [phoneState, phoneActions] = usePhone();
  const [pin, setPin] = createSignal('');
  const [snapUsername, setSnapUsername] = createSignal('');
  const [chirpUsername, setChirpUsername] = createSignal('');
  const [clipsUsername, setClipsUsername] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const submitSetup = async () => {
    if (loading()) return;

    const payload = {
      pin: pin().trim(),
      snapUsername: snapUsername().trim(),
      chirpUsername: chirpUsername().trim(),
      clipsUsername: clipsUsername().trim(),
    };

    if (!payload.pin || payload.pin.length < 4) {
      setError('PIN invalido (minimo 4 digitos)');
      return;
    }

    if (!payload.snapUsername || !payload.chirpUsername || !payload.clipsUsername) {
      setError('Debes completar los 3 usernames');
      return;
    }

    setLoading(true);
    setError('');
    const result = await phoneActions.completeSetup(payload);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'No se pudo completar el setup');
      return;
    }

    await phoneActions.refreshSetupState();
    phoneActions.lock();
  };

  return (
    <div class={styles.setupRoot}>
      <div class={styles.card}>
        <h2>Configura tu iPhone</h2>
        <p>Antes de usar el telefono, crea tu PIN y usernames para Snap, Chirp y Clips.</p>

        <label>
          PIN
          <input
            value={pin()}
            onInput={(event) => setPin(event.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            inputmode="numeric"
          />
        </label>

        <label>
          Username Snap
          <input value={snapUsername()} onInput={(event) => setSnapUsername(event.currentTarget.value.toLowerCase())} placeholder="snap.user" />
        </label>

        <label>
          Username Chirp
          <input value={chirpUsername()} onInput={(event) => setChirpUsername(event.currentTarget.value.toLowerCase())} placeholder="chirp.user" />
        </label>

        <label>
          Username Clips
          <input value={clipsUsername()} onInput={(event) => setClipsUsername(event.currentTarget.value.toLowerCase())} placeholder="clips.user" />
        </label>

        <Show when={error()}>
          <p class={styles.error}>{error()}</p>
        </Show>

        <button disabled={loading()} onClick={() => void submitSetup()}>
          {loading() ? 'Guardando...' : 'Finalizar configuracion'}
        </button>

        <p class={styles.hint}>El setup es obligatorio y define tus identidades sociales iniciales.</p>
      </div>
    </div>
  );
}
