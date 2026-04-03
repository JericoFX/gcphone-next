import { For, Show, type Accessor } from 'solid-js';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeText } from '../../../utils/sanitize';
import { LiveFlashlightControl } from '../../shared/ui/LiveFlashlightControl';
import { t } from '../../../i18n';
import type { SnapLive, SnapLiveSocketMessage, SnapLiveReaction, SnapAccount } from './SnapTypes';
import styles from './SnapApp.module.scss';

interface RangeValue {
  min: number;
  max: number;
}

interface LiveFlashlightHook {
  supported: Accessor<boolean>;
  enabled: Accessor<boolean>;
  panelOpen: Accessor<boolean>;
  kelvin: Accessor<number>;
  lumens: Accessor<number>;
  kelvinRange: Accessor<RangeValue>;
  lumensRange: Accessor<RangeValue>;
  setPanelOpen: (v: boolean) => void;
  setKelvin: (v: number) => void;
  setLumens: (v: number) => void;
  beginPress: () => void;
  endPress: () => void;
  cancelPress: () => void;
  saveSettings: (opts: { kelvin?: number; lumens?: number }) => Promise<void>;
  applyPreset: (k: number, l: number) => Promise<void>;
  turnOff: () => Promise<void>;
}

interface SnapLiveViewerOverlayProps {
  language: Accessor<string>;
  activeLive: Accessor<SnapLive | null>;
  liveConnected: Accessor<boolean>;
  liveVideoReady: Accessor<boolean>;
  isMockLive: Accessor<boolean>;
  isLiveOwner: Accessor<boolean>;
  myAccount: Accessor<SnapAccount | null>;
  liveMessages: Accessor<SnapLiveSocketMessage[]>;
  liveReactions: Accessor<SnapLiveReaction[]>;
  liveMessageInput: Accessor<string>;
  setLiveMessageInput: (value: string) => void;
  viewerMuted: Accessor<boolean>;
  liveAudioProximityEnabled: Accessor<boolean>;
  liveAudioNear: Accessor<boolean>;
  liveAudioTargetOnline: Accessor<boolean>;
  liveAudioDistanceMeters: Accessor<number>;
  liveFlashlight: LiveFlashlightHook;
  setLiveVideoStageHost: (el: HTMLDivElement | undefined) => void;
  onClose: () => void;
  onSendMessage: () => void;
  onSendReaction: (reaction: string) => void;
  onRemoveMessage: (messageId: string) => void;
}

