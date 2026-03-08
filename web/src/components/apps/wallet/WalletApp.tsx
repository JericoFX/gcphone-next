import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { uiPrompt } from '../../../utils/uiDialog';
import { uiAlert } from '../../../utils/uiAlert';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import styles from './WalletApp.module.scss';

interface WalletCard {
  id: number;
  label: string;
  last4: string;
  color?: string;
}

interface WalletTx {
  id: number;
  amount: number;
  type: 'in' | 'out' | 'adjust';
  title: string;
  target_phone?: string;
  created_at: string;
}

interface InvoicePayload {
  invoiceId: string;
  fromName: string;
  amount: number;
  title: string;
  channel: 'nfc' | 'remote';
  expiresAt?: number;
}

interface NearbyPlayer {
  serverId: number;
  name: string;
  distance: number;
}

type TargetMode = 'nearby' | 'contact' | 'phone' | 'identifier';

export function WalletApp() {
  const router = useRouter();
  const [balance, setBalance] = createSignal(0);
  const [cards, setCards] = createSignal<WalletCard[]>([]);
  const [tx, setTx] = createSignal<WalletTx[]>([]);
  const [contacts, setContacts] = createSignal<{ display: string; number: string }[]>([]);
  const [nearbyPlayers, setNearbyPlayers] = createSignal<NearbyPlayer[]>([]);
  const [loading, setLoading] = createSignal(true);

  const [showCreateInvoice, setShowCreateInvoice] = createSignal(false);
  const [targetMode, setTargetMode] = createSignal<TargetMode>('nearby');
  const [targetServerId, setTargetServerId] = createSignal<number | null>(null);
  const [targetPhone, setTargetPhone] = createSignal('');
  const [targetIdentifier, setTargetIdentifier] = createSignal('');
  const [nfcAmount, setNfcAmount] = createSignal('');
  const [nfcTitle, setNfcTitle] = createSignal('Factura');
  const [incomingInvoice, setIncomingInvoice] = createSignal<InvoicePayload | null>(null);
  const [lastNfcRouteKey, setLastNfcRouteKey] = createSignal('');

  const formatMoney = (amount: number) => '$' + amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = async () => {
    setLoading(true);
    const [walletData, contactData, nearby] = await Promise.all([
      fetchNui<{ balance?: number; cards?: WalletCard[]; transactions?: WalletTx[] }>('walletGetState', {}, { balance: 0, cards: [], transactions: [] }),
      fetchNui<{ display: string; number: string }[]>('getContactsForTransfer', {}, []),
      fetchNui<NearbyPlayer[]>('getNearbyPlayers', {}, []),
    ]);

    setBalance(Number(walletData.balance || 0));
    setCards(walletData.cards || []);
    setTx(walletData.transactions || []);
    setContacts(contactData || []);
    setNearbyPlayers(nearby || []);
    setLoading(false);
  };

  const addCard = async () => {
    const label = (await uiPrompt('Nombre de tarjeta', { title: 'Agregar tarjeta' })) || '';
    const last4 = (await uiPrompt('Ultimos 4 digitos', { title: 'Agregar tarjeta' })) || '';
    if (!label || !/^\d{4}$/.test(last4)) return;

    const result = await fetchNui<{ success?: boolean }>('walletAddCard', { label, last4, color: '#007aff' }, { success: false });
    if (result.success) void load();
  };

  const proximityTransfer = async (method: 'qr' | 'nfc') => {
    const targetPhone = (await uiPrompt(method === 'qr' ? 'Numero destino (QR)' : 'Numero destino (NFC)', { title: 'Transferencia' })) || '';
    const amount = Number((await uiPrompt('Monto', { title: 'Transferencia' })) || '0');
    const title = (await uiPrompt('Concepto', { title: 'Transferencia' })) || (method === 'qr' ? 'Pago QR' : 'Pago NFC');
    if (!targetPhone || !Number.isFinite(amount) || amount <= 0) return;

    const result = await fetchNui<{ success?: boolean; balance?: number; error?: string; distance?: number; maxDistance?: number }>(
      'walletProximityTransfer',
      { targetPhone, amount, title, method },
      { success: false }
    );

    if (result.success) {
      setBalance(Number(result.balance || 0));
      void load();
      return;
    }

    if (result.error === 'TOO_FAR') {
      uiAlert(`Debes acercarte mas (${(result.maxDistance || 3).toFixed(1)}m max). Distancia: ${(result.distance || 0).toFixed(2)}m`);
      return;
    }

    if (result.error === 'TARGET_OFFLINE') {
      uiAlert('La persona debe estar conectada y cerca para pago QR/NFC');
      return;
    }

    uiAlert(result.error || 'Pago de proximidad fallido');
  };

  const removeCard = async (cardId: number) => {
    const result = await fetchNui<{ success?: boolean }>('walletRemoveCard', { cardId }, { success: false });
    if (result.success) void load();
  };

  const createInvoice = async () => {
    const amount = Number(nfcAmount());
    if (!Number.isFinite(amount) || amount <= 0) return;

    const payload: Record<string, unknown> = {
      amount,
      title: nfcTitle().trim() || 'Factura',
    };

    if (targetMode() === 'nearby') {
      if (!targetServerId()) return;
      payload.targetServerId = targetServerId();
    }

    if (targetMode() === 'contact' || targetMode() === 'phone') {
      if (!targetPhone().trim()) return;
      payload.targetPhone = targetPhone().trim();
    }

    if (targetMode() === 'identifier') {
      if (!targetIdentifier().trim()) return;
      payload.targetIdentifier = targetIdentifier().trim();
    }

    const result = await fetchNui<{ success?: boolean; error?: string; channel?: 'nfc' | 'remote' }>('walletCreateInvoice', payload, { success: false });
    if (!result?.success) {
      uiAlert(result?.error || 'No se pudo crear la factura');
      return;
    }

    setShowCreateInvoice(false);
    setNfcAmount('');
    setNfcTitle('Factura');
    if (result.channel === 'remote') {
      uiAlert('Factura remota enviada. Le aparecera en Banco al destinatario.');
    }
  };

  const respondInvoice = async (accept: boolean, paymentMethod?: 'cash' | 'bank') => {
    const invoice = incomingInvoice();
    if (!invoice) return;

    const result = await fetchNui<{ success?: boolean; error?: string }>('walletRespondInvoice', {
      invoiceId: invoice.invoiceId,
      accept,
      paymentMethod,
    }, { success: false });

    if (!result?.success && accept) {
      uiAlert(result?.error || 'No se pudo completar el pago');
      return;
    }

    setIncomingInvoice(null);
    void load();
  };

  const openInvoiceModal = async () => {
    await load();
    setTargetMode('nearby');
    const firstNearby = nearbyPlayers()[0];
    setTargetServerId(firstNearby ? firstNearby.serverId : null);
    setTargetPhone('');
    setTargetIdentifier('');
    setShowCreateInvoice(true);
  };

  usePhoneKeyHandler({
    Backspace: () => {
      if (incomingInvoice()) {
        setIncomingInvoice(null);
        return;
      }
      if (showCreateInvoice()) {
        setShowCreateInvoice(false);
        return;
      }
      router.goBack();
    },
  });

  createEffect(() => {
    const params = router.params() as { nfcAction?: string; targetServerId?: number; requestId?: number; invoice?: InvoicePayload } | undefined;
    if (!params) return;

    const key = `${params.requestId || 0}:${params.nfcAction || 'none'}:${params.targetServerId || ''}:${params.invoice?.invoiceId || ''}`;
    if (key === lastNfcRouteKey()) return;
    setLastNfcRouteKey(key);

    if (params.nfcAction === 'create_invoice' && typeof params.targetServerId === 'number') {
      setTargetMode('nearby');
      setTargetServerId(params.targetServerId);
      setShowCreateInvoice(true);
    }

    if (params.nfcAction === 'incoming_invoice' && params.invoice) {
      setIncomingInvoice(params.invoice);
    }
  });

  createEffect(() => {
    const onWalletEvent = (event: MessageEvent) => {
      if (event?.data?.action === 'walletNfcInvoiceReceived' && event.data.data) {
        setIncomingInvoice(event.data.data as InvoicePayload);
      }
      if (event?.data?.action === 'walletNfcInvoiceResult') {
        void load();
      }
    };
    window.addEventListener('message', onWalletEvent);
    onCleanup(() => window.removeEventListener('message', onWalletEvent));
  });

  onMount(() => {
    void load();
  });

  return (
    <AppScaffold title="Wallet" subtitle="Tu dinero y facturas" onBack={() => router.goBack()} bodyClass={styles.walletApp}>
      <div class={styles.walletApp}>
        <div class={styles.balanceSection}>
          <div class={styles.balanceLabel}>Saldo Wallet</div>
          <div class={styles.balanceAmount}>{formatMoney(balance())}</div>
          <div class={styles.balanceActions}>
            <button class={styles.actionBtn} onClick={() => void openInvoiceModal()}>Factura</button>
            <button class={styles.actionBtn} onClick={() => void addCard()}>Agregar tarjeta</button>
          </div>
        </div>

        <button class={styles.nfcHintBtn} onClick={() => void openInvoiceModal()}>Crear factura: NFC o remota</button>

        <div class={styles.section}>
          <div class={styles.sectionTitle}>Tarjetas</div>
          <Show when={!loading()} fallback={<div class={styles.emptyState}>Cargando...</div>}>
            <Show when={cards().length > 0} fallback={<div class={styles.emptyState}><p>Sin tarjetas</p><p>Agrega una tarjeta para verla aqui</p></div>}>
              <div class={styles.cardsList}>
                <For each={cards()}>
                  {(card) => (
                    <div class={styles.cardItem}>
                      <div class={styles.cardIcon} style={{ background: card.color || '#007aff' }}>
                        <img src="./img/icons_ios/wallet.svg" alt="" />
                      </div>
                      <div class={styles.cardInfo}>
                        <div class={styles.cardName}>{card.label}</div>
                        <div class={styles.cardNumber}>•••• {card.last4}</div>
                      </div>
                      <button class={styles.cardDelete} onClick={() => void removeCard(card.id)}>
                        <img src="./img/icons_ios/ui-close.svg" alt="" />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        <div class={styles.section}>
          <div class={styles.sectionTitle}>Actividad reciente</div>
          <Show when={tx().length > 0} fallback={<div class={styles.emptyState}><p>Sin movimientos</p><p>Tus transacciones apareceran aqui</p></div>}>
            <div class={styles.transactionsList}>
              <For each={tx()}>
                {(item) => (
                  <div class={styles.transactionItem}>
                    <div class={styles.transactionInfo}>
                      <div class={styles.transactionTitle}>{item.title || 'Movimiento'}</div>
                      <div class={styles.transactionDate}>{new Date(item.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div class={styles.transactionAmount} classList={{ [styles.in]: item.type === 'in', [styles.out]: item.type === 'out', [styles.adjust]: item.type === 'adjust' }}>
                      {item.type === 'out' ? '-' : item.type === 'in' ? '+' : ''}
                      {formatMoney(Math.abs(item.amount))}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <button class={styles.addCardFab} onClick={() => void addCard()}>+</button>

        <Show when={showCreateInvoice()}>
          <div class={styles.nfcModalOverlay}>
            <div class={styles.nfcModal}>
              <h3>Nueva factura</h3>
              <p>Elige destino y monto.</p>

              <select value={targetMode()} onChange={(e) => setTargetMode(e.currentTarget.value as TargetMode)}>
                <option value="nearby">Jugador cercano (NFC)</option>
                <option value="contact">Contacto guardado</option>
                <option value="phone">Numero manual</option>
                <option value="identifier">ID manual</option>
              </select>

              <Show when={targetMode() === 'nearby'}>
                <select value={String(targetServerId() || '')} onChange={(e) => setTargetServerId(Number(e.currentTarget.value) || null)}>
                  <option value="">Seleccionar cercano</option>
                  <For each={nearbyPlayers()}>{(p) => <option value={p.serverId}>{p.name} (ID {p.serverId}, {p.distance}m)</option>}</For>
                </select>
              </Show>

              <Show when={targetMode() === 'contact'}>
                <select value={targetPhone()} onChange={(e) => setTargetPhone(e.currentTarget.value)}>
                  <option value="">Seleccionar contacto</option>
                  <For each={contacts()}>{(c) => <option value={c.number}>{c.display} ({c.number})</option>}</For>
                </select>
              </Show>

              <Show when={targetMode() === 'phone'}>
                <input type="text" placeholder="Numero" value={targetPhone()} onInput={(e) => setTargetPhone(e.currentTarget.value)} />
              </Show>

              <Show when={targetMode() === 'identifier'}>
                <input type="text" placeholder="Identifier" value={targetIdentifier()} onInput={(e) => setTargetIdentifier(e.currentTarget.value)} />
              </Show>

              <input type="number" placeholder="Monto" value={nfcAmount()} onInput={(e) => setNfcAmount(e.currentTarget.value)} />
              <input type="text" placeholder="Concepto" value={nfcTitle()} onInput={(e) => setNfcTitle(e.currentTarget.value)} />

              <div class={styles.nfcActions}>
                <button onClick={() => setShowCreateInvoice(false)}>Cancelar</button>
                <button class={styles.primary} onClick={() => void createInvoice()}>Enviar factura</button>
              </div>
            </div>
          </div>
        </Show>

        <Show when={incomingInvoice()}>
          <div class={styles.nfcModalOverlay}>
            <div class={styles.nfcModal}>
              <h3>{incomingInvoice()?.channel === 'nfc' ? 'Cobro NFC recibido' : 'Factura recibida'}</h3>
              <p><strong>{incomingInvoice()?.fromName}</strong> te solicita:</p>
              <div class={styles.invoiceAmount}>{formatMoney(incomingInvoice()?.amount || 0)}</div>
              <div class={styles.invoiceTitle}>{incomingInvoice()?.title}</div>

              <Show when={incomingInvoice()?.channel === 'nfc'} fallback={
                <div class={styles.nfcActions}>
                  <button onClick={() => void respondInvoice(false)}>Rechazar</button>
                  <button class={styles.primary} onClick={() => void respondInvoice(true, 'bank')}>Pagar banco</button>
                </div>
              }>
                <div class={styles.nfcActionsRow3}>
                  <button onClick={() => void respondInvoice(false)}>Rechazar</button>
                  <button onClick={() => void respondInvoice(true, 'cash')}>Pagar cash</button>
                  <button class={styles.primary} onClick={() => void respondInvoice(true, 'bank')}>Pagar banco</button>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </AppScaffold>
  );
}
