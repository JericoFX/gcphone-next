import { Show, Switch, Match, For, createSignal, createMemo, createEffect, on } from 'solid-js';
import { Motion, Presence } from '@motionone/solid';
import { useSDK } from '../../../store/sdk';
import { sanitizeText } from '../../../utils/sanitize';
import { SDKElementRenderer } from './PhoneSDKElements';
import type { SDKElement, SDKInputElement, SDKNumberElement, SDKSelectElement, SDKListItem, SDKOption, SDKView } from '../../../types/sdk';
import styles from './PhoneSDKModal.module.scss';

function isFieldRequired(el: SDKElement): boolean {
  if (el.type === 'input' || el.type === 'number' || el.type === 'select') {
    return !!(el as SDKInputElement | SDKNumberElement | SDKSelectElement).required;
  }
  return false;
}

function getFieldId(el: SDKElement): string | undefined {
  if ('id' in el) return el.id as string;
  return undefined;
}

function buildDefaults(elements: SDKElement[]): Record<string, string | number | boolean> {
  const data: Record<string, string | number | boolean> = {};
  for (const el of elements) {
    const id = getFieldId(el);
    if (!id) continue;
    if (el.type === 'input' || el.type === 'textarea') {
      data[id] = el.default ?? '';
    } else if (el.type === 'number') {
      data[id] = el.default ?? '';
    } else if (el.type === 'select') {
      data[id] = el.default ?? '';
    } else if (el.type === 'checkbox') {
      data[id] = el.default ?? false;
    }
  }
  return data;
}

function validateRequired(elements: SDKElement[], formData: Record<string, string | number | boolean>): Record<string, boolean> {
  const errors: Record<string, boolean> = {};
  for (const el of elements) {
    const id = getFieldId(el);
    if (!id || !isFieldRequired(el)) continue;
    const val = formData[id];
    if (val === '' || val === undefined || val === null) {
      errors[id] = true;
    }
  }
  return errors;
}

// ── Input mode ──

function InputMode() {
  const [state, actions] = useSDK();
  const [formData, setFormData] = createSignal<Record<string, string | number | boolean>>({});
  const [errors, setErrors] = createSignal<Record<string, boolean>>({});

  createEffect(on(() => state.activeModal, (modal) => {
    if (modal?.mode === 'input' && modal.elements) {
      setFormData(buildDefaults(modal.elements));
      setErrors({});
    }
  }));

  const elements = () => state.activeModal?.elements ?? [];

  const handleChange = (id: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev;
    });
  };

  const handleSubmit = () => {
    const modal = state.activeModal;
    if (!modal) return;
    const errs = validateRequired(elements(), formData());
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    actions.submitResult({
      requestId: modal.requestId,
      cancelled: false,
      formData: { ...formData() },
    });
  };

  return (
    <>
      <div class={styles.body}>
        <For each={elements()}>
          {(el) => (
            <SDKElementRenderer
              element={el}
              formData={formData()}
              onFormChange={handleChange}
              onListSelect={() => {}}
              onNavigate={() => {}}
              errors={errors()}
            />
          )}
        </For>
      </div>
      <div class={styles.actions}>
        <button class={styles.cancelBtn} onClick={() => actions.cancelActive()}>
          {sanitizeText(state.activeModal?.cancelLabel || 'Cancel', 30)}
        </button>
        <button
          classList={{
            [styles.submitBtn]: true,
            [styles.submitPrimary]: (state.activeModal?.submitTone ?? 'primary') === 'primary',
            [styles.submitDanger]: state.activeModal?.submitTone === 'danger',
          }}
          onClick={handleSubmit}
        >
          {sanitizeText(state.activeModal?.submitLabel || 'Submit', 30)}
        </button>
      </div>
    </>
  );
}

// ── Confirm mode ──

