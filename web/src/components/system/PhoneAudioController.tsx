import { createEffect, onCleanup, onMount } from 'solid-js';
import { useNotifications, usePhone } from '../../store';
import { phoneAudio, type AudioProfile, type ToneCategory } from '../../utils/phoneAudio';

type PreviewDetail = {
  toneId?: string;
  category?: ToneCategory;
};

type SoundDetail = {
  sound?: string;
  volume?: number;
  loop?: boolean;
};

function asEventListener<T>(handler: (detail: T) => void) {
  return ((event: Event) => {
    handler((event as CustomEvent<T>).detail);
  }) as EventListener;
}

export function PhoneAudioController() {
  const [phoneState] = usePhone();
  const [notifications] = useNotifications();
  let lastNotificationId: string | null = null;

  const audioProfile = () => (phoneState.settings.audioProfile || 'normal') as AudioProfile;
  const masterVolume = () => phoneState.settings.volume ?? 0.5;
  const shouldUseVibrateVariant = () => {
    return audioProfile() === 'silent' || notifications.silentMode || notifications.doNotDisturb;
  };

  const playIncomingTone = () => {
    phoneAudio.playTone('incoming-call', {
      toneId: phoneState.settings.callRingtone || phoneState.settings.ringtone,
      category: 'ringtone',
      volume: masterVolume(),
      loop: true,
      audioProfile: audioProfile(),
      forceVibrate: shouldUseVibrateVariant(),
    });
  };

  const stopCallAudio = () => {
    phoneAudio.stop('incoming-call');
    phoneAudio.stop('outgoing-call');
  };

  const stopPreview = () => {
    phoneAudio.stop('tone-preview');
  };

  onMount(() => {
    const onIncomingCall = asEventListener<Record<string, unknown>>(() => {
      phoneAudio.stop('outgoing-call');
      playIncomingTone();
    });

    const onCallResolved = asEventListener<Record<string, unknown>>(() => {
      stopCallAudio();
    });

    const onPreviewTone = asEventListener<PreviewDetail>((detail) => {
      if (!detail?.toneId) return;
      phoneAudio.playTone('tone-preview', {
        toneId: detail.toneId,
        category: detail.category || 'ringtone',
        volume: masterVolume(),
        audioProfile: audioProfile(),
        forceVibrate: shouldUseVibrateVariant(),
      });
    });

    const onPlaySound = asEventListener<SoundDetail>((detail) => {
      if (!detail?.sound) return;
      if (detail.sound === 'calling_loop' || detail.sound === 'calling_short') {
        phoneAudio.playNamed('outgoing-call', {
          sound: detail.sound,
          volume: typeof detail.volume === 'number' ? detail.volume : masterVolume(),
          loop: detail.sound === 'calling_loop' ? true : detail.loop === true,
        });
      }
    });

    const onStopSound = asEventListener<SoundDetail>((detail) => {
      if (!detail?.sound) return;
      if (detail.sound === 'calling_loop' || detail.sound === 'calling_short') {
        phoneAudio.stop('outgoing-call');
      }
    });

    const onSetSoundVolume = asEventListener<SoundDetail>((detail) => {
      if (!detail?.sound || typeof detail.volume !== 'number') return;
      if (detail.sound === 'calling_loop' || detail.sound === 'calling_short') {
        phoneAudio.updateNamedVolume('outgoing-call', detail.volume);
      }
    });

    const onHidePhone = asEventListener<Record<string, unknown>>(() => {
      stopPreview();
    });

    window.addEventListener('incomingCall', onIncomingCall);
    window.addEventListener('callAccepted', onCallResolved);
    window.addEventListener('callRejected', onCallResolved);
    window.addEventListener('callEnded', onCallResolved);
    window.addEventListener('gcphone:previewTone', onPreviewTone);
    window.addEventListener('gcphone:stopTonePreview', stopPreview as EventListener);
    window.addEventListener('playSound', onPlaySound);
    window.addEventListener('stopSound', onStopSound);
    window.addEventListener('setSoundVolume', onSetSoundVolume);
    window.addEventListener('phone:hide', onHidePhone);

    onCleanup(() => {
      window.removeEventListener('incomingCall', onIncomingCall);
      window.removeEventListener('callAccepted', onCallResolved);
      window.removeEventListener('callRejected', onCallResolved);
      window.removeEventListener('callEnded', onCallResolved);
      window.removeEventListener('gcphone:previewTone', onPreviewTone);
      window.removeEventListener('gcphone:stopTonePreview', stopPreview as EventListener);
      window.removeEventListener('playSound', onPlaySound);
      window.removeEventListener('stopSound', onStopSound);
      window.removeEventListener('setSoundVolume', onSetSoundVolume);
      window.removeEventListener('phone:hide', onHidePhone);
      phoneAudio.stopAll();
    });
  });

  createEffect(() => {
    const current = notifications.current;
    const currentId = current?.id || null;
    if (!currentId || currentId === lastNotificationId) return;

    lastNotificationId = currentId;
    const category: ToneCategory = current?.appId === 'messages' ? 'message' : 'notification';
    const toneId = category === 'message' ? phoneState.settings.messageTone : phoneState.settings.notificationTone;

    phoneAudio.playTone(category, {
      toneId,
      category,
      volume: masterVolume(),
      audioProfile: audioProfile(),
      forceVibrate: shouldUseVibrateVariant(),
    });
  });

  createEffect(() => {
    audioProfile();
    masterVolume();
    notifications.silentMode;
    notifications.doNotDisturb;

    if (phoneAudio.has('incoming-call')) {
      playIncomingTone();
    }
  });

  createEffect(() => {
    phoneState.settings.callRingtone;
    phoneState.settings.ringtone;

    if (phoneAudio.has('incoming-call')) {
      playIncomingTone();
    }
  });

  return null;
}
