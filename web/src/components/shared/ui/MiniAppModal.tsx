import { For, Show, createSignal, createMemo, onCleanup } from 'solid-js';
import { useNuiCustomEvent } from '../../../utils/useNui';
import { fetchNui } from '../../../utils/fetchNui';
import { sanitizeText } from '../../../utils/sanitize';
import styles from './MiniAppModal.module.scss';

interface MiniAppOption {
  id: string;
  label: string;
  icon?: string;
  tone?: 'default' | 'primary' | 'danger';
}

interface MiniAppPayload {
  title?: string;
  url?: string;
  height?: number;
  resourceName?: string;
  options?: MiniAppOption[];
  callbackEvent?: string;
}

const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'blob:', 'file:', 'vbscript:'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];

function isUrlSafe(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  for (const proto of BLOCKED_PROTOCOLS) {
    if (lower.startsWith(proto)) return false;
  }
  if (!lower.startsWith('https://') && !lower.startsWith('http://')) return false;
  try { new URL(url); return true; } catch { return false; }
}

function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch { return false; }
}

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

export function MiniAppModal() {
  const [miniApp, setMiniApp] = createSignal<MiniAppPayload | null>(null);

  const handleOptionClick = async (optionId: string) => {
    const app = miniApp();
    if (!app) return;
    const cbEvent = app.callbackEvent || 'gcphone:miniAppCallback';
    if (!cbEvent.startsWith('gcphone:miniApp:') && cbEvent !== 'gcphone:miniAppCallback') {
      return;
    }
    await fetchNui(cbEvent, { optionId, resourceName: app.resourceName });
    setMiniApp(null);
  };

  useNuiCustomEvent<MiniAppPayload>('gcphone:openMiniApp', (payload) => {
    if (!payload) return;
    const hasOptions = Array.isArray(payload.options) && payload.options.length > 0;
    const url = (payload.url || '').trim();
    if (!hasOptions && !url) return;
    if (url && !isUrlSafe(url) && !hasOptions) return;

    const options = Array.isArray(payload.options)
      ? payload.options.slice(0, 10).map((opt) => ({
          id: sanitizeText(opt?.id || '', 32) || `opt_${Math.random()}`,
          label: sanitizeText(opt?.label || '', 60),
          icon: sanitizeText(opt?.icon || '', 8) || undefined,
          tone: opt?.tone === 'primary' ? 'primary' as const : opt?.tone === 'danger' ? 'danger' as const : 'default' as const,
        })).filter((opt) => opt.label)
      : [];

    setMiniApp({
      title: sanitizeText(payload.title || 'App', 40),
      url: isUrlSafe(url) ? url : undefined,
      height: Math.max(200, Math.min(600, Number(payload.height) || 400)),
      resourceName: sanitizeText(payload.resourceName || '', 40) || undefined,
      options: options.length > 0 ? options : undefined,
      callbackEvent: sanitizeText(payload.callbackEvent || '', 60) || undefined,
    });
  });

  useNuiCustomEvent('gcphone:closeMiniApp', () => {
    setMiniApp(null);
  });

  onCleanup(() => setMiniApp(null));

  const isImage = createMemo(() => {
    const app = miniApp();
    return app?.url ? isImageUrl(app.url) : false;
  });

  const badge = createMemo(() => {
    const app = miniApp();
    if (!app) return '';
    const parts: string[] = [];
    if (app.resourceName) parts.push(app.resourceName);
    if (app.url) parts.push(getDomain(app.url));
    return parts.join(' · ');
  });

  return (
    <Show when={miniApp()}>
      {(app) => (
        <div class={styles.overlay} onClick={() => setMiniApp(null)}>
          <div class={styles.sheet} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div class={styles.header}>
              <div class={styles.headerInfo}>
                <div class={styles.headerTitle}>{app().title}</div>
                <Show when={badge()}>
                  <div class={styles.headerBadge}>{badge()}</div>
                </Show>
              </div>
              <button class={styles.closeBtn} onClick={() => setMiniApp(null)}>✕</button>
            </div>

            {/* URL Content */}
            <Show when={app().url}>
              <div class={styles.content}>
                <Show when={isImage()} fallback={
                  <iframe
                    src={app().url}
                    sandbox="allow-scripts"
                    referrerpolicy="no-referrer"
                    class={styles.iframe}
                    style={{ 'min-height': `${app().height || 280}px` }}
                  />
                }>
                  <div class={styles.imageWrap}>
                    <img
                      src={app().url}
                      alt={app().title}
                      class={styles.image}
                      referrerpolicy="no-referrer"
                    />
                  </div>
                </Show>
              </div>
            </Show>

            {/* Options */}
            <Show when={app().options && app().options!.length > 0}>
              <div class={styles.options}>
                <For each={app().options}>
                  {(opt) => (
                    <button
                      class={styles.optionBtn}
                      classList={{
                        [styles.optionPrimary]: opt.tone === 'primary',
                        [styles.optionDanger]: opt.tone === 'danger',
                      }}
                      onClick={() => handleOptionClick(opt.id)}
                    >
                      <Show when={opt.icon}><span class={styles.optionIcon}>{opt.icon}</span></Show>
                      <span>{opt.label}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
