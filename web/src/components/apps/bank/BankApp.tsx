import { createMemo, createSignal, Show, createEffect, onCleanup, For, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ScreenState } from '../../shared/ui/ScreenState';
import { SkeletonList } from '../../shared/ui/SkeletonList';
import { getStoredLanguage, t } from '../../../i18n';
import styles from './BankApp.module.scss';

interface BankInvoice {
  invoiceId: string;
  fromName: string;
  amount: number;
  title: string;
  channel: 'remote' | 'nfc';
}

export function BankApp() {
  const router = useRouter();
  const language = () => getStoredLanguage();
  const [balance, setBalance] = createSignal(0);
  const [transactions, setTransactions] = createSignal<any[]>([]);
  const [showTransfer, setShowTransfer] = createSignal(false);
  const [transferAmount, setTransferAmount] = createSignal('');
  const [transferTarget, setTransferTarget] = createSignal('');
  const [contacts, setContacts] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [incomingInvoice, setIncomingInvoice] = createSignal<BankInvoice | null>(null);
  const [lastRouteKey, setLastRouteKey] = createSignal('');
  
  const loadData = async () => {
    setLoading(true);
    const bal = await fetchNui('getBankBalance', undefined, 15000);
    setBalance(bal || 0);
    
    const trans = await fetchNui('getBankTransactions', undefined, []);
    setTransactions(trans || []);
    
    const cont = await fetchNui('getContactsForTransfer', undefined, []);
    setContacts(cont || []);
    setLoading(false);
  };
  
  onMount(() => {
    loadData();
  });
  
  usePhoneKeyHandler({
    Backspace: () => {
      if (incomingInvoice()) {
        setIncomingInvoice(null);
        return;
      }
      if (showTransfer()) {
        setShowTransfer(false);
        return;
      }
      router.goBack();
    },
  });

  createEffect(() => {
    const params = router.params() as { nfcAction?: string; requestId?: number; invoice?: BankInvoice } | undefined;
    if (!params) return;

    const key = `${params.requestId || 0}:${params.nfcAction || 'none'}:${params.invoice?.invoiceId || ''}`;
    if (key === lastRouteKey()) return;
    setLastRouteKey(key);

    if (params.nfcAction === 'incoming_invoice' && params.invoice) {
      setIncomingInvoice(params.invoice);
    }
  });

  createEffect(() => {
    const onBankEvent = (event: MessageEvent) => {
      if ((event?.data?.action === 'bankInvoiceReceived' || event?.data?.action === 'bankTransferReceived') && event.data.data) {
        setIncomingInvoice(event.data.data as BankInvoice);
      }

      if (event?.data?.action === 'bankInvoiceResult') {
        void loadData();
      }
    };

    window.addEventListener('message', onBankEvent);
    onCleanup(() => window.removeEventListener('message', onBankEvent));
  });

  const respondInvoice = async (accept: boolean) => {
    const invoice = incomingInvoice();
    if (!invoice) return;

    const result = await fetchNui<{ success?: boolean; error?: string }>('walletRespondInvoice', {
      invoiceId: invoice.invoiceId,
      accept,
      paymentMethod: 'bank'
    }, { success: false });

    if (!result?.success && accept) {
      setError(result?.error || 'No se pudo pagar la factura');
      return;
    }

    setIncomingInvoice(null);
    setError(null);
    void loadData();
  };
  
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
    return '$' + amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  return (
    <AppScaffold title={t('app.bank', language())} subtitle={t('bank.subtitle', language())} onBack={() => router.goBack()} bodyClass={styles.bankApp}>
      <div class={styles.bankApp}>
        {/* Balance Section */}
        <div class={styles.balanceSection}>
          <div class={styles.balanceLabel}>{t('bank.available_balance', language())}</div>
          <div class={styles.balanceAmount}>{formatMoney(balance())}</div>
          <div class={styles.balanceActions}>
            <button class={styles.actionBtn} onClick={() => setShowTransfer(true)}>
              {t('bank.transfer', language())}
            </button>
          </div>
        </div>

        {/* Transactions Section */}
        <div class={styles.section}>
          <div class={styles.sectionTitle}>{t('bank.movements', language())}</div>
          <Show when={loading()} fallback={
            <Show when={transactions().length > 0} fallback={
              <EmptyState class={styles.emptyState} title={t('bank.no_movements', language())} description={t('bank.no_movements_desc', language())} />
            }>
              <div class={styles.transactionsList}>
                <For each={transactions()}>
                  {(tx) => (
                    <div class={styles.transactionItem}>
                      <div class={styles.transactionInfo}>
                        <div class={styles.transactionTitle}>{tx.description || t('bank.transfer', language())}</div>
                        <div class={styles.transactionDate}>{tx.time}</div>
                      </div>
                      <div 
                        class={styles.transactionAmount}
                        classList={{ 
                          [styles.positive]: tx.amount >= 0,
                          [styles.negative]: tx.amount < 0
                        }}
                      >
                        {tx.amount >= 0 ? '+' : ''}{formatMoney(Math.abs(tx.amount))}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          }>
            <SkeletonList rows={6} />
          </Show>
        </div>

        {/* Transfer Modal */}
        <Show when={showTransfer()}>
          <div class={styles.modalOverlay} onClick={() => setShowTransfer(false)}>
            <div class={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2 class={styles.modalTitle}>{t('bank.new_transfer', language())}</h2>
              
              <div class={styles.formGroup}>
                <label>{t('bank.recipient', language())}</label>
                <select 
                  value={transferTarget()}
                  onChange={(e) => setTransferTarget(e.currentTarget.value)}
                >
                  <option value="">{t('bank.select_contact', language())}</option>
                  <For each={contacts()}>
                    {(contact) => (
                      <option value={contact.number}>{contact.display}</option>
                    )}
                  </For>
                </select>
              </div>
              
              <div class={styles.formGroup}>
                <label>{t('wallet.amount', language())}</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={transferAmount()}
                  onInput={(e) => setTransferAmount(e.currentTarget.value)}
                />
              </div>
              
              <Show when={error()}>
                <div class={styles.errorMessage}>
                  {error()}
                </div>
              </Show>
              
              <div class={styles.modalActions}>
                <button class={styles.cancelBtn} onClick={() => setShowTransfer(false)}>
                  {t('action.cancel', language())}
                </button>
                <button class={styles.sendBtn} onClick={handleTransfer}>
                  {t('mail.send', language())}
                </button>
              </div>
            </div>
          </div>
        </Show>

        <Show when={incomingInvoice()}>
          <div class={styles.modalOverlay}>
            <div class={styles.modalContent}>
              <h2 class={styles.modalTitle}>{t('bank.remote_invoice', language())}</h2>
              <div class={styles.formGroup}>
                <label>{t('bank.sender', language())}</label>
                <input type="text" value={incomingInvoice()?.fromName || ''} disabled />
              </div>
              <div class={styles.formGroup}>
                <label>{t('wallet.concept', language())}</label>
                <input type="text" value={incomingInvoice()?.title || ''} disabled />
              </div>
              <div class={styles.formGroup}>
                <label>{t('wallet.amount', language())}</label>
                <input type="text" value={formatMoney(incomingInvoice()?.amount || 0)} disabled />
              </div>

              <div class={styles.modalActions}>
                <button class={styles.cancelBtn} onClick={() => void respondInvoice(false)}>
                  {t('wallet.reject', language())}
                </button>
                <button class={styles.sendBtn} onClick={() => void respondInvoice(true)}>
                  {t('wallet.pay_bank', language())}
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </AppScaffold>
  );
}