function ConfirmMode() {
  const [state, actions] = useSDK();

  const handleConfirm = () => {
    const modal = state.activeModal;
    if (!modal) return;
    actions.submitResult({
      requestId: modal.requestId,
      cancelled: false,
      confirmed: true,
    });
  };

  return (
    <>
      <div class={styles.body}>
        <p class={styles.confirmDesc}>
          {sanitizeText(state.activeModal?.description || '', 500)}
        </p>
      </div>
      <div class={styles.actions}>
        <button class={styles.cancelBtn} onClick={() => actions.cancelActive()}>
          {sanitizeText(state.activeModal?.cancelLabel || 'Cancel', 30)}
        </button>
        <button
          classList={{
            [styles.submitBtn]: true,
            [styles.submitPrimary]: (state.activeModal?.confirmTone ?? 'primary') === 'primary',
            [styles.submitDanger]: state.activeModal?.confirmTone === 'danger',
          }}
          onClick={handleConfirm}
        >
          {sanitizeText(state.activeModal?.confirmLabel || 'Confirm', 30)}
        </button>
      </div>
    </>
  );
}

// ── Select mode ──

function SelectMode() {
  const [state, actions] = useSDK();
  const [search, setSearch] = createSignal('');

  createEffect(on(() => state.activeModal, () => {
    setSearch('');
  }));

  const items = createMemo((): SDKListItem[] => {
    return state.activeModal?.items ?? [];
  });

  const filtered = createMemo(() => {
    const q = search().toLowerCase().trim();
    if (!q) return items();
    return items().filter((it) =>
      it.label.toLowerCase().includes(q) ||
      (it.description && it.description.toLowerCase().includes(q))
    );
  });

  const handleSelect = (itemId: string) => {
    const modal = state.activeModal;
    if (!modal) return;
    actions.submitResult({
      requestId: modal.requestId,
      cancelled: false,
      selectedId: itemId,
    });
  };

  return (
    <>
      <div class={styles.body}>
        <Show when={state.activeModal?.searchable}>
          <div class={styles.searchWrap}>
            <input
              class={styles.searchInput}
              type="text"
              placeholder="Search..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
            />
          </div>
        </Show>
        <div class={styles.list}>
          <For each={filtered()}>
            {(item) => (
              <button
                class={styles.listItem}
                classList={{
                  [styles.listItemPrimary]: item.tone === 'primary',
                  [styles.listItemDanger]: item.tone === 'danger',
                  [styles.listItemDisabled]: !!item.disabled,
                }}
                disabled={item.disabled}
                onClick={() => handleSelect(item.id)}
              >
                <Show when={item.icon}>
                  <span class={styles.listItemIcon}>{item.icon}</span>
                </Show>
                <div class={styles.listItemContent}>
                  <span class={styles.listItemLabel}>{sanitizeText(item.label, 60)}</span>
                  <Show when={item.description}>
                    <span class={styles.listItemDesc}>{sanitizeText(item.description || '', 120)}</span>
                  </Show>
                </div>
              </button>
            )}
          </For>
        </div>
      </div>
    </>
  );
}

// ── Registered mode ──

