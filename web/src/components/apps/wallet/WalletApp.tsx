import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';
import { formatPhoneNumber } from '../../../utils/misc';
import { usePhone } from '../../../store/phone';
import { uiAlert } from '../../../utils/uiAlert';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { AppScaffold } from '../../shared/layout';
import { EmptyState } from '../../shared/ui/EmptyState';
import { FormField, FormSection, Modal, ModalActions, ModalButton } from '../../shared/ui/Modal';
import { t } from '../../../i18n';
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
  const [phoneState] = usePhone();
  const [balance, setBalance] = createSignal(0);
  const [cards, setCards] = createSignal<WalletCard[]>([]);
  const [tx, setTx] = createSignal<WalletTx[]>([]);
  const [contacts, setContacts] = createSignal<{ display: string; number: string }[]>([]);
  const [nearbyPlayers, setNearbyPlayers] = createSignal<NearbyPlayer[]>([]);
  const [loading, setLoading] = createSignal(true);

  const [showCreateInvoice, setShowCreateInvoice] = createSignal(false);
  const [showAddCardModal, setShowAddCardModal] = createSignal(false);
  const [showProximityModal, setShowProximityModal] = createSignal(false);
  const [targetMode, setTargetMode] = createSignal<TargetMode>('nearby');
  const [targetServerId, setTargetServerId] = createSignal<number | null>(null);
  const [targetPhone, setTargetPhone] = createSignal('');
  const [targetIdentifier, setTargetIdentifier] = createSignal('');
  const [nfcAmount, setNfcAmount] = createSignal('');
  const [nfcTitle, setNfcTitle] = createSignal('Factura');
  const [incomingInvoice, setIncomingInvoice] = createSignal<InvoicePayload | null>(null);
  const [lastNfcRouteKey, setLastNfcRouteKey] = createSignal('');
  const [cardLabelInput, setCardLabelInput] = createSignal('');
  const [cardLast4Input, setCardLast4Input] = createSignal('');
  const [proximityPhoneInput, setProximityPhoneInput] = createSignal('');
  const [proximityAmountInput, setProximityAmountInput] = createSignal('');
  const [proximityTitleInput, setProximityTitleInput] = createSignal('');
  const language = () => phoneState.settings.language || 'es';

  const targetModes: { id: TargetMode; label: string; helper: string }[] = [
    { id: 'nearby', label: t('wallet.mode.nearby', language()), helper: t('wallet.mode.nearby_helper', language()) },
    { id: 'contact', label: t('wallet.mode.contact', language()), helper: t('wallet.mode.contact_helper', language()) },
    { id: 'phone', label: t('wallet.mode.phone', language()), helper: t('wallet.mode.phone_helper', language()) },
    { id: 'identifier', label: 'ID', helper: t('wallet.mode.identifier_helper', language()) },
  ];

  const sanitizedCardLast4 = createMemo(() => cardLast4Input().replace(/\D/g, '').slice(0, 4));
  const canAddCard = createMemo(() => cardLabelInput().trim().length > 0 && /^\d{4}$/.test(sanitizedCardLast4()));
  const canSendProximity = createMemo(() => {
    const amount = Number(proximityAmountInput() || '0');
    return proximityPhoneInput().trim().length > 0 && Number.isFinite(amount) && amount > 0;
  });
  const canCreateInvoice = createMemo(() => {
    const amount = Number(nfcAmount() || '0');
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if (targetMode() === 'nearby') return targetServerId() !== null;
    if (targetMode() === 'identifier') return targetIdentifier().trim().length > 0;
    return targetPhone().trim().length > 0;
  });
  const selectedNearbyLabel = createMemo(() => {
    const selected = nearbyPlayers().find((player) => player.serverId === targetServerId());
    if (!selected) return t('wallet.none_selected', language());
    return `${selected.name} (${selected.distance}m)`;
  });

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

  const openAddCardModal = () => {
    setCardLabelInput('');
    setCardLast4Input('');
    setShowAddCardModal(true);
  };

  const addCard = async () => {
    const label = cardLabelInput().trim();
    const last4 = sanitizedCardLast4();
    if (!label || !/^\d{4}$/.test(last4)) return;

    const result = await fetchNui<{ success?: boolean }>('walletAddCard', { label, last4, color: '#007aff' }, { success: false });
    if (result.success) {
      setShowAddCardModal(false);
      void load();
    }
  };

  const openProximityModal = () => {
    setProximityPhoneInput('');
    setProximityAmountInput('');
    setProximityTitleInput('Pago NFC');
    setShowProximityModal(true);
  };

  const proximityTransfer = async () => {
    const targetPhone = proximityPhoneInput().trim();
    const amount = Number(proximityAmountInput() || '0');
    const title = proximityTitleInput().trim() || 'Pago NFC';
    if (!targetPhone || !Number.isFinite(amount) || amount <= 0) return;

    const result = await fetchNui<{ success?: boolean; balance?: number; error?: string; distance?: number; maxDistance?: number }>(
      'walletProximityTransfer',
      { targetPhone, amount, title, method: 'nfc' },
      { success: false }
    );

    if (result.success) {
      setShowProximityModal(false);
      setBalance(Number(result.balance || 0));
      void load();
      return;
    }

    if (result.error === 'TOO_FAR') {
      uiAlert(t('wallet.error.too_far', language(), { max: (result.maxDistance || 3).toFixed(1), distance: (result.distance || 0).toFixed(2) }));
      return;
    }

    if (result.error === 'TARGET_OFFLINE') {
      uiAlert(t('wallet.error.target_offline', language()));
      return;
    }

    uiAlert(result.error || t('wallet.error.proximity_failed', language()));
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
      title: nfcTitle().trim() || t('wallet.invoice', language()),
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
      uiAlert(result?.error || t('wallet.error.create_invoice', language()));
      return;
    }

    setShowCreateInvoice(false);
    setNfcAmount('');
      setNfcTitle(t('wallet.invoice', language()));
    if (result.channel === 'remote') {
      uiAlert(t('wallet.remote_invoice_sent', language()));
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
      uiAlert(result?.error || t('wallet.error.payment_failed', language()));
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

  const closeAddCardModal = () => setShowAddCardModal(false);
  const closeProximityModal = () => setShowProximityModal(false);
  const closeInvoiceModal = () => setShowCreateInvoice(false);

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
      if (showAddCardModal()) {
        setShowAddCardModal(false);
        return;
      }
      if (showProximityModal()) {
        setShowProximityModal(false);
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
    <AppScaffold title={t('wallet.title', language())} subtitle={t('wallet.subtitle', language())} onBack={() => router.goBack()} bodyClass={styles.walletApp}>
      <div class={styles.walletApp}>
        <div class={styles.balanceSection}>
          <div class={styles.balanceLabel}>{t('wallet.balance', language())}</div>
          <div class={styles.balanceAmount}>{formatMoney(balance())}</div>
          <div class={styles.balanceActions}>
            <button class={styles.actionBtn} onClick={() => void openInvoiceModal()}>{t('wallet.invoice', language())}</button>
            <button class={styles.actionBtn} onClick={openAddCardModal}>{t('wallet.add_card', language())}</button>
          </div>
          <div class={styles.quickPayRow}>
            <button class={styles.quickPayBtn} onClick={openProximityModal}>{t('wallet.nfc_payment', language())}</button>
          </div>
        </div>

        <button class={styles.nfcHintBtn} onClick={() => void openInvoiceModal()}>{t('wallet.create_invoice_hint', language())}</button>

        <div class={styles.section}>
          <div class={styles.sectionTitle}>{t('wallet.cards', language())}</div>
          <Show when={!loading()} fallback={<EmptyState class={styles.emptyState} title={t('state.loading', language())} />}>
            <Show when={cards().length > 0} fallback={<EmptyState class={styles.emptyState} title={t('wallet.no_cards', language())} description={t('wallet.no_cards_desc', language())} />}>
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
          <div class={styles.sectionTitle}>{t('wallet.recent_activity', language())}</div>
          <Show when={tx().length > 0} fallback={<EmptyState class={styles.emptyState} title={t('wallet.no_transactions', language())} description={t('wallet.no_transactions_desc', language())} />}>
            <div class={styles.transactionsList}>
              <For each={tx()}>
                {(item) => (
                  <div class={styles.transactionItem}>
                    <div class={styles.transactionInfo}>
                        <div class={styles.transactionTitle}>{item.title || t('wallet.transaction', language())}</div>
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

        <button class={styles.addCardFab} onClick={openAddCardModal}>+</button>

        <Modal open={showAddCardModal()} title={t('wallet.add_card', language())} onClose={closeAddCardModal} size="md">
          <div class={styles.modalBody}>
            <p class={styles.modalIntro}>{t('wallet.add_card_desc', language())}</p>

            <FormField
              label={t('contacts.field.name', language())}
              value={cardLabelInput()}
              onChange={setCardLabelInput}
              placeholder="Ej: Visa principal"
            />

            <FormField
              label={t('wallet.last_four', language())}
              type="tel"
              value={sanitizedCardLast4()}
              onChange={(value) => setCardLast4Input(value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
            />

            <div class={styles.helperText}>{t('wallet.card_helper', language())}</div>
          </div>

          <ModalActions>
            <ModalButton label={t('action.cancel', language())} onClick={closeAddCardModal} />
            <ModalButton label={t('notes.save', language())} tone="primary" onClick={() => void addCard()} disabled={!canAddCard()} />
          </ModalActions>
        </Modal>

        <Modal open={showProximityModal()} title="Pago NFC" onClose={closeProximityModal} size="md">
          <div class={styles.modalBody}>
            <p class={styles.modalIntro}>Envia un pago cercano a otro numero y completa la transaccion desde Wallet.</p>

            <FormField
              label="Numero destino"
              type="tel"
              value={proximityPhoneInput()}
              onChange={setProximityPhoneInput}
              placeholder="Numero del destinatario"
            />

            <Show when={contacts().length > 0}>
              <FormSection label="Contactos recientes">
                <div class={styles.optionList}>
                  <For each={contacts().slice(0, 4)}>
                    {(contact) => (
                      <button class={styles.optionCard} onClick={() => setProximityPhoneInput(contact.number)}>
                        <strong>{contact.display}</strong>
                        <span>{formatPhoneNumber(contact.number, phoneState.framework || 'unknown')}</span>
                      </button>
                    )}
                  </For>
                </div>
              </FormSection>
            </Show>

            <div class={styles.formGrid}>
              <FormField
                label="Monto"
                type="number"
                value={proximityAmountInput()}
                onChange={setProximityAmountInput}
                placeholder="0"
              />

              <FormField
                label="Concepto"
                value={proximityTitleInput()}
                onChange={setProximityTitleInput}
                placeholder="Motivo del pago"
              />
            </div>
          </div>

          <ModalActions>
            <ModalButton label="Cancelar" onClick={closeProximityModal} />
            <ModalButton label="Enviar" tone="primary" onClick={() => void proximityTransfer()} disabled={!canSendProximity()} />
          </ModalActions>
        </Modal>

        <Modal open={showCreateInvoice()} title="Nueva factura" onClose={closeInvoiceModal} size="md">
          <div class={styles.modalBody}>
            <p class={styles.modalIntro}>Cobra por NFC a un jugador cercano o envia una factura remota sin salir de Wallet.</p>

            <FormSection label="Destino">
              <div class={styles.segmentedGrid}>
                <For each={targetModes}>
                  {(mode) => (
                    <button
                      class={styles.segmentButton}
                      classList={{ [styles.activeSegment]: targetMode() === mode.id }}
                      onClick={() => setTargetMode(mode.id)}
                    >
                      <span>{mode.label}</span>
                      <small>{mode.helper}</small>
                    </button>
                  )}
                </For>
              </div>
            </FormSection>

            <Show when={targetMode() === 'nearby'}>
              <FormSection label="Jugador cercano">
                <Show
                  when={nearbyPlayers().length > 0}
                  fallback={<div class={styles.emptyPicker}>No hay jugadores cerca para NFC ahora mismo.</div>}
                >
                  <div class={styles.optionList}>
                    <For each={nearbyPlayers()}>
                      {(player) => (
                        <button
                          class={styles.optionCard}
                          classList={{ [styles.optionCardActive]: targetServerId() === player.serverId }}
                          onClick={() => setTargetServerId(player.serverId)}
                        >
                          <strong>{player.name}</strong>
                          <span>ID {player.serverId} - {player.distance}m</span>
                        </button>
                      )}
                    </For>
                  </div>
                  <div class={styles.helperText}>Seleccionado: {selectedNearbyLabel()}</div>
                </Show>
              </FormSection>
            </Show>

            <Show when={targetMode() === 'contact'}>
              <FormSection label="Contacto guardado">
                <Show when={contacts().length > 0} fallback={<div class={styles.emptyPicker}>No tienes contactos guardados todavia.</div>}>
                  <div class={styles.optionList}>
                    <For each={contacts().slice(0, 8)}>
                      {(contact) => (
                        <button
                          class={styles.optionCard}
                          classList={{ [styles.optionCardActive]: targetPhone() === contact.number }}
                          onClick={() => setTargetPhone(contact.number)}
                        >
                          <strong>{contact.display}</strong>
                          <span>{formatPhoneNumber(contact.number, phoneState.framework || 'unknown')}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </FormSection>
            </Show>

            <Show when={targetMode() === 'phone'}>
              <FormField
                label="Numero manual"
                type="tel"
                value={targetPhone()}
                onChange={setTargetPhone}
                placeholder="Numero de telefono"
              />
            </Show>

            <Show when={targetMode() === 'identifier'}>
              <FormField
                label="Identifier"
                value={targetIdentifier()}
                onChange={setTargetIdentifier}
                placeholder="steam:, license:, citizenid..."
              />
            </Show>

            <div class={styles.formGrid}>
              <FormField
                label="Monto"
                type="number"
                value={nfcAmount()}
                onChange={setNfcAmount}
                placeholder="0"
              />

              <FormField
                label="Concepto"
                value={nfcTitle()}
                onChange={setNfcTitle}
                placeholder="Factura"
              />
            </div>
          </div>

          <ModalActions>
            <ModalButton label="Cancelar" onClick={closeInvoiceModal} />
            <ModalButton label="Enviar factura" tone="primary" onClick={() => void createInvoice()} disabled={!canCreateInvoice()} />
          </ModalActions>
        </Modal>

        <Modal
          open={Boolean(incomingInvoice())}
          title={incomingInvoice()?.channel === 'nfc' ? 'Cobro NFC recibido' : 'Factura recibida'}
          onClose={() => setIncomingInvoice(null)}
          size="sm"
        >
          <div class={styles.invoiceModalBody}>
            <p class={styles.modalIntro}><strong>{incomingInvoice()?.fromName}</strong> te solicita este pago:</p>
            <div class={styles.invoiceAmount}>{formatMoney(incomingInvoice()?.amount || 0)}</div>
            <div class={styles.invoiceTitle}>{incomingInvoice()?.title}</div>
          </div>

          <Show when={incomingInvoice()?.channel === 'nfc'} fallback={
            <ModalActions>
              <ModalButton label="Rechazar" onClick={() => void respondInvoice(false)} />
              <ModalButton label="Pagar banco" tone="primary" onClick={() => void respondInvoice(true, 'bank')} />
            </ModalActions>
          }>
            <div class={styles.invoiceActionsRow3}>
              <button class={styles.invoiceAction} onClick={() => void respondInvoice(false)}>Rechazar</button>
              <button class={styles.invoiceAction} onClick={() => void respondInvoice(true, 'cash')}>Pagar cash</button>
              <button class={`${styles.invoiceAction} ${styles.invoiceActionPrimary}`} onClick={() => void respondInvoice(true, 'bank')}>Pagar banco</button>
            </div>
          </Show>
        </Modal>
      </div>
    </AppScaffold>
  );
}
