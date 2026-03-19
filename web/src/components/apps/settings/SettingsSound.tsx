import { For } from 'solid-js';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { t } from '../../../i18n';
import { audioProfiles, Cell, CheckIcon, Group, IconImage, ICONS } from './settingsShared';
import type { PhoneToneCatalog, ToneCategory } from '../../../utils/phoneAudio';
import styles from './SettingsApp.module.scss';

interface SettingsSoundProps {
  language: () => string;
  phoneState: any;
  phoneActions: any;
  toneCatalog: () => PhoneToneCatalog;
  previewToneId: () => string | null;
  onPreview: (toneId: string, category: ToneCategory) => void;
}

export function SettingsSound(props: SettingsSoundProps) {
  const ToneList = (toneProps: { tones: { id: string; name: string }[]; category: ToneCategory; selected: string; onSelect: (id: string) => void; icon: string }) => (
    <Group>
      <For each={toneProps.tones}>
        {(tone) => (
          <div class={styles.ringtoneItem}>
            <div class={styles.ringtoneLeft}>
              <div class={styles.ringtoneIcon}><IconImage src={toneProps.icon} class={styles.ringtoneIconImage} /></div>
              <span class={styles.ringtoneName}>{tone.name}</span>
            </div>
            <div class={styles.ringtoneActions}>
              <button class={styles.previewBtn} onClick={() => props.onPreview(tone.id, toneProps.category)} title={t('settings.listen', props.language())}>
                <IconImage src={props.previewToneId() === tone.id ? ICONS.stop : ICONS.play} class={styles.previewIcon} />
              </button>
              <button class={`${styles.selectBtn} ${toneProps.selected === tone.id ? styles.selected : ''}`} onClick={() => toneProps.onSelect(tone.id)}>
                {toneProps.selected === tone.id ? <CheckIcon /> : t('settings.select', props.language())}
              </button>
            </div>
          </div>
        )}
      </For>
    </Group>
  );

  return (
    <div class={styles.content}>
      <SectionHeader title={t('settings.volume', props.language()).toUpperCase()} />
      <div class={styles.volumeSection}>
        <div class={styles.volumeLabels}>
          <IconImage src={ICONS.mute} class={styles.inlineIcon} />
          <span>{Math.round(props.phoneState.settings.volume * 100)}%</span>
          <IconImage src={ICONS.sound} class={styles.inlineIcon} />
        </div>
        <input class={styles.slider} type="range" min="0" max="100" value={Math.round(props.phoneState.settings.volume * 100)} onInput={(e) => props.phoneActions.setVolume(Number(e.currentTarget.value) / 100)} />
      </div>

      <SectionHeader title={t('settings.audio_profile', props.language()).toUpperCase()} />
      <Group>
        <For each={audioProfiles}>
          {(profile) => (
            <button class={styles.profileOption} classList={{ [styles.selected]: props.phoneState.settings.audioProfile === profile.id }} onClick={() => props.phoneActions.setAudioProfile(profile.id as 'normal' | 'street' | 'vehicle' | 'silent')}>
              <span class={styles.profileIcon}><IconImage src={profile.icon} class={styles.profileIconImage} /></span>
              <div class={styles.profileInfo}>
                <div class={styles.profileName}>{profile.name}</div>
                <div class={styles.profileDesc}>{profile.desc}</div>
              </div>
              {props.phoneState.settings.audioProfile === profile.id && <CheckIcon />}
            </button>
          )}
        </For>
      </Group>

      <SectionHeader title={t('settings.streamer_mode', props.language()).toUpperCase()} />
      <Group>
        <Cell
          icon={ICONS.mute}
          title={t('settings.streamer_mode', props.language())}
          subtitle={t('settings.streamer_mode_desc', props.language())}
          right="switch"
          switchValue={props.phoneState.settings.streamerMode ?? false}
          onSwitch={() => props.phoneActions.setStreamerMode(!(props.phoneState.settings.streamerMode ?? false))}
        />
      </Group>

      <SectionHeader title={t('settings.ringtone', props.language()).toUpperCase()} />
      <div class={styles.customUrl}>
        <div class={styles.customUrlInfo}>
          <div class={styles.customUrlTitle}>{t('settings.public_library', props.language())}</div>
          <div class={styles.customUrlText}>{t('settings.public_library_desc', props.language(), { source: props.toneCatalog().source?.name || 'Pixabay Sound Effects', license: props.toneCatalog().source?.license || 'royalty-free' })}</div>
        </div>
        <button onClick={() => window.open(props.toneCatalog().source?.downloadPage || 'https://pixabay.com/sound-effects/', '_blank')}>{t('settings.download', props.language())}</button>
      </div>

      <SectionHeader title={t('settings.call_ringtone', props.language()).toUpperCase()} />
      <ToneList tones={props.toneCatalog().categories?.ringtones || []} category="ringtone" selected={props.phoneState.settings.callRingtone || props.phoneState.settings.ringtone} onSelect={(id) => props.phoneActions.setCallRingtone(id)} icon={ICONS.ringtone} />

      <SectionHeader title={t('settings.notification_ringtone', props.language()).toUpperCase()} />
      <ToneList tones={props.toneCatalog().categories?.notifications || []} category="notification" selected={props.phoneState.settings.notificationTone} onSelect={(id) => props.phoneActions.setNotificationTone(id)} icon={ICONS.ringtone} />

      <SectionHeader title={t('settings.message_ringtone', props.language()).toUpperCase()} />
      <ToneList tones={props.toneCatalog().categories?.messages || []} category="message" selected={props.phoneState.settings.messageTone} onSelect={(id) => props.phoneActions.setMessageTone(id)} icon={ICONS.message} />
    </div>
  );
}