export function SnapLiveViewerOverlay(props: SnapLiveViewerOverlayProps) {
  return (
    <div class={styles.liveViewer}>
      {/* Fullscreen video background */}
      <div class={styles.liveVideoCanvas}>
        <div
          ref={props.setLiveVideoStageHost}
          class={styles.liveVideoHost}
          classList={{ [styles.liveVideoHostReady]: props.liveVideoReady() }}
        />
        <Show when={!props.liveVideoReady()}>
          <div class={styles.livePlaceholder}>
            {props.isMockLive() ? t('snap.mock_preview', props.language()) : (props.liveConnected() ? t('snap.waiting_video', props.language()) : t('snap.connecting_video', props.language()))}
          </div>
        </Show>
      </div>

      {/* Top bar overlay */}
      <div class={styles.liveTopBar}>
        <button class={styles.liveUtilityButton} aria-label={t('control.close', props.language())} onClick={() => void props.onClose()}>
          <img src="./img/icons_ios/ui-close.svg" alt="" draggable={false} />
        </button>
        <div class={styles.liveOwnerInfo}>
          <strong>{props.activeLive()?.display_name || props.activeLive()?.username || 'Live'}</strong>
        </div>
        <Show when={props.liveConnected()}>
          <span class={styles.liveBadge}>LIVE</span>
        </Show>
        <span class={styles.liveViewerCount}>
          {Math.max(Number(props.activeLive()?.live_viewers || 0), props.isLiveOwner() ? 1 : 0)}
          <img src="./img/icons_ios/ui-eye.svg" alt="" draggable={false} />
        </span>
        <Show when={props.isLiveOwner()}>
          <button class={styles.liveUtilityButton} aria-label={t('camera.selfie', props.language())} onClick={() => void fetchNui('liveToggleSelfie')}>
            <img src="./img/icons_ios/ui-shuffle.svg" alt="" draggable={false} />
          </button>
        </Show>
        <Show when={props.liveFlashlight.supported() && props.isLiveOwner()}>
          <LiveFlashlightControl
            visible={true}
            enabled={props.liveFlashlight.enabled()}
            panelOpen={props.liveFlashlight.panelOpen()}
            kelvin={props.liveFlashlight.kelvin()}
            lumens={props.liveFlashlight.lumens()}
            kelvinRange={props.liveFlashlight.kelvinRange()}
            lumensRange={props.liveFlashlight.lumensRange()}
            buttonLabel={<img src="./img/icons_ios/ui-flashlight.svg" alt="" draggable={false} />}
            buttonTitle={t('snap.flashlight', props.language())}
            theme="dark"
            variant="circle"
            onPointerDown={props.liveFlashlight.beginPress}
            onPointerUp={props.liveFlashlight.endPress}
            onPointerLeave={props.liveFlashlight.cancelPress}
            onPointerCancel={props.liveFlashlight.cancelPress}
            onKelvinInput={(v) => { props.liveFlashlight.setKelvin(v); void props.liveFlashlight.saveSettings({ kelvin: v }); }}
            onLumensInput={(v) => { props.liveFlashlight.setLumens(v); void props.liveFlashlight.saveSettings({ lumens: v }); }}
            onPreset={(k, l) => { void props.liveFlashlight.applyPreset(k, l); }}
          />
        </Show>
      </div>

      {/* Reactions floating right */}
      <div class={styles.liveReactionRow}>
        <button onClick={() => void props.onSendReaction('👍')}>👍</button>
        <button onClick={() => void props.onSendReaction('❤️')}>❤️</button>
        <button onClick={() => void props.onSendReaction('😂')}>😂</button>
        <button onClick={() => void props.onSendReaction('🔥')}>🔥</button>
        <button onClick={() => void props.onSendReaction('👏')}>👏</button>
      </div>

      {/* Floating reactions animation */}
      <div class={styles.liveReactionFloat}>
        <For each={props.liveReactions()}>
          {(reaction) => (
            <div class={styles.liveReactionBubble}>{reaction.reaction}</div>
          )}
        </For>
      </div>

      {/* Bottom overlay: chat messages (fade out) + input */}
      <div class={styles.liveBottom}>
        <Show when={props.liveAudioProximityEnabled() && !props.isLiveOwner()}>
          <div
            class={styles.liveAudioBadge}
            classList={{
              [styles.liveAudioBadgeNear]: props.liveAudioNear() && props.liveAudioTargetOnline(),
              [styles.liveAudioBadgeFar]: !props.liveAudioNear() && props.liveAudioTargetOnline(),
              [styles.liveAudioBadgeOffline]: !props.liveAudioTargetOnline(),
            }}
          >
            <span class={styles.liveAudioBadgeDot} />
            <span>
              {!props.liveAudioTargetOnline() ? t('snap.no_broadcaster', props.language()) : (props.liveAudioNear() ? t('snap.audio_near', props.language()) : t('snap.out_of_range', props.language()))}
            </span>
            <Show when={props.liveAudioDistanceMeters() >= 0}>
              <small>{Math.round(props.liveAudioDistanceMeters())}m</small>
            </Show>
          </div>
        </Show>

        <div class={styles.liveChatFeed}>
          <For each={props.liveMessages().slice(-6)}>
            {(message) => (
              <div class={styles.liveChatBubble} classList={{ [styles.liveMention]: message.isMention }}>
                <strong>@{message.username}</strong> {message.content}
                <Show when={props.isLiveOwner() && message.username !== props.myAccount()?.username}>
                  <button class={styles.liveModerationBtn} onClick={() => void props.onRemoveMessage(message.id)}>
                    <img src="./img/icons_ios/ui-trash.svg" alt="" draggable={false} />
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>

        <Show when={props.viewerMuted()}>
          <div class={styles.liveMutedBanner}>{t('snap.live_muted', props.language())}</div>
        </Show>

        <Show when={!props.isLiveOwner()}>
          <div class={styles.liveChatInputRow}>
            <input
              value={props.liveMessageInput()}
              onInput={(e) => props.setLiveMessageInput(sanitizeText(e.currentTarget.value, 300))}
              onKeyDown={(e) => e.key === 'Enter' && void props.onSendMessage()}
              placeholder={t('snap.write_live', props.language())}
              disabled={props.viewerMuted()}
            />
            <button onClick={() => void props.onSendMessage()} disabled={props.viewerMuted() || !props.liveMessageInput().trim()}>
              <img src="./img/icons_ios/ui-send.svg" alt="" draggable={false} />
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
