import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
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

export function WalletApp() {
  const router = useRouter();
  const [balance, setBalance] = createSignal(0);
  const [cards, setCards] = createSignal<WalletCard[]>([]);
  const [tx, setTx] = createSignal<WalletTx[]>([]);
  const [loading, setLoading] = createSignal(true);

  const load = async () => {
    setLoading(true);
    const data = await fetchNui<{ balance?: number; cards?: WalletCard[]; transactions?: WalletTx[] }>('walletGetState', {}, { balance: 0, cards: [], transactions: [] });
    setBalance(Number(data.balance || 0));
    setCards(data.cards || []);
    setTx(data.transactions || []);
    setLoading(false);
  };

  const transfer = async () => {
    const targetPhone = window.prompt('Numero destino') || '';
    const amount = Number(window.prompt('Monto') || '0');
    const title = window.prompt('Concepto') || 'Transferencia';
    if (!targetPhone || !Number.isFinite(amount) || amount <= 0) return;

    const result = await fetchNui<{ success?: boolean; balance?: number; error?: string }>('walletTransfer', { targetPhone, amount, title }, { success: false });
    if (result.success) {
      setBalance(Number(result.balance || 0));
      void load();
      return;
    }
    window.alert(result.error || 'Transferencia fallida');
  };

  const addCard = async () => {
    const label = window.prompt('Nombre de tarjeta') || '';
    const last4 = window.prompt('Ultimos 4 digitos') || '';
    if (!label || !/^\d{4}$/.test(last4)) return;

    const result = await fetchNui<{ success?: boolean }>('walletAddCard', { label, last4, color: '#2E3B57' }, { success: false });
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

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  createEffect(() => {
    void load();
  });

  return (
    <div class="ios-page">
      <div class="ios-nav">
        <button class="ios-icon-btn" onClick={() => router.goBack()}>‹</button>
        <div class="ios-nav-title">Wallet</div>
      </div>

      <div class="ios-content">
        <div class={styles.balanceCard}>
          <span>Saldo disponible</span>
          <strong>${balance().toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <div class={styles.actions}>
            <button class="ios-btn ios-btn-primary" onClick={() => void transfer()}>Transferir</button>
            <button class="ios-btn" onClick={() => void proximityTransfer('qr')}>Pagar QR</button>
            <button class="ios-btn" onClick={() => void proximityTransfer('nfc')}>Pagar NFC</button>
            <button class="ios-btn" onClick={() => void addCard()}>Agregar tarjeta</button>
          </div>
        </div>

        <div class="ios-section-title">Tarjetas</div>
        <Show when={!loading()} fallback={<div class="ios-card">Cargando...</div>}>
          <div class={styles.cardsGrid}>
            <For each={cards()}>
              {(card) => (
                <article class={styles.cardItem} style={{ 'background-color': card.color || '#2E3B57' }}>
                  <strong>{card.label}</strong>
                  <span>•••• {card.last4}</span>
                  <button onClick={() => void removeCard(card.id)}>Quitar</button>
                </article>
              )}
            </For>
          </div>
        </Show>

        <div class="ios-section-title">Actividad</div>
        <div class="ios-list">
          <For each={tx()}>
            {(item) => (
              <div class="ios-row">
                <div>
                  <div class="ios-label">{item.title || 'Movimiento'}</div>
                  <div class="ios-value">{new Date(item.created_at).toLocaleString('es-ES')}</div>
                </div>
                <span class={item.type === 'out' ? styles.out : styles.in}>
                  {item.type === 'out' ? '-' : '+'}${Number(item.amount || 0).toFixed(2)}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
