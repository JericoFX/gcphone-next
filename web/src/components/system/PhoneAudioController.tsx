import { createEffect, onCleanup } from 'solid-js';
import { useNotifications, usePhone } from '../../store';
import { useInternalEvent } from '../../utils/internalEvents';
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

type MessageDetail = {
  id?: number;
};

type IncomingCallDetail = {
  nativeTone?: boolean;
};

type NativeCallToneDetail = {
  active?: boolean;
  toneId?: string;
  placeholder?: boolean;
};

export function PhoneAudioController() {
  const [phoneState] = usePhone();
  const [notifications] = useNotifications();
  let lastNotificationId: string | null = null;
  let nativeIncomingCallActive = false;

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

  const playAlertTone = (channel: string, category: ToneCategory) => {
    const toneId = category === 'message'
      ? phoneState.settings.messageTone
      : phoneState.settings.notificationTone;

    phoneAudio.playTone(channel, {
      toneId,
      category,
      volume: masterVolume(),
      audioProfile: audioProfile(),
      forceVibrate: shouldUseVibrateVariant(),
    });
  };

  const onIncomingCall = (detail: IncomingCallDetail | undefined) => {
    phoneAudio.stop('outgoing-call');
    if (nativeIncomingCallActive || detail?.nativeTone === true) {
      phoneAudio.stop('incoming-call');
      return;
    }
    playIncomingTone();
  };

  const onCallResolved = () => {
    stopCallAudio();
  };

  const onPreviewTone = (detail: PreviewDetail | undefined) => {
    if (!detail?.toneId) return;
    phoneAudio.playTone('tone-preview', {
      toneId: detail.toneId,
      category: detail.category || 'ringtone',
      volume: masterVolume(),
      audioProfile: audioProfile(),
      forceVibrate: shouldUseVibrateVariant(),
    });
  };

  const onPlaySound = (detail: SoundDetail | undefined) => {
    if (!detail?.sound) return;
    if (detail.sound === 'calling_loop' || detail.sound === 'calling_short') {
      phoneAudio.playNamed('outgoing-call', {
        sound: detail.sound,
        volume: typeof detail.volume === 'number' ? detail.volume : masterVolume(),
        loop: detail.sound === 'calling_loop' ? true : detail.loop === true,
      });
    }
  };

  const onMessageReceived = () => {
    playAlertTone('message', 'message');
  };

  const onStopSound = (detail: SoundDetail | undefined) => {
    if (!detail?.sound) return;
    if (detail.sound === 'calling_loop' || detail.sound === 'calling_short') {
      phoneAudio.stop('outgoing-call');
    }
  };

  const onSetSoundVolume = (detail: SoundDetail | undefined) => {
    if (!detail?.sound || typeof detail.volume !== 'number') return;
    if (detail.sound === 'calling_loop' || detail.sound === 'calling_short') {
      phoneAudio.updateNamedVolume('outgoing-call', detail.volume);
    }
  };

  const onHidePhone = () => {
    stopPreview();
  };

  const onNativeCallToneState = (detail: NativeCallToneDetail | undefined) => {
    nativeIncomingCallActive = detail?.active === true && detail?.placeholder !== true;
    if (nativeIncomingCallActive) {
      phoneAudio.stop('incoming-call');
    }
  };

  onCleanup(() => {
    phoneAudio.stopAll();
  });

  useInternalEvent<IncomingCallDetail>('incomingCall', onIncomingCall);
  useInternalEvent('callAccepted', onCallResolved);
  useInternalEvent('callRejected', onCallResolved);
  useInternalEvent('callEnded', onCallResolved);
  useInternalEvent<PreviewDetail>('gcphone:previewTone', onPreviewTone);
  useInternalEvent('gcphone:stopTonePreview', stopPreview);
  useInternalEvent<MessageDetail>('messageReceived', onMessageReceived);
  useInternalEvent<SoundDetail>('playSound', onPlaySound);
  useInternalEvent<SoundDetail>('stopSound', onStopSound);
  useInternalEvent<SoundDetail>('setSoundVolume', onSetSoundVolume);
  useInternalEvent('phone:hide', onHidePhone);
  useInternalEvent<NativeCallToneDetail>('gcphone:nativeCallToneState', onNativeCallToneState);

  createEffect(() => {
    const current = notifications.current;
    const currentId = current?.id || null;
    if (!currentId || currentId === lastNotificationId) return;

    lastNotificationId = currentId;
    playAlertTone('notification', 'notification');
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
