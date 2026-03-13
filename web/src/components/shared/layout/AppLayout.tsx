import type { JSX, ParentComponent, ParentProps } from 'solid-js';
import { Show } from 'solid-js';
import { getStoredLanguage, tl } from '../../../i18n';
import styles from './layout.module.scss';

const isAssetIcon = (icon?: string) => !!icon && /\.(svg|png|webp|jpg|jpeg)$/i.test(icon);

export interface AppLayoutProps extends ParentProps {
  class?: string;
  scrollable?: boolean;
  transparent?: boolean;
}

export const AppLayout: ParentComponent<AppLayoutProps> = (props) => {
  return (
    <div
      class="ios-page"
      classList={{
        [styles.layout]: true,
        [styles.transparent]: props.transparent,
        [props.class || '']: !!props.class,
      }}
    >
      {props.children}
    </div>
  );
};

export interface AppHeaderProps extends ParentProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: string;
  transparent?: boolean;
  action?: {
    icon: string;
    onClick: () => void;
    label?: string;
  };
  class?: string;
}

export const AppHeader: ParentComponent<AppHeaderProps> = (props) => {
  const title = () => tl(props.title, getStoredLanguage());
  const subtitle = () => props.subtitle ? tl(props.subtitle, getStoredLanguage()) : '';
  const router = {
    goBack: () => {
      window.dispatchEvent(new CustomEvent('phone:keyUp', { detail: 'Backspace' }));
    },
  };

  const handleBack = () => {
    if (props.onBack) {
      props.onBack();
    } else {
      router.goBack();
    }
  };

  return (
    <div
      class="ios-nav"
      classList={{
        [styles.header]: true,
        [styles.transparent]: props.transparent,
        [props.class || '']: !!props.class,
      }}
    >
      <button class="ios-icon-btn" type="button" onClick={handleBack} aria-label="Volver">
        <Show when={isAssetIcon(props.backIcon)} fallback={<img src="./img/icons_ios/ui-chevron-left.svg" alt="" draggable={false} aria-hidden="true" />}>
          <img src={props.backIcon as string} alt="" draggable={false} aria-hidden="true" />
        </Show>
      </button>
      <div class="ios-nav-title">
        <Show when={props.title}>
          <span class={styles.titleText}>{title()}</span>
        </Show>
        <Show when={props.subtitle}>
          <span class={styles.subtitleText}>{subtitle()}</span>
        </Show>
      </div>
      <Show when={props.action}>
        <button class="ios-icon-btn" type="button" onClick={props.action!.onClick} aria-label={props.action!.label || 'Accion'}>
          <Show
              when={isAssetIcon(props.action!.icon)}
              fallback={props.action!.icon}
            >
              <img src={props.action!.icon as string} alt="" draggable={false} aria-hidden="true" />
             </Show>
           </button>
      </Show>
      <Show when={!props.action && props.children}>
        <div class={styles.headerChildren}>{props.children}</div>
      </Show>
    </div>
  );
};

export interface AppBodyProps extends ParentProps {
  class?: string;
  padding?: 'none' | 'sm' | 'md';
  onScroll?: (e: Event) => void;
}

export const AppBody: ParentComponent<AppBodyProps> = (props) => {
  return (
    <div
      class="ios-content"
      classList={{
        [styles.body]: true,
        [styles.paddingNone]: props.padding === 'none',
        [styles.paddingSm]: props.padding === 'sm',
        [props.class || '']: !!props.class,
      }}
      onScroll={props.onScroll}
    >
      {props.children}
    </div>
  );
};

export interface AppFooterProps extends ParentProps {
  class?: string;
  transparent?: boolean;
  fixed?: boolean;
}

export const AppFooter: ParentComponent<AppFooterProps> = (props) => {
  return (
    <div
      classList={{
        [styles.footer]: true,
        [styles.transparent]: props.transparent,
        [styles.fixed]: props.fixed,
        [props.class || '']: !!props.class,
      }}
    >
      {props.children}
    </div>
  );
};

export interface AppFABProps {
  icon?: JSX.Element | string;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  class?: string;
  containerClass?: string;
  tooltip?: string;
  tooltipVisible?: boolean;
  tooltipClass?: string;
  disabled?: boolean;
  onPointerDown?: JSX.EventHandlerUnion<HTMLButtonElement, PointerEvent>;
  onPointerUp?: JSX.EventHandlerUnion<HTMLButtonElement, PointerEvent>;
  onPointerLeave?: JSX.EventHandlerUnion<HTMLButtonElement, PointerEvent>;
  onPointerCancel?: JSX.EventHandlerUnion<HTMLButtonElement, PointerEvent>;
  title?: string;
}

export function AppFAB(props: AppFABProps) {
  const button = (
    <button
      classList={{
        [styles.fab]: true,
        [styles.fabLeft]: props.position === 'bottom-left',
        [styles.fabCenter]: props.position === 'bottom-center',
        [props.class || '']: !!props.class,
      }}
      onClick={props.onClick}
      onPointerDown={props.onPointerDown}
      onPointerUp={props.onPointerUp}
      onPointerLeave={props.onPointerLeave}
      onPointerCancel={props.onPointerCancel}
      disabled={props.disabled}
      title={props.title}
    >
      {props.icon || '+'}
    </button>
  );

  if (!props.tooltip && !props.containerClass) {
    return button;
  }

  return (
    <div classList={{ [styles.fabDock]: true, [props.containerClass || '']: !!props.containerClass }}>
      <Show when={props.tooltip && props.tooltipVisible}>
        <div classList={{ [styles.fabTooltip]: true, [props.tooltipClass || '']: !!props.tooltipClass }}>
          {props.tooltip}
        </div>
      </Show>
      {button}
    </div>
  );
}

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

export interface AppTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  class?: string;
}

export function AppTabs(props: AppTabsProps) {
  return (
    <div classList={{ [styles.tabs]: true, [props.class || '']: !!props.class }} role="tablist">
      {props.tabs.map((tab) => (
        <button
          type="button"
          classList={{
            [styles.tab]: true,
            [styles.tabActive]: props.active === tab.id,
          }}
          onClick={() => props.onChange(tab.id)}
          role="tab"
          aria-selected={props.active === tab.id}
          aria-label={tl(tab.label, getStoredLanguage())}
          tabIndex={props.active === tab.id ? 0 : -1}
        >
          <Show when={tab.icon}>
            <span class={styles.tabIcon} aria-hidden="true">
              <Show when={tab.icon!.endsWith('.svg')} fallback={tab.icon}>
                <img src={tab.icon} alt="" />
              </Show>
            </span>
          </Show>
          <span class={styles.tabLabel}>{tl(tab.label, getStoredLanguage())}</span>
          <Show when={tab.badge && tab.badge > 0}>
            <span class={styles.tabBadge}>{tab.badge! > 99 ? '99+' : tab.badge}</span>
          </Show>
        </button>
      ))}
    </div>
  );
}
