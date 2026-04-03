import { For, Show, type Accessor } from 'solid-js';
import { resolveMediaType } from '../../../utils/sanitize';
import { t } from '../../../i18n';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { SnapPost, SnapStory, SnapLive } from './SnapTypes';
import styles from './SnapApp.module.scss';

interface SnapFeedTabProps {
  language: Accessor<string>;
  stories: Accessor<SnapStory[]>;
  liveStreams: Accessor<SnapLive[]>;
  posts: Accessor<SnapPost[]>;
  loading: Accessor<boolean>;
  onOpenStory: (index: number) => void;
  onOpenLiveViewer: (live: SnapLive) => void;
  onShowActionSheet: () => void;
  onViewMedia: (url: string) => void;
  onToggleLike: (e: Event, postId: number) => void;
  onDeletePost: (e: Event, postId: number) => void;
  onSharePost: (postId: number) => void;
}

export function SnapFeedTab(props: SnapFeedTabProps) {
  return (
    <>
      <div class={styles.storiesSection}>
        <div class={styles.storiesList}>
          <button class={styles.storyItem} onClick={() => props.onShowActionSheet()}>
            <div class={styles.storyAvatar} classList={{ [styles.hasStory]: false }}>
              <span>+</span>
            </div>
            <span class={styles.storyName}>{t('snap.your_story', props.language())}</span>
          </button>

          <For each={props.stories()}>
            {(story, index) => (
              <button class={styles.storyItem} onClick={() => props.onOpenStory(index())}>
                <div class={styles.storyAvatar} classList={{ [styles.hasStory]: true }}>
                  {story.avatar ? (
                    <img src={story.avatar} alt="" />
                  ) : (
                    <span>{(story.display_name || story.username || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span class={styles.storyName}>{story.display_name || story.username || t('chirp.user', props.language())}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={props.liveStreams().length > 0}>
        <div class={styles.liveSection}>
          <h4 class={styles.sectionTitle}>{t('snap.live', props.language())}</h4>
          <div class={styles.liveList}>
            <For each={props.liveStreams()}>
              {(live) => (
                <button class={styles.liveItem} onClick={() => void props.onOpenLiveViewer(live)}>
                  <div class={styles.liveAvatar}>
                    {live.avatar ? (
                      <img src={live.avatar} alt="" />
                    ) : (
                      <span>{(live.display_name || live.username || 'U').charAt(0).toUpperCase()}</span>
                    )}
                    <span class={styles.liveBadge}>LIVE</span>
                  </div>
                  <span class={styles.liveName}>{live.display_name || live.username}</span>
                  <span class={styles.liveViewers}>{live.live_viewers || 0} {t('snap.watching', props.language())}</span>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div class={styles.postsSection}>
        <h4 class={styles.sectionTitle}>{t('snap.posts', props.language())}</h4>
        <div class={styles.postsGrid}>
          <For each={props.posts()}>
            {(post) => (
              <div
                class={styles.postCard}
                onClick={() => post.media_url && props.onViewMedia(post.media_url)}
                onContextMenu={(e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  props.onShowActionSheet();
                }}
              >
                <div class={styles.postMedia}>
                  {resolveMediaType(post.media_url) === 'video' ? (
                    <video src={post.media_url} preload="metadata" />
                  ) : (
                    <img src={post.media_url || './img/background/back001.jpg'} alt="" />
                  )}
                  {resolveMediaType(post.media_url) === 'video' && (
                    <div class={styles.videoIndicator}><img src="./img/icons_ios/ui-play.svg" alt="" draggable={false} /></div>
                  )}
                </div>

                <div class={styles.postOverlay}>
                  <div class={styles.postHeader}>
                    <span class={styles.postAuthor}>{post.display_name || post.username}</span>
                  </div>

                  <div class={styles.postActions}>
                    <button
                      class={styles.actionBtn}
                      classList={{ [styles.liked]: post.liked }}
                      onClick={(e) => props.onToggleLike(e, post.id)}
                    >
                      <span>{post.liked ? '♥' : '♡'}</span>
                      <span class={styles.count}>{post.likes || 0}</span>
                    </button>

                    <button class={styles.actionBtn} onClick={(e) => { e.stopPropagation(); props.onSharePost(post.id); }}>
                      <span><img src="./img/icons_ios/ui-plane.svg" alt="" draggable={false} /></span>
                    </button>

                    <Show when={post.is_own}>
                      <button class={styles.actionBtn} onClick={(e) => props.onDeletePost(e, post.id)}>
                        <span><img src="./img/icons_ios/ui-trash.svg" alt="" draggable={false} /></span>
                      </button>
                    </Show>
                  </div>

                  <Show when={post.caption}>
                    <p class={styles.postCaption}>{post.caption}</p>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>

        <Show when={!props.loading() && props.posts().length === 0}>
          <EmptyState class={styles.emptyState} title={t('snap.empty_posts_title', props.language())} description={t('snap.empty_posts_desc', props.language())} />
        </Show>
      </div>
    </>
  );
}