function RegisteredMode() {
  const [state, actions] = useSDK();
  const [currentViewId, setCurrentViewId] = createSignal('');
  const [viewHistory, setViewHistory] = createSignal<string[]>([]);
  const [formData, setFormData] = createSignal<Record<string, string | number | boolean>>({});
  const [errors, setErrors] = createSignal<Record<string, boolean>>({});

  createEffect(on(() => state.activeModal, (modal) => {
    if (modal?.mode === 'registered' && modal.views) {
      const startId = modal.startView || Object.keys(modal.views)[0] || '';
      setCurrentViewId(startId);
      setViewHistory([]);
      const view = modal.views[startId];
      if (view) {
        setFormData(buildDefaults(view.elements));
      } else {
        setFormData({});
      }
      setErrors({});
    }
  }));

  const views = createMemo((): Record<string, SDKView> => state.activeModal?.views ?? {});
  const currentView = createMemo((): SDKView | undefined => views()[currentViewId()]);

  const navigateTo = (viewId: string) => {
    if (!views()[viewId]) return;
    setViewHistory((prev) => [...prev, currentViewId()]);
    setCurrentViewId(viewId);
    const view = views()[viewId];
    if (view) {
      setFormData((prev) => ({ ...prev, ...buildDefaults(view.elements) }));
    }
    setErrors({});
  };

  const goBack = () => {
    const history = viewHistory();
    if (history.length === 0) {
      actions.cancelActive();
      return;
    }
    const prev = history[history.length - 1];
    setViewHistory((h) => h.slice(0, -1));
    setCurrentViewId(prev);
    setErrors({});
  };

  const handleChange = (id: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev;
    });
  };

  const handleListSelect = (listId: string, itemId: string) => {
    const modal = state.activeModal;
    if (!modal) return;
    actions.submitResult({
      requestId: modal.requestId,
      cancelled: false,
      selectedId: itemId,
      view: currentViewId(),
      formData: { ...formData() },
    });
  };

  const handleOption = (opt: SDKOption) => {
    const modal = state.activeModal;
    if (!modal) return;

    if (opt.navigateTo) {
      navigateTo(opt.navigateTo);
      return;
    }

    const view = currentView();
    if (view) {
      const errs = validateRequired(view.elements, formData());
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
    }

    actions.submitResult({
      requestId: modal.requestId,
      cancelled: false,
      optionId: opt.id,
      view: currentViewId(),
      formData: { ...formData() },
    });
  };

  const displayTitle = createMemo(() => {
    const view = currentView();
    return view?.title || state.activeModal?.title || '';
  });

  const canGoBack = createMemo(() => viewHistory().length > 0);

  const options = createMemo((): SDKOption[] => {
    const view = currentView();
    return view?.options ?? state.activeModal?.options ?? [];
  });

  return (
    <>
      <Show when={canGoBack() || displayTitle() !== (state.activeModal?.title || '')}>
        <div class={styles.header} style={{ 'border-bottom': 'none', 'padding-bottom': '0' }}>
          <Show when={canGoBack()}>
            <button class={styles.backBtn} onClick={goBack}>&#8249;</button>
          </Show>
          <div class={styles.headerInfo}>
            <div class={styles.headerTitle}>{sanitizeText(displayTitle(), 60)}</div>
          </div>
        </div>
      </Show>
      <div class={styles.body}>
        <Show when={currentView()}>
          {(view) => (
            <For each={view().elements}>
              {(el) => (
                <SDKElementRenderer
                  element={el}
                  formData={formData()}
                  onFormChange={handleChange}
                  onListSelect={handleListSelect}
                  onNavigate={navigateTo}
                  errors={errors()}
                />
              )}
            </For>
          )}
        </Show>
      </div>
      <Show when={options().length > 0}>
        <div class={styles.actions}>
          <For each={options()}>
            {(opt) => (
              <button
                classList={{
                  [styles.submitBtn]: true,
                  [styles.submitPrimary]: opt.tone === 'primary',
                  [styles.submitDanger]: opt.tone === 'danger',
                }}
                onClick={() => handleOption(opt)}
              >
                {sanitizeText(opt.label, 30)}
              </button>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

// ── Main component ──

export function PhoneSDKModal() {
  const [state, actions] = useSDK();

  const isOpen = createMemo(() => !!state.activeModal);
  const badge = createMemo(() => state.activeModal?.resourceName || '');

  return (
    <Presence>
      <Show when={isOpen()}>
        <Motion.div
          class={styles.overlay}
          onClick={() => actions.cancelActive()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Motion.div
            class={styles.sheet}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            initial={{ transform: 'translateY(100%)' }}
            animate={{ transform: 'translateY(0%)' }}
            exit={{ transform: 'translateY(100%)' }}
            transition={{ duration: 0.28, easing: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Header */}
            <div class={styles.header}>
              <Show when={state.activeModal?.icon}>
                <span class={styles.headerIcon}>{state.activeModal!.icon}</span>
              </Show>
              <div class={styles.headerInfo}>
                <div class={styles.headerTitle}>{sanitizeText(state.activeModal?.title || '', 60)}</div>
                <Show when={badge()}>
                  <div class={styles.headerBadge}>{sanitizeText(badge(), 40)}</div>
                </Show>
              </div>
              <button class={styles.closeBtn} onClick={() => actions.cancelActive()}>&#10005;</button>
            </div>

            {/* Mode content */}
            <Switch>
              <Match when={state.activeModal?.mode === 'input'}>
                <InputMode />
              </Match>
              <Match when={state.activeModal?.mode === 'confirm'}>
                <ConfirmMode />
              </Match>
              <Match when={state.activeModal?.mode === 'select'}>
                <SelectMode />
              </Match>
              <Match when={state.activeModal?.mode === 'registered'}>
                <RegisteredMode />
              </Match>
            </Switch>
          </Motion.div>
        </Motion.div>
      </Show>
    </Presence>
  );
}
