import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
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
    const label = window.prompt('Nombre de tarjeta') || '';
    const last4 = window.prompt('Ultimos 4 digitos') || '';
    if (!label || !/^\d{4}$/.test(last4)) return;

    const result = await fetchNui<{ success?: boolean }>('walletAddCard', { label, last4, color: '#007aff' }, { success: false });
    if (result.success) void load();
  };

  const proximityTransfer = async (method: 'qr' | 'nfc') => {
    const targetPhone = window.prompt(method === 'qr' ? 'Numero destino (QR)' : 'Numero destino (NFC)') || '';
    const amount = Number(window.prompt('Monto') || '0');
    const title = window.prompt('Concepto') || (method === 'qr' ? 'Pago QR' : 'Pago NFC');
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
      window.alert(`Debes acercarte mas (${(result.maxDistance || 3).toFixed(1)}m max). Distancia: ${(result.distance || 0).toFixed(2)}m`);
      return;
    }

    if (result.error === 'TARGET_OFFLINE') {
      window.alert('La persona debe estar conectada y cerca para pago QR/NFC');
      return;
    }

    window.alert(result.error || 'Pago de proximidad fallido');
  };

  const removeCard = async (cardId: number) => {
    const result = await fetchNui<{ success?: boolean }>('walletRemoveCard', { cardId }, { success: false });
    if (result.success) void load();
  };

<<<<<<< HEAD
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
      window.alert(result?.error || 'No se pudo crear la factura');
      return;
    }

    setShowCreateInvoice(false);
    setNfcAmount('');
    setNfcTitle('Factura');
    if (result.channel === 'remote') {
      window.alert('Factura remota enviada. Le aparecera en Banco al destinatario.');
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
      window.alert(result?.error || 'No se pudo completar el pago');
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
=======
  const createRequest = async (method: 'qr' | 'nfc') => {
    const targetPhone = window.prompt(method === 'qr' ? 'Numero para solicitar pago QR' : 'Numero para solicitar pago NFC') || '';
    const amount = Number(window.prompt('Monto') || '0');
    const title = window.prompt('Concepto') || (method === 'qr' ? 'Solicitud QR' : 'Solicitud NFC');
    if (!targetPhone || !Number.isFinite(amount) || amount <= 0) return;

    const result = await fetchNui<{ success?: boolean; error?: string }>('walletCreateRequest', { targetPhone, amount, title, method }, { success: false });
    if (!result.success) {
      window.alert(result.error || 'No se pudo crear la solicitud');
      return;
    }

    window.alert('Solicitud enviada');
  };

  const reviewRequests = async () => {
    const result = await fetchNui<{ incoming?: Array<{ id: number; requesterPhone: string; amount: number; title?: string; method?: string }> }>(
      'walletGetPendingRequests',
      {},
      { incoming: [] }
    );

    const incoming = result.incoming || [];
    if (incoming.length === 0) {
      window.alert('No tienes solicitudes pendientes');
      return;
    }

    const first = incoming[0];
    const shouldAccept = window.confirm(`Solicitud de ${first.requesterPhone} - $${Number(first.amount || 0).toFixed(2)}\n${first.title || 'Pago'}\nAceptar?`);
    const response = await fetchNui<{ success?: boolean; error?: string; balance?: number }>(
      'walletRespondRequest',
      { requestId: first.id, accept: shouldAccept },
      { success: false }
    );

    if (!response.success) {
      window.alert(response.error || 'No se pudo responder la solicitud');
      return;
    }

    if (shouldAccept) {
      setBalance(Number(response.balance || 0));
      void load();
    }
>>>>>>> 6087054b2c17bad903d1ba2a08f953f8451a6489
  };

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail !== 'Backspace') return;
      if (incomingInvoice()) {
        setIncomingInvoice(null);
        return;
      }
      if (showCreateInvoice()) {
        setShowCreateInvoice(false);
        return;
      }
      router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
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

  createEffect(() => {
    void load();
  });

  return (
<<<<<<< HEAD
    <AppScaffold title="Wallet" subtitle="Tu dinero y facturas" onBack={() => router.goBack()} bodyClass={styles.walletApp}>
      <div class={styles.walletApp}>
        <div class={styles.balanceSection}>
          <div class={styles.balanceLabel}>Saldo Wallet</div>
          <div class={styles.balanceAmount}>{formatMoney(balance())}</div>
          <div class={styles.balanceActions}>
            <button class={styles.actionBtn} onClick={() => void openInvoiceModal()}>Factura</button>
            <button class={styles.actionBtn} onClick={() => void addCard()}>Agregar tarjeta</button>
=======
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>‹</button>
        <div class="ios-nav-title">Wallet Elite</div>
      </div>

      <div class="ios-content">
        <div class={styles.balanceCard}>
          <span>Saldo disponible</span>
          <strong>${balance().toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <div class={styles.metaRow}>
            <span>Tarjetas</span>
            <b>{cards().length}</b>
          </div>
          <div class={styles.actions}>
            <button class="ios-btn ios-btn-primary" onClick={() => void transfer()}>Transferir</button>
            <button class="ios-btn" onClick={() => void proximityTransfer('qr')}>Pagar QR</button>
            <button class="ios-btn" onClick={() => void proximityTransfer('nfc')}>Pagar NFC</button>
            <button class="ios-btn" onClick={() => void createRequest('qr')}>Solicitar QR</button>
            <button class="ios-btn" onClick={() => void createRequest('nfc')}>Solicitar NFC</button>
            <button class="ios-btn" onClick={() => void reviewRequests()}>Solicitudes</button>
            <button class="ios-btn" onClick={() => void addCard()}>Agregar tarjeta</button>
>>>>>>> 6087054b2c17bad903d1ba2a08f953f8451a6489
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
