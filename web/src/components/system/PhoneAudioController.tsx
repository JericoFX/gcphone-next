import { createEffect, onCleanup } from 'solid-js';
import { useNotifications, usePhone } from '../../store';
import { useInternalEvent } from '../../utils/internalEvents';
import type { ToneCategory } from '../../utils/phoneAudio';
import { fetchNui } from '../../utils/fetchNui';

type PreviewDetail = {
  toneId?: string;
  category?: ToneCategory;
};

type SoundDetail = {
  sound?: string;
  volume?: number;
  loop?: boolean;
};

type NativeCallToneDetail = {
  active?: boolean;
  toneId?: string;
  placeholder?: boolean;
};

async function tryNativeAudio(callback: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    const result = await fetchNui<{ success?: boolean }>(callback, data);
    return result?.success === true;
  } catch {
    return false;
  }
}

export function PhoneAudioController() {
  const [phoneState] = usePhone();
  const [notifications] = useNotifications();
  let lastNotificationId: string | null = null;

  const playAlertTone = async (_channel: string, category: ToneCategory) => {
    const toneId = category === 'message'
      ? phoneState.settings.messageTone
      : phoneState.settings.notificationTone;

    const nativeCallback = category === 'message' ? 'playNativeMessage' : 'playNativeNotification';
    await tryNativeAudio(nativeCallback, { toneId });
  };

  const onIncomingCall = () => {
    fetchNui('stopNativeOutgoing').catch(() => {});
  };

  const onCallResolved = () => {
    fetchNui('stopNativeOutgoing').catch(() => {});
  };

  const onPreviewTone = (detail: PreviewDetail | undefined) => {
    if (!detail?.toneId) return;
    fetchNui('previewNativeTone', { toneId: detail.toneId, category: detail.category || 'ringtone' }).catch(() => {});
  };

  const onPlaySound = async (detail: SoundDetail | undefined) => {
    if (!detail?.sound) return;
    if (detail.sound === 'calling_loop' || detail.sound === 'calling_short') {
      await tryNativeAudio('playNativeOutgoing', { sound: detail.sound });
    }
  };

  const onMessageReceived = () => {
    playAlertTone('message', 'message');
  };

  const onStopSound = (detail: SoundDetail | undefined) => {
    if (!detail?.sound) return;
    if (detail.sound === 'calling_loop' || detail.sound === 'calling_short') {
      fetchNui('stopNativeOutgoing').catch(() => {});
    }
  };

  onCleanup(() => {
    fetchNui('stopNativeOutgoing').catch(() => {});
  });

  useInternalEvent('incomingCall', onIncomingCall);
  useInternalEvent('callAccepted', onCallResolved);
  useInternalEvent('callRejected', onCallResolved);
  useInternalEvent('callEnded', onCallResolved);
  useInternalEvent<PreviewDetail>('gcphone:previewTone', onPreviewTone);
  useInternalEvent('gcphone:stopTonePreview', () => {
    fetchNui('stopNativeTonePreview').catch(() => {});
  });
  useInternalEvent('messageReceived', onMessageReceived);
  useInternalEvent<SoundDetail>('playSound', onPlaySound);
  useInternalEvent<SoundDetail>('stopSound', onStopSound);
  useInternalEvent<NativeCallToneDetail>('gcphone:nativeCallToneState', () => {});
  useInternalEvent('phone:hide', () => {
    fetchNui('stopNativeTonePreview').catch(() => {});
  });

  createEffect(() => {
    const current = notifications.current;
    const currentId = current?.id || null;
    if (!currentId || currentId === lastNotificationId) return;

    lastNotificationId = currentId;
    playAlertTone('notification', 'notification');
  });

  return null;
}
