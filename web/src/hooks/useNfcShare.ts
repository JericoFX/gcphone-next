import { createSignal } from 'solid-js';
import { useNotifications } from '../store/notifications';

export interface UseNfcShareOptions {
  onShare: (targetServerId: number) => Promise<{ success?: boolean; error?: string }>;
  successMessage?: string;
  errorMessages?: Record<string, string>;
}

export interface UseNfcShareReturn {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  sharing: () => boolean;
  handleSelect: (targetServerId: number) => Promise<void>;
}

const DEFAULT_ERRORS: Record<string, string> = {
  TOO_FAR: 'Demasiado lejos',
  TARGET_OFFLINE: 'Jugador desconectado',
  TARGET_UNAVAILABLE: 'Jugador no disponible',
  PHOTO_NOT_FOUND: 'Foto no encontrada',
  INVALID_DATA: 'Datos invalidos',
  READONLY: 'Telefono en modo lectura',
};

const NFC_COOLDOWN_MS = 10000;
const lastShareByTarget = new Map<number, number>();

export function useNfcShare(options: UseNfcShareOptions): UseNfcShareReturn {
  const [isOpen, setIsOpen] = createSignal(false);
  const [sharing, setSharing] = createSignal(false);
  const [, notificationsActions] = useNotifications();

  const errorMap = { ...DEFAULT_ERRORS, ...(options.errorMessages || {}) };

  const handleSelect = async (targetServerId: number) => {
    const now = Date.now();
    const lastShare = lastShareByTarget.get(targetServerId) || 0;
    if (now - lastShare < NFC_COOLDOWN_MS) {
      const waitSec = Math.ceil((NFC_COOLDOWN_MS - (now - lastShare)) / 1000);
      notificationsActions.receive({
        appId: 'system',
        title: 'NFC',
        message: `Espera ${waitSec}s antes de compartir de nuevo`,
        priority: 'normal',
      });
      return;
    }

    setSharing(true);
    const result = await options.onShare(targetServerId);
    setSharing(false);
    setIsOpen(false);

    if (result?.success) {
      lastShareByTarget.set(targetServerId, Date.now());
    }

    if (result?.success) {
      notificationsActions.receive({
        appId: 'system',
        title: 'NFC',
        message: options.successMessage || 'Compartido correctamente',
        priority: 'normal',
      });
    } else {
      const errorKey = result?.error || 'UNKNOWN';
      notificationsActions.receive({
        appId: 'system',
        title: 'NFC',
        message: errorMap[errorKey] || result?.error || 'Error al compartir',
        priority: 'normal',
      });
    }
  };

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    sharing,
    handleSelect,
  };
}
