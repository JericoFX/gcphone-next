import { createSignal, For, Show } from 'solid-js';
import { useContacts } from '../../../store/contacts';
import { useRouter } from '../../Phone/PhoneFrame';
import { sanitizePhone, sanitizeText } from '../../../utils/sanitize';
import { fetchKnownNui } from '../../../utils/fetchNui';
import { useNotifications } from '../../../store/notifications';
import { uiPrompt } from '../../../utils/uiDialog';
import { getStoredLanguage, t } from '../../../i18n';
import { NfcShareSheet } from './NfcShareSheet';
import styles from './ActionSheet.module.scss';

export type ShareDestination = 'messages' | 'wavechat' | 'mail' | 'chirp' | 'snap' | 'nfc';

export interface SharePayload {
  text?: string;
  mediaUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
  subject?: string;
  appId?: string;
  route?: string;
  title?: string;
  message?: string;
  x?: number;
  y?: number;
  z?: number;
}

interface ShareSheetProps {
  open: boolean;
  payload: SharePayload;
  destinations?: ShareDestination[];
  onClose: () => void;
  onShared?: (destination: ShareDestination, phoneNumber?: string) => void;
}

const DEFAULT_DESTINATIONS: ShareDestination[] = ['messages', 'wavechat', 'mail', 'chirp', 'snap', 'nfc'];

const DESTINATION_LABELS: Record<ShareDestination, string> = {
  messages: 'Messages',
  wavechat: 'WaveChat',
  mail: 'Mail',
  chirp: 'Chirp',
  snap: 'Snap',
  nfc: 'NFC',
};

const DESTINATION_ICONS: Record<ShareDestination, string> = {
  messages: '\u{1F4AC}',
  wavechat: '\u{1F30A}',
  mail: '\u{2709}\u{FE0F}',
  chirp: '\u{1F426}',
  snap: '\u{1F4F8}',
  nfc: 'NFC',
};

