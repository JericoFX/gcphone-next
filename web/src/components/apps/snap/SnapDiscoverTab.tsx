import { Show, type Accessor } from 'solid-js';
import { sanitizeText } from '../../../utils/sanitize';
import { resolveMediaType } from '../../../utils/sanitize';
import { t } from '../../../i18n';
import { SearchInput } from '../../shared/ui/SearchInput';
import { VirtualList } from '../../shared/ui/VirtualList';
import type { SnapDiscoverPost } from './SnapTypes';
import styles from './SnapApp.module.scss';

interface SnapDiscoverTabProps {
  language: Accessor<string>;
  discoverQuery: Accessor<string>;
  setDiscoverQuery: (value: string) => void;
  discoverLoading: Accessor<boolean>;
  discoverRows: Accessor<SnapDiscoverPost[]>;
  discoverHasMore: Accessor<boolean>;
  discoverLoadingMore: Accessor<boolean>;
  onViewMedia: (url: string) => void;
  onFollowAccount: (entry: SnapDiscoverPost) => void;
  onLoadMore: () => void;
}

export function SnapDiscoverTab(props: SnapDiscoverTabProps) {
  return (
    <div class={styles.discoverSection}>
      <h4 class={styles.sectionTitle}>{t('snap.discover', props.language())}</h4>
      <SearchInput
        value={props.discoverQuery()}
        onInput={(value) => props.setDiscoverQuery(sanitizeText(value, 60))}
        placeholder={t('snap.search_placeholder', props.language())}
        class={styles.discoverSearchRoot}
        inputClass={styles.discoverSearch}
      />

      <Show when={!props.discoverLoading()} fallback={<p class={styles.discoverHint}>{t('snap.loading_discover', props.language())}</p>}>
        <Show when={props.discoverRows().length > 0} fallback={<p class={styles.discoverHint}>{t('snap.no_discover_posts', props.language())}</p>}>
          <VirtualList
            items={props.discoverRows}
            itemHeight={170}
            overscan={4}
            class={styles.discoverVirtual}
            contentClass={styles.discoverVirtualContent}
          >
            {(post) => {
              const canFollow = Number(post.account_id || 0) > 0;
              const isFollowing = Number(post.is_following || 0) === 1;
              const requestedByMe = Number(post.requested_by_me || 0) === 1;
              return (
                <div class={styles.discoverPostRow}>
                  <button
                    class={styles.discoverMedia}
                    onClick={() => post.media_url && props.onViewMedia(post.media_url)}
                  >
                    {resolveMediaType(post.media_url) === 'video' ? (
                      <video src={post.media_url} preload="metadata" muted />
                    ) : (
                      <img src={post.media_url || './img/background/back001.jpg'} alt="" />
                    )}
                  </button>

                  <div class={styles.discoverMeta}>
                    <strong>{post.display_name || post.username || t('chirp.user', props.language())}</strong>
                    <span>@{post.username || 'user'}</span>
                    <Show when={post.caption}>
                      <p>{post.caption}</p>
                    </Show>
                  </div>

                  <Show when={canFollow}>
                    <button
                      class={styles.discoverFollowBtn}
                      classList={{ [styles.acceptBtn]: !isFollowing }}
                      disabled={isFollowing}
                      onClick={() => void props.onFollowAccount(post)}
                    >
                      {isFollowing
                        ? t('snap.following', props.language())
                        : requestedByMe
                          ? t('action.cancel', props.language())
                          : Number(post.is_private || 0) === 1
                            ? t('snap.request_follow', props.language())
                            : t('snap.follow', props.language())}
                    </button>
                  </Show>
                </div>
              );
            }}
          </VirtualList>

          <Show when={props.discoverHasMore()}>
            <button
              class={styles.socialActionBtn}
              disabled={props.discoverLoadingMore()}
              onClick={() => void props.onLoadMore()}
            >
              {props.discoverLoadingMore() ? t('state.loading', props.language()) : t('snap.load_more', props.language())}
            </button>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
