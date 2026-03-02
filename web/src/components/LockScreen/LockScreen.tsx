import { createSignal, Show, createEffect, batch, onCleanup, onMount } from 'solid-js';
import { usePhone } from '../../store/phone';
import { useNotifications } from '../../store/notifications';
import styles from './LockScreen.module.scss';

export function LockScreen() {
  const [, phoneActions] = usePhone();
  const [notifications, notificationsActions] = useNotifications();
  const [code, setCode] = createSignal('');
  const [error, setError] = createSignal(false);
  const [attempts, setAttempts] = createSignal(0);
  const [currentTime, setCurrentTime] = createSignal(new Date());
  
  let timer: number | undefined;
  
  onMount(() => {
    timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
  });
  
  onCleanup(() => {
    if (timer) clearInterval(timer);
  });
  
  const handleKeyPress = (num: string) => {
    if (code().length < 4) {
      setCode(prev => prev + num);
    }
  };
  
  const handleDelete = () => {
    setCode(prev => prev.slice(0, -1));
  };
  
  createEffect(() => {
    if (code().length === 4) {
      setTimeout(() => {
        if (phoneActions.unlock(code())) {
          batch(() => {
            setCode('');
            setAttempts(0);
          });
        } else {
          batch(() => {
            setError(true);
            setAttempts(prev => prev + 1);
            setCode('');
          });
          
          setTimeout(() => setError(false), 500);
        }
      }, 100);
    }
  });
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };
  
  const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  
  return (
    <div class={styles.lockScreen}>
      <div class={styles.glassLayer} />

      <div class={styles.statusBar}>
        <span>{formatTime(currentTime())}</span>
        <div class={styles.statusIcons}>
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>

      <div class={styles.timeContainer}>
        <div class={styles.time}>{formatTime(currentTime())}</div>
        <div class={styles.date}>{formatDate(currentTime())}</div>
        <div class={styles.quickToggles}>
          <button class={styles.quickBtn} classList={{ [styles.active]: notifications.doNotDisturb }} onClick={() => notificationsActions.setDoNotDisturb(!notifications.doNotDisturb)}>
            No molestar
          </button>
          <button class={styles.quickBtn} onClick={() => notificationsActions.toggleControlCenter()}>
            Centro control
          </button>
        </div>
      </div>

      <div class={styles.codeCard}>
        <div class={styles.codeContainer}>
          <div class={styles.dots}>
            {[0, 1, 2, 3].map(i => (
              <div 
                class={styles.dot}
                classList={{
                  [styles.filled]: i < code().length,
                  [styles.error]: error()
                }}
              />
            ))}
          </div>
          
          <Show when={attempts() > 0}>
            <div class={styles.errorMsg}>
              Codigo incorrecto ({attempts()} intentos)
            </div>
          </Show>
        </div>

        <div class={styles.keypad}>
          {keypadKeys.map(key => (
            <Show when={key !== ''}>
              <button
                class={styles.key}
                onClick={() => key === 'del' ? handleDelete() : handleKeyPress(key)}
              >
                {key === 'del' ? '⌫' : key}
              </button>
            </Show>
          ))}
        </div>
      </div>

      <div class={styles.bottomActions}>
        <button class={styles.bottomBtn}>🔦</button>
        <button class={styles.bottomBtn}>📷</button>
      </div>
    </div>
  );
}