export function ShareSheet(props: ShareSheetProps) {
  const router = useRouter();
  const [contactsState] = useContacts();
  const [, notificationsActions] = useNotifications();
  const [step, setStep] = createSignal<'destinations' | 'contacts'>('destinations');
  const [selectedDest, setSelectedDest] = createSignal<ShareDestination | null>(null);
  const [selectedContacts, setSelectedContacts] = createSignal<Set<string>>(new Set<string>());
  const [multiSelect, setMultiSelect] = createSignal(false);
  const [nfcOpen, setNfcOpen] = createSignal(false);
  const [nfcSharing, setNfcSharing] = createSignal(false);
  const language = () => getStoredLanguage();

  const destinations = () => props.destinations || DEFAULT_DESTINATIONS;

  const close = () => {
    setStep('destinations');
    setSelectedDest(null);
    setSelectedContacts(new Set<string>());
    setMultiSelect(false);
    setNfcOpen(false);
    props.onClose();
  };

  const inferNfcRoute = () => {
    const p = props.payload;
    const text = `${p.text || ''} ${p.subject || ''}`.trim().toUpperCase();
    if (p.route) return p.route;
    if (p.appId) return p.appId;
    if (text.includes('LOC:')) return 'maps';
    if (text.startsWith('SNAP:') || text.includes(' SNAP:')) return 'snap';
    if (text.startsWith('CLIP:') || text.includes(' CLIP:')) return 'clips';
    if (text.startsWith('CHIRP:') || text.includes(' CHIRP:')) return 'chirp';
    if (text.startsWith('RADIO:') || text.includes(' RADIO:')) return 'radio';
    if (text.startsWith('SERVICE:') || text.includes(' SERVICE:')) return 'services';
    if (p.attachmentType === 'document') return 'documents';
    if (p.mediaUrl) return 'gallery';
    return 'notes';
  };

  const extractLocCoords = () => {
    const match = `${props.payload.text || ''} ${props.payload.subject || ''}`.match(/LOC:([-\d.]+),\s*([-\d.]+)/i);
    if (!match) return {};
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return {};
    return { x, y };
  };

  const shareNfc = async (targetServerId: number) => {
    const route = inferNfcRoute();
    const coords = route === 'maps' ? extractLocCoords() : {};
    setNfcSharing(true);
    const result = await fetchKnownNui('shareNfcPayload', {
      targetServerId,
      payload: {
        ...props.payload,
        ...coords,
        appId: props.payload.appId || route,
        route,
        title: props.payload.title || 'NFC',
        message: props.payload.message || props.payload.subject || props.payload.text || 'Contenido compartido',
        nfcAction: props.payload.route || props.payload.appId ? 'received_payload' : `received_${route}`,
      },
    }, { success: false });
    setNfcSharing(false);
    setNfcOpen(false);

    notificationsActions.receive({
      appId: 'system',
      title: 'NFC',
      message: result?.success ? 'Compartido por NFC' : (result?.error || 'Error al compartir'),
      priority: 'normal',
    });

    if (result?.success) close();
  };

  const navigateToApp = (dest: ShareDestination, phoneNumber?: string) => {
    const p = props.payload;
    switch (dest) {
      case 'messages':
      case 'wavechat':
        if (phoneNumber) {
          router.navigate(dest, {
            phoneNumber,
            attachmentUrl: p.mediaUrl,
            message: p.text,
          });
        }
        break;
      case 'mail':
        router.navigate('mail', {
          compose: '1',
          subject: p.subject || '',
          body: p.text || '',
          attachmentUrl: p.mediaUrl,
          attachmentType: p.attachmentType || 'link',
          attachmentName: p.attachmentName || '',
        });
        break;
      case 'chirp':
        router.navigate('chirp', {
          composeText: p.text || '',
          composeMedia: p.mediaUrl || '',
        });
        break;
      case 'snap':
        router.navigate('snap', {
          composeMedia: p.mediaUrl || '',
          composeCaption: p.text || '',
        });
        break;
      case 'nfc':
        setNfcOpen(true);
        return;
    }
    props.onShared?.(dest, phoneNumber);
    close();
  };

  const selectDestination = (dest: ShareDestination) => {
    if (dest === 'messages' || dest === 'wavechat') {
      setSelectedDest(dest);
      setStep('contacts');
    } else if (dest === 'nfc') {
      setNfcOpen(true);
    } else {
      navigateToApp(dest);
    }
  };

  const toggleContact = (number: string) => {
    if (!multiSelect()) {
      sendToContacts([number]);
      return;
    }
    const next = new Set(selectedContacts());
    if (next.has(number)) next.delete(number);
    else next.add(number);
    setSelectedContacts(next);
  };

  const sendToContacts = (numbers: string[]) => {
    const dest = selectedDest();
    if (!dest) return;
    for (const number of numbers) {
      navigateToApp(dest, number);
    }
  };

  const enterManualNumber = async () => {
    const input = await uiPrompt(t('messages.prompt.new_chat_number', language()), { title: t('messages.new_chat', language()) });
    const number = sanitizePhone(input);
    if (!number) return;
    const dest = selectedDest();
    if (dest) navigateToApp(dest, number);
  };

  return (
    <Show when={props.open}>
      <div class={styles.overlay} onClick={close}>
        <div class={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <Show when={step() === 'destinations'}>
            <div class={styles.title}>{t('action.share', language())}</div>
            <div class={styles.list}>
              <For each={destinations()}>
                {(dest) => (
                  <button class={`${styles.action} ${styles.primary}`} onClick={() => selectDestination(dest)}>
                    {DESTINATION_ICONS[dest]} {DESTINATION_LABELS[dest]}
                  </button>
                )}
              </For>
            </div>
          </Show>

          <Show when={step() === 'contacts'}>
            <div class={styles.title}>
              {DESTINATION_LABELS[selectedDest()!]} — {t('contacts.title', language()) || 'Contactos'}
            </div>
            <div class={styles.list} style={{ 'max-height': '280px', 'overflow-y': 'auto' }}>
              <button class={styles.action} onClick={() => { setMultiSelect(!multiSelect()); setSelectedContacts(new Set<string>()); }}>
                {multiSelect() ? 'Seleccion individual' : 'Seleccionar varios'}
              </button>
              <For each={contactsState.contacts.slice().sort((a, b) => a.display.localeCompare(b.display))}>
                {(contact) => (
                  <button
                    class={styles.action}
                    classList={{ [styles.primary]: selectedContacts().has(contact.number) }}
                    onClick={() => toggleContact(contact.number)}
                  >
                    {selectedContacts().has(contact.number) ? '\u2713 ' : ''}{contact.display}
                  </button>
                )}
              </For>
              <button class={styles.action} onClick={enterManualNumber}>
                {t('messages.enter_number', language()) || 'Ingresar numero'}
              </button>
            </div>
            <Show when={multiSelect() && selectedContacts().size > 0}>
              <button
                class={`${styles.action} ${styles.primary}`}
                style={{ margin: '8px 16px' }}
                onClick={() => sendToContacts(Array.from(selectedContacts()))}
              >
                {`Enviar a ${selectedContacts().size} contacto${selectedContacts().size > 1 ? 's' : ''}`}
              </button>
            </Show>
          </Show>

          <button class={styles.cancel} onClick={close}>
            {t('action.cancel', language())}
          </button>
        </div>
      </div>

      <NfcShareSheet
        open={nfcOpen()}
        onClose={() => setNfcOpen(false)}
        onSelect={(id) => void shareNfc(id)}
        title="Compartir NFC"
        maxDistance={3.0}
        disabled={nfcSharing()}
      />
    </Show>
  );
}
