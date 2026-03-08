import type { JSX, ParentProps } from 'solid-js';
import { Show } from 'solid-js';
import { AppBody, AppFooter, AppHeader, AppLayout } from './AppLayout';

interface AppScaffoldProps extends ParentProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: string;
  action?: {
    icon: string;
    onClick: () => void;
    label?: string;
  };
  headerRight?: JSX.Element;
  footer?: JSX.Element;
  bodyClass?: string;
  bodyPadding?: 'none' | 'sm' | 'md';
  footerFixed?: boolean;
  transparent?: boolean;
}

export function AppScaffold(props: AppScaffoldProps) {
  return (
    <AppLayout transparent={props.transparent}>
      <AppHeader
        title={props.title}
        subtitle={props.subtitle}
        onBack={props.onBack}
        backIcon={props.backIcon}
        action={props.action}
      >
        {props.headerRight}
      </AppHeader>

      <AppBody class={props.bodyClass} padding={props.bodyPadding}>{props.children}</AppBody>

      <Show when={props.footer}>
        <AppFooter fixed={props.footerFixed}>{props.footer}</AppFooter>
      </Show>
    </AppLayout>
  );
}
