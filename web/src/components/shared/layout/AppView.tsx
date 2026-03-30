import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { AppScaffold } from './AppScaffold';
import { AppTabs } from './AppLayout';
import { ScreenState } from '@/components/shared/ui/ScreenState';
import { SkeletonList } from '@/components/shared/ui/SkeletonList';
import { useBackspaceKey } from '@/hooks/usePhoneKeyHandler';
import type { AppLoader } from '@/hooks/createAppLoader';
import type { TabItem } from './AppLayout';

export interface AppViewProps<T> {
  title: string;
  subtitle?: string;
  action?: {
    icon: string;
    onClick: () => void;
    label?: string;
  };
  tabs?: {
    items: TabItem[];
    active: string;
    onChange: (id: string) => void;
  };
  loader?: AppLoader<T>;
  skeleton?: JSX.Element;
  emptyTitle?: string;
  emptyDescription?: string;
  onBack?: () => void;
  bodyClass?: string;
  bodyPadding?: 'none' | 'sm' | 'md';
  transparent?: boolean;
  children: ((data: T) => JSX.Element) | JSX.Element;
}

export function AppView<T = unknown>(props: AppViewProps<T>) {
  useBackspaceKey(props.onBack);

  const footer = () =>
    props.tabs
      ? <AppTabs tabs={props.tabs.items} active={props.tabs.active} onChange={props.tabs.onChange} />
      : undefined;

  const isEmpty = () => {
    if (!props.loader) return false;
    const d = props.loader.data();
    return Array.isArray(d) ? d.length === 0 : !d;
  };

  return (
    <AppScaffold
      title={props.title}
      subtitle={props.subtitle}
      action={props.action}
      onBack={props.onBack}
      footer={footer()}
      footerFixed={!!props.tabs}
      bodyClass={props.bodyClass}
      bodyPadding={props.bodyPadding}
      transparent={props.transparent}
    >
      <Show when={props.loader} fallback={props.children as JSX.Element}>
        <Show
          when={!props.loader!.loading()}
          fallback={props.skeleton || <SkeletonList rows={6} />}
        >
          <ScreenState
            loading={false}
            error={props.loader!.error()}
            empty={isEmpty()}
            emptyTitle={props.emptyTitle}
            emptyDescription={props.emptyDescription}
          >
            {typeof props.children === 'function'
              ? (props.children as (data: T) => JSX.Element)(props.loader!.data())
              : props.children}
          </ScreenState>
        </Show>
      </Show>
    </AppScaffold>
  );
}
