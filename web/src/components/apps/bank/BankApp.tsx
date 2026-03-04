import { createMemo, createSignal, Show, createEffect, onCleanup, For } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { ScreenState } from '../../shared/ui/ScreenState';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import styles from './BankApp.module.scss';

export function BankApp() {
  const router = useRouter();
  const [balance, setBalance] = createSignal(0);
  const [transactions, setTransactions] = createSignal<any[]>([]);
  const [showTransfer, setShowTransfer] = createSignal(false);
  const [transferAmount, setTransferAmount] = createSignal('');
  const [transferTarget, setTransferTarget] = createSignal('');
  const [contacts, setContacts] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const transactionCount = createMemo(() => transactions().length);
  
  const loadData = async () => {
    const bal = await fetchNui('getBankBalance', undefined, 15000);
    setBalance(bal || 0);
    
    const trans = await fetchNui('getBankTransactions', undefined, []);
    setTransactions(trans || []);
    
    const cont = await fetchNui('getContactsForTransfer', undefined, []);
    setContacts(cont || []);
    setLoading(false);
  };
  
  createEffect(() => {
    loadData();
  });
  
  createEffect(() => {
    const handleKeyUp = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') {
        router.goBack();
      }
    };
    
    window.addEventListener('phone:keyUp', handleKeyUp as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', handleKeyUp as EventListener));
  });
  
  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount());
    if (!amount || amount <= 0 || !transferTarget()) return;
    
    const result = await fetchNui<{ success?: boolean }>('transferMoney', {
      targetNumber: transferTarget(),
      amount
    });
    
    if (result?.success) {
      setError(null);
      setShowTransfer(false);
      setTransferAmount('');
      setTransferTarget('');
      loadData();
    } else {
      setError('No se pudo completar la transferencia.');
    }
  };
  
  const formatMoney = (amount: number) => {
    return '$' + amount.toLocaleString('en-US');
  };
  
  return (
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>
          ‹
        </button>
        <div class="ios-nav-title">Bank Prime</div>
      </div>
      
      <div class="ios-content">
      <div class={styles.balanceCard}>
        <span class={styles.label}>Saldo disponible</span>
        <span class={styles.amount}>{formatMoney(balance())}</span>
        <div class={styles.balanceMeta}>
          <span>Movimientos</span>
          <strong>{transactionCount()}</strong>
        </div>
      </div>
      
      <div class={styles.actions}>
        <button class={styles.actionBtn} onClick={() => setShowTransfer(true)}>
          Transferir
        </button>
      </div>
      
      <div class={styles.transactions}>
        <h3>Movimientos</h3>
        <Show when={loading()} fallback={<ScreenState loading={false} error={error()} empty={transactions().length === 0} emptyTitle="Sin movimientos" emptyDescription="Tus transferencias apareceran aqui.">
          <For each={transactions()}>
            {(tx) => (
              <div class={styles.transactionItem}>
                <div class={styles.info}>
                  <span class={styles.desc}>{tx.description || 'Transferencia'}</span>
                  <span class={styles.date}>{tx.time}</span>
                </div>
                <span class={styles.amount} classList={{ [styles.positive]: tx.amount >= 0, [styles.negative]: tx.amount < 0 }}>
                  {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
                </span>
              </div>
            )}
          </For>
        </ScreenState>}>
          <SkeletonList rows={6} />
        </Show>
      </div>
      </div>
      
      <Show when={showTransfer()}>
        <div class={styles.modal}>
          <div class={styles.modalContent}>
            <h2>Nueva transferencia</h2>
            
            <div class={styles.formGroup}>
              <label>Destinatario</label>
              <select 
                value={transferTarget()}
                onChange={(e) => setTransferTarget(e.currentTarget.value)}
              >
                <option value="">Seleccionar contacto</option>
                <For each={contacts()}>
                  {(contact) => (
                    <option value={contact.number}>{contact.display}</option>
                  )}
                </For>
              </select>
            </div>
            
            <div class={styles.formGroup}>
              <label>Monto</label>
              <input
                type="number"
                placeholder="0.00"
                value={transferAmount()}
                onInput={(e) => setTransferAmount(e.currentTarget.value)}
              />
            </div>
            
            <div class={styles.modalActions}>
              <button class={styles.cancelBtn} onClick={() => setShowTransfer(false)}>
                Cancelar
              </button>
              <button class={styles.sendBtn} onClick={handleTransfer}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
