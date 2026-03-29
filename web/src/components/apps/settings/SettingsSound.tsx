import { For, Show } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { t } from '../../../i18n';
import { audioProfiles, CheckIcon, IconImage, ICONS } from './settingsShared';
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
    <div class="ios18-list">
      <For each={toneProps.tones}>
        {(tone) => (
          <div class="ios18-cell">
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
              <span class="ios18-cell__title" style={{ color: toneProps.selected === tone.id ? 'var(--tint)' : undefined }}>
                {tone.name}
              </span>
            </div>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
              <button
                style={{
                  width: '28px', height: '28px', 'border-radius': 'var(--r-pill)',
                  border: 'none', background: 'rgba(120,120,128,0.12)',
                  display: 'grid', 'place-items': 'center', cursor: 'pointer'
                }}
                onClick={() => props.onPreview(tone.id, toneProps.category)}
              >
                <IconImage
                  src={props.previewToneId() === tone.id ? ICONS.stop : ICONS.play}
                  class={styles.settingsIconImg}
                />
              </button>
              <Show when={toneProps.selected === tone.id}>
                <CheckIcon />
              </Show>
              <Show when={toneProps.selected !== tone.id}>
                <button
                  style={{
                    padding: '4px 8px', background: 'transparent', border: 'none',
                    color: 'var(--tint)', 'font-size': 'var(--fs-caption2)', 'font-weight': '600', cursor: 'pointer'
                  }}
                  onClick={() => toneProps.onSelect(tone.id)}
                >
                  {t('settings.select', props.language())}
                </button>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );

  return (
    <div class={styles.content}>
      {/* Volume */}
      <SectionHeader title={(t('settings.volume', props.language()) || 'VOLUME').toUpperCase()} />
      <div class="ios18-list">
        <div class="ios18-cell" style={{ 'flex-direction': 'column', 'align-items': 'stretch', gap: '8px' }}>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
            <div class={`${styles.settingsIcon} ${styles.iconBlue}`}>
              <IconImage src={ICONS.sound} class={styles.settingsIconImg} />
            </div>
            <span class="ios18-cell__title">{t('settings.volume', props.language())}</span>
          </div>
          <input
            class={styles.slider}
            type="range"
            min={0} max={100}
            value={Math.round(props.phoneState.settings.volume * 100)}
            onInput={(e) => props.phoneActions.setVolume(Number(e.currentTarget.value) / 100)}
          />
        </div>
      </div>

      {/* Audio profiles — direct list */}
      <SectionHeader title={(t('settings.audio_profile', props.language()) || 'AUDIO PROFILE').toUpperCase()} />
      <div class="ios18-list">
        <For each={audioProfiles}>
          {(profile) => (
            <button
              class="ios18-cell"
              style={{ cursor: 'pointer' }}
              onClick={() => props.phoneActions.setAudioProfile(profile.id as 'normal' | 'street' | 'vehicle' | 'silent')}
            >
              <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
                <div class={`${styles.settingsIcon} ${styles.iconPurple}`}>
                  <IconImage src={profile.icon} class={styles.settingsIconImg} />
                </div>
                <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1px' }}>
                  <span class="ios18-cell__title">{t(profile.nameKey, props.language())}</span>
                  <span class="ios18-cell__subtitle">{t(profile.descKey, props.language())}</span>
                </div>
              </div>
              <Show when={props.phoneState.settings.audioProfile === profile.id}>
                <CheckIcon />
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* Streamer mode */}
      <div class="ios18-list">
        <div class="ios18-cell">
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
            <div class={`${styles.settingsIcon} ${styles.iconGray}`}>
              <IconImage src={ICONS.mute} class={styles.settingsIconImg} />
            </div>
            <span class="ios18-cell__title">{t('settings.streamer_mode', props.language())}</span>
          </div>
          <div
            class="ios18-switch"
            role="switch"
            aria-checked={props.phoneState.settings.streamerMode ?? false}
            onClick={() => props.phoneActions.setStreamerMode(!(props.phoneState.settings.streamerMode ?? false))}
          >
            <div class="ios18-switch__thumb" />
          </div>
        </div>
      </div>

      {/* Call ringtones */}
      <SectionHeader title={(t('settings.call_ringtone', props.language()) || 'CALL RINGTONE').toUpperCase()} />
      <ToneList
        tones={props.toneCatalog().categories?.ringtones || []}
        category="ringtone"
        selected={props.phoneState.settings.callRingtone || props.phoneState.settings.ringtone}
        onSelect={(id) => props.phoneActions.setCallRingtone(id)}
      />

      {/* Notification tones */}
      <SectionHeader title={(t('settings.notification_ringtone', props.language()) || 'NOTIFICATION').toUpperCase()} />
      <ToneList
        tones={props.toneCatalog().categories?.notifications || []}
        category="notification"
        selected={props.phoneState.settings.notificationTone}
        onSelect={(id) => props.phoneActions.setNotificationTone(id)}
      />

      {/* Message tones */}
      <SectionHeader title={(t('settings.message_ringtone', props.language()) || 'MESSAGE').toUpperCase()} />
      <ToneList
        tones={props.toneCatalog().categories?.messages || []}
        category="message"
        selected={props.phoneState.settings.messageTone}
        onSelect={(id) => props.phoneActions.setMessageTone(id)}
      />

      {/* Auto-reply */}
      <SectionHeader title="AUTO-REPLY" />
      <div class="ios18-list">
        <div class="ios18-cell">
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: '1' }}>
            <div class={`${styles.settingsIcon} ${styles.iconBlue}`}>
              <IconImage src={ICONS.autoReply} class={styles.settingsIconImg} />
            </div>
            <span class="ios18-cell__title">{t('settings.auto_reply', props.language()) || 'Auto-respuesta'}</span>
          </div>
          <div
            class="ios18-switch"
            role="switch"
            aria-checked={props.autoReplyEnabled()}
            onClick={async () => {
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
          >
            <div class="ios18-switch__thumb" />
          </div>
        </div>
      </div>
      <Show when={props.autoReplyEnabled()}>
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
      </Show>
    </div>
  );
}
