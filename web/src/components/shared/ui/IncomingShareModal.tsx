import { Show, createSignal } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { useNuiCustomEvent } from '../../../utils/useNui';
import { useNotifications } from '../../../store/notifications';

interface IncomingSharePayload {
  fromServerId: number;
  fromName: string;
  type: 'photo' | 'contact' | 'document' | 'note' | 'location' | 'playlist';
  label?: string;
  requestId: string;
}

const TYPE_LABELS: Record<string, Record<string, string>> = {
  photo: { es: 'una foto', en: 'a photo' },
  contact: { es: 'un contacto', en: 'a contact' },
  document: { es: 'un documento', en: 'a document' },
  note: { es: 'una nota', en: 'a note' },
  location: { es: 'una ubicacion', en: 'a location' },
  playlist: { es: 'una playlist', en: 'a playlist' },
};

const TYPE_ICONS: Record<string, string> = {
  photo: '📷',
  contact: '👤',
  document: '📄',
  note: '📝',
  location: '📍',
  playlist: '🎵',
};

export function IncomingShareModal() {
  const [pending, setPending] = createSignal<IncomingSharePayload | null>(null);
  const [responding, setResponding] = createSignal(false);
  const [, notificationsActions] = useNotifications();

  useNuiCustomEvent<IncomingSharePayload>('gcphone:incomingShare', (payload) => {
    if (!payload?.requestId || !payload?.fromName) return;
    setPending(payload);
  });

  const respond = async (accept: boolean) => {
    const req = pending();
    if (!req) return;
    setResponding(true);
    await fetchNui('gcphone:respondShare', { requestId: req.requestId, accept });
    setResponding(false);
    setPending(null);

    if (accept) {
      notificationsActions.receive({
        appId: 'system',
        title: 'AirDrop',
        message: `Recibido de ${req.fromName}`,
        priority: 'normal',
      });
    }
  };

  return (
    <Show when={pending()}>
      {(req) => (
        <div style={{
          position: 'absolute',
          inset: '0',
          'z-index': '300',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          padding: '24px',
          background: 'rgba(0,0,0,0.45)',
        }}>
          <div style={{
            width: '100%',
            'max-width': '280px',
            'border-radius': '18px',
            background: 'var(--sheet-bg)',
            padding: '20px',
            'text-align': 'center',
            display: 'grid',
            gap: '12px',
            'box-shadow': '0 20px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ 'font-size': '40px' }}>{TYPE_ICONS[req().type] || '📨'}</div>
            <div style={{ 'font-size': '15px', 'font-weight': '700', color: 'var(--text)' }}>
              {req().fromName}
            </div>
            <div style={{ 'font-size': '13px', color: 'var(--text-2)' }}>
              quiere compartirte {TYPE_LABELS[req().type]?.es || req().type}
              <Show when={req().label}>
                <br /><strong>{req().label}</strong>
              </Show>
            </div>
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '8px' }}>
              <button
                class="ios-btn"
                disabled={responding()}
                onClick={() => void respond(false)}
              >
                Rechazar
              </button>
              <button
                class="ios-btn ios-btn-primary"
                disabled={responding()}
                onClick={() => void respond(true)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
