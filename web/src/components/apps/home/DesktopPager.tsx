import { For } from 'solid-js';
import styles from './DesktopPager.module.scss';

interface DesktopPagerProps {
  currentPage: () => number;
  pageCount: () => number;
  hasWidgetPage: boolean;
  onPageChange: (page: number) => void;
}

export function DesktopPager(props: DesktopPagerProps) {
  const totalDots = () => (props.hasWidgetPage ? 1 : 0) + props.pageCount();

  return (
    <div class={styles.pager}>
      <button class={styles.pageBtn} onClick={() => props.onPageChange(props.currentPage() - 1)}>
        <img src="./img/icons_ios/ui-chevron-left.svg" alt="" draggable={false} />
      </button>
      <div class={styles.pageDots}>
        <For each={Array.from({ length: totalDots() })}>
          {(_, idx) => {
            const pageIdx = () => (props.hasWidgetPage ? idx() - 1 : idx());
            const isWidget = () => props.hasWidgetPage && idx() === 0;
            const isActive = () => props.currentPage() === pageIdx();
            return (
              <span class={styles.dot} classList={{
                [styles.activeDot]: isActive(),
                [styles.widgetDot]: isWidget(),
              }} />
            );
          }}
        </For>
      </div>
      <button class={styles.pageBtn} onClick={() => props.onPageChange(props.currentPage() + 1)}>
        <img src="./img/icons_ios/ui-chevron-right.svg" alt="" draggable={false} />
      </button>
    </div>
  );
}
