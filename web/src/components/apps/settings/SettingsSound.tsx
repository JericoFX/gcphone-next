import { For, Show, createSignal } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { t } from '../../../i18n';
import { audioProfiles, Cell, CheckIcon, Group, IconImage, ICONS, InlineExpander } from './settingsShared';
import type { PhoneToneCatalog, ToneCategory } from '../../../utils/phoneAudio';
import styles from './SettingsApp.module.scss';

interface SettingsSoundProps {
  language: () => string;
  phoneState: any;
  phoneActions: any;
  toneCatalog: () => PhoneToneCatalog;
  previewToneId: () => string | null;
  onPreview: (toneId: string, category: ToneCategory) => void;
  autoReplyEnabled: () => boolean;
  setAutoReplyEnabled: (v: boolean) => void;
  autoReplyMessage: () => string;
  setAutoReplyMessage: (v: string) => void;
}

export function SettingsSound(props: SettingsSoundProps) {
  const [showProfile, setShowProfile] = createSignal(false);
  const [showCallRing, setShowCallRing] = createSignal(false);
  const [showNotifTone, setShowNotifTone] = createSignal(false);
  const [showMsgTone, setShowMsgTone] = createSignal(false);

  const currentProfileName = () => {
    const p = audioProfiles.find((ap) => ap.id === props.phoneState.settings.audioProfile);
    return p?.name || 'Normal';
  };

  const getToneName = (toneId: string, cat: 'ringtones' | 'notifications' | 'messages') => {
    const tones = props.toneCatalog().categories?.[cat] || [];
    const found = tones.find((t: any) => t.id === toneId);
    return found?.name || toneId;
  };

  const ToneList = (toneProps: {
    tones: { id: string; name: string }[];
    category: ToneCategory;
    selected: string;
    onSelect: (id: string) => void;
  }) => (
    <For each={toneProps.tones}>
      {(tone) => (
        <div
          class={styles.ringtoneItem}
          classList={{ [styles.playing]: props.previewToneId() === tone.id }}
        >
          <div class={styles.ringtoneLeft}>
            <span class={styles.ringtoneName}>{tone.name}</span>
          </div>
          <div class={styles.ringtoneActions}>
            <button class={styles.previewBtn} onClick={() => props.onPreview(tone.id, toneProps.category)}>
              <IconImage src={props.previewToneId() === tone.id ? ICONS.stop : ICONS.play} class={styles.previewIcon} />
            </button>
            <Show when={toneProps.selected === tone.id}><CheckIcon /></Show>
            <Show when={toneProps.selected !== tone.id}>
              <button class={styles.pinCancel} style={{ padding: '4px 8px', "font-size": "var(--fs-caption2)" }} onClick={() => toneProps.onSelect(tone.id)}>
                {t('settings.select', props.language())}
              </button>
            </Show>
          </div>
        </div>
      )}
    </For>
  );

  return (
    <div class={styles.content}>
      <SectionHeader title={(t('settings.volume', props.language()) || 'VOLUMEN').toUpperCase()} />
      <Group>
        <Cell
          icon={ICONS.sound} iconBg="iconBlue"
          title={t('settings.volume', props.language())}
          right="slider"
          sliderMin={0} sliderMax={100}
          sliderValue={Math.round(props.phoneState.settings.volume * 100)}
          onSlider={(v) => props.phoneActions.setVolume(v / 100)}
        />
        <Cell
          icon={ICONS.normal} iconBg="iconPurple"
          title={t('settings.audio_profile', props.language())}
          right="value+chevron"
          value={currentProfileName()}
          onClick={() => { setShowProfile(!showProfile()); setShowCallRing(false); setShowNotifTone(false); setShowMsgTone(false); }}
        />
        <InlineExpander open={showProfile}>
          <For each={audioProfiles}>
            {(profile) => (
              <button
                class={styles.profileOption}
                classList={{ [styles.selected]: props.phoneState.settings.audioProfile === profile.id }}
                onClick={() => {
                  props.phoneActions.setAudioProfile(profile.id as 'normal' | 'street' | 'vehicle' | 'silent');
                  setShowProfile(false);
                }}
              >
                <span class={styles.profileIcon}><IconImage src={profile.icon} class={styles.profileIconImage} /></span>
                <div class={styles.profileInfo}>
                  <div class={styles.profileName}>{profile.name}</div>
                  <div class={styles.profileDesc}>{profile.desc}</div>
                </div>
                <Show when={props.phoneState.settings.audioProfile === profile.id}><CheckIcon /></Show>
              </button>
            )}
          </For>
        </InlineExpander>
        <Cell
          icon={ICONS.mute} iconBg="iconGray"
          title={t('settings.streamer_mode', props.language())}
          right="switch"
          switchValue={props.phoneState.settings.streamerMode ?? false}
          onSwitch={() => props.phoneActions.setStreamerMode(!(props.phoneState.settings.streamerMode ?? false))}
        />
      </Group>

      <SectionHeader title={(t('settings.call_ringtone', props.language()) || 'TONOS').toUpperCase()} />
      <Group>
        <Cell
          icon={ICONS.ringtone} iconBg="iconRed"
          title={t('settings.call_ringtone', props.language())}
          right="value+chevron"
          value={getToneName(props.phoneState.settings.callRingtone || props.phoneState.settings.ringtone, 'ringtones')}
          onClick={() => { setShowCallRing(!showCallRing()); setShowNotifTone(false); setShowMsgTone(false); setShowProfile(false); }}
        />
        <InlineExpander open={showCallRing}>
          <ToneList
            tones={props.toneCatalog().categories?.ringtones || []}
            category="ringtone"
            selected={props.phoneState.settings.callRingtone || props.phoneState.settings.ringtone}
            onSelect={(id) => props.phoneActions.setCallRingtone(id)}
          />
        </InlineExpander>

        <Cell
          icon={ICONS.notifications} iconBg="iconOrange"
          title={t('settings.notification_ringtone', props.language())}
          right="value+chevron"
          value={getToneName(props.phoneState.settings.notificationTone, 'notifications')}
          onClick={() => { setShowNotifTone(!showNotifTone()); setShowCallRing(false); setShowMsgTone(false); setShowProfile(false); }}
        />
        <InlineExpander open={showNotifTone}>
          <ToneList
            tones={props.toneCatalog().categories?.notifications || []}
            category="notification"
            selected={props.phoneState.settings.notificationTone}
            onSelect={(id) => props.phoneActions.setNotificationTone(id)}
          />
        </InlineExpander>

        <Cell
          icon={ICONS.message} iconBg="iconGreen"
          title={t('settings.message_ringtone', props.language())}
          right="value+chevron"
          value={getToneName(props.phoneState.settings.messageTone, 'messages')}
          onClick={() => { setShowMsgTone(!showMsgTone()); setShowCallRing(false); setShowNotifTone(false); setShowProfile(false); }}
        />
        <InlineExpander open={showMsgTone}>
          <ToneList
            tones={props.toneCatalog().categories?.messages || []}
            category="message"
            selected={props.phoneState.settings.messageTone}
            onSelect={(id) => props.phoneActions.setMessageTone(id)}
          />
        </InlineExpander>
      </Group>

      <SectionHeader title="AUTO-REPLY" />
      <Group>
        <Cell
          icon={ICONS.moon} iconBg="iconBlue"
          title={t('settings.auto_reply', props.language()) || 'Auto-respuesta'}
          right="switch"
          switchValue={props.autoReplyEnabled()}
          onSwitch={async () => {
            const next = !props.autoReplyEnabled();
            if (!next) {
              await fetchNui('setAutoReply', { enabled: false, message: '' }, { success: true });
              props.setAutoReplyEnabled(false);
              props.setAutoReplyMessage('');
              return;
            }
            const msg = props.autoReplyMessage() || 'No puedo responder ahora, te escribo luego.';
            const result = await fetchNui<{ success?: boolean; enabled?: boolean; message?: string }>('setAutoReply', { enabled: true, message: msg }, { success: true, enabled: true, message: msg });
            if (result?.success) {
              props.setAutoReplyEnabled(result.enabled === true);
              props.setAutoReplyMessage(result.message || msg);
            }
          }}
        />
        <InlineExpander open={props.autoReplyEnabled}>
          <textarea
            class={styles.autoReplyTextarea}
            placeholder={t('settings.auto_reply_placeholder', props.language()) || 'Escribe tu mensaje...'}
            value={props.autoReplyMessage()}
            onInput={(e) => props.setAutoReplyMessage(e.currentTarget.value)}
            onBlur={async () => {
              const msg = props.autoReplyMessage().trim();
              if (msg && props.autoReplyEnabled()) {
                await fetchNui('setAutoReply', { enabled: true, message: msg }, { success: true });
              }
            }}
          />
        </InlineExpander>
      </Group>
    </div>
  );
}
