# UI Components

All shared components live in `web/src/components/shared/`. Import via the `@/` alias.

## Layout Components

### AppView

High-level composite that wires AppScaffold + ScreenState + SkeletonList + tabs together. Preferred way to build a standard app page.

```ts
// web/src/components/shared/layout/AppView.tsx

interface AppViewProps<T> {
  title: string;
  subtitle?: string;
  action?: { icon: string; onClick: () => void; label?: string };
  tabs?: {
    items: TabItem[];
    active: string;
    onChange: (id: string) => void;
  };
  loader?: AppLoader<T>;        // From createAppLoader
  skeleton?: JSX.Element;        // Custom skeleton (default: SkeletonList)
  emptyTitle?: string;
  emptyDescription?: string;
  onBack?: () => void;
  bodyClass?: string;
  bodyPadding?: 'none' | 'sm' | 'md';
  transparent?: boolean;
  children: ((data: T) => JSX.Element) | JSX.Element;
}
```

```tsx
import { AppView } from '@/components/shared/layout/AppView';

function NotesApp() {
  const loader = createAppLoader(() => fetchNui<Note[]>('getNotes', {}, []), { initialData: [] });

  return (
    <AppView title="app.notes" loader={loader} emptyTitle="No notes yet">
      {(notes) => (
        <For each={notes}>{(note) => <NoteRow note={note} />}</For>
      )}
    </AppView>
  );
}
```

When `loader` is provided, AppView automatically handles loading (skeleton), error, and empty states. The `children` render function receives the loaded data.

---

### AppScaffold

Combines AppLayout + AppHeader + AppBody + AppFooter into a single wrapper. Use when you need more control than AppView provides.

```ts
// web/src/components/shared/layout/AppScaffold.tsx

interface AppScaffoldProps extends ParentProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: string;
  action?: { icon: string; onClick: () => void; label?: string };
  headerRight?: JSX.Element;
  footer?: JSX.Element;
  bodyClass?: string;
  bodyPadding?: 'none' | 'sm' | 'md';
  footerFixed?: boolean;
  transparent?: boolean;
}
```

```tsx
import { AppScaffold } from '@/components/shared/layout/AppScaffold';

<AppScaffold title="Settings" action={{ icon: './img/icons_ios/ui-plus.svg', onClick: handleAdd }}>
  <div class="ios-list">...</div>
</AppScaffold>
```

---

### AppLayout

The root page container. Renders a `div.ios-page` with flex column layout.

```ts
interface AppLayoutProps extends ParentProps {
  class?: string;
  scrollable?: boolean;
  transparent?: boolean;
}
```

---

### AppHeader

Navigation bar with back button, title/subtitle, and optional action button.

```ts
interface AppHeaderProps extends ParentProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;          // Custom back handler (default: router.goBack)
  backIcon?: string;            // Custom back icon path
  transparent?: boolean;
  action?: {
    icon: string;               // SVG path or emoji
    onClick: () => void;
    label?: string;             // Accessibility label
  };
  class?: string;
}
```

If `action` is not provided but `children` are, the children render in the header's right slot.

---

### AppBody

Scrollable content area. Renders a `div.ios-content`.

```ts
interface AppBodyProps extends ParentProps {
  class?: string;
  padding?: 'none' | 'sm' | 'md';
  onScroll?: (e: Event) => void;
}
```

---

### AppFooter

Fixed or inline footer area.

```ts
interface AppFooterProps extends ParentProps {
  class?: string;
  transparent?: boolean;
  fixed?: boolean;
}
```

---

### AppTabs

Tab bar rendered in the footer. Used by AppView's `tabs` prop or standalone.

```ts
interface TabItem {
  id: string;
  label: string;                // i18n key
  icon?: string;                // SVG path
  badge?: number;
}

interface AppTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  class?: string;
}
```

```tsx
import { AppTabs } from '@/components/shared/layout/AppLayout';

const TABS: TabItem[] = [
  { id: 'all', label: 'tabs.all', icon: './img/icons_ios/list.svg' },
  { id: 'favorites', label: 'tabs.favorites', icon: './img/icons_ios/star.svg', badge: 3 },
];

<AppTabs tabs={TABS} active={tab()} onChange={setTab} />
```

---

### AppFAB

Floating action button.

```ts
interface AppFABProps {
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
```

```tsx
import { AppFAB } from '@/components/shared/layout/AppLayout';

<AppFAB icon="+" onClick={handleCreate} tooltip="New note" tooltipVisible={showTip()} />
```

---

## UI Components

### Modal

Animated modal dialog with overlay. Uses `@motionone/solid` for enter/exit animations.

```ts
// web/src/components/shared/ui/Modal.tsx

interface ModalProps extends ParentProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';   // Default: 'md'
  class?: string;
}
```

```tsx
import { Modal, ModalActions, ModalButton, FormField } from '@/components/shared/ui/Modal';

<Modal open={showModal()} title="Edit Contact" onClose={() => setShowModal(false)}>
  <FormField label="Name" value={name()} onChange={setName} />
  <FormField label="Phone" value={phone()} onChange={setPhone} type="tel" />
  <ModalActions>
    <ModalButton label="Cancel" onClick={() => setShowModal(false)} />
    <ModalButton label="Save" onClick={handleSave} tone="primary" />
  </ModalActions>
</Modal>
```

Additional exports from Modal.tsx:

| Component | Props |
|---|---|
| `ModalActions` | `class?` -- wraps action buttons |
| `ModalButton` | `label, onClick, tone?: 'default'\|'primary'\|'danger', disabled?` |
| `FormField` | `label, value, onChange, type?: 'text'\|'number'\|'tel'\|'url', placeholder?, disabled?` |
| `FormTextarea` | `label, value, onChange, placeholder?, rows?, disabled?` |
| `FormSection` | `label?, children` -- groups form fields |
| `FormRow` | `children, columns?: 1\|2\|3` -- horizontal layout |
| `FormCheckbox` | `checked, onChange, label` |

---

### ActionSheet

iOS-style bottom action sheet with animated slide-up.

```ts
// web/src/components/shared/ui/ActionSheet.tsx

interface ActionSheetAction {
  label: string;                // i18n key
  tone?: 'default' | 'primary' | 'danger';
  onClick: () => void | Promise<void>;
}

interface ActionSheetProps {
  open: boolean;
  title?: string;
  actions: ActionSheetAction[];
  onClose: () => void;
}
```

```tsx
import { ActionSheet } from '@/components/shared/ui/ActionSheet';

<ActionSheet
  open={menu.isOpen()}
  title="Options"
  actions={[
    { label: 'Edit', onClick: handleEdit },
    { label: 'Delete', tone: 'danger', onClick: handleDelete },
  ]}
  onClose={menu.close}
/>
```

The cancel button is added automatically.

---

### ScreenState

Renders loading, error, or empty states based on props. Falls through to children when none apply.

```ts
// web/src/components/shared/ui/ScreenState.tsx

interface ScreenStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: any;
}
```

```tsx
import { ScreenState } from '@/components/shared/ui/ScreenState';

<ScreenState loading={loader.loading()} error={loader.error()} empty={items().length === 0}>
  <For each={items()}>{(item) => <Row item={item} />}</For>
</ScreenState>
```

Priority: loading > error > empty > children.

---

### Avatar

Color-generated avatar with optional image.

```ts
// web/src/components/shared/ui/Avatar.tsx

interface AvatarProps {
  identifier: string;           // Used for color generation
  display?: string;             // Shown initial (first char)
  src?: string;                 // Image URL (overrides letter)
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  class?: string;
  onClick?: () => void;
}
```

```tsx
import { Avatar, AvatarGroup } from '@/components/shared/ui/Avatar';

<Avatar identifier="555-0100" display="John Doe" size="md" />

<AvatarGroup max={3}>
  <Avatar identifier="a" display="A" size="sm" />
  <Avatar identifier="b" display="B" size="sm" />
  <Avatar identifier="c" display="C" size="sm" />
  <Avatar identifier="d" display="D" size="sm" />
</AvatarGroup>
```

`AvatarGroup` shows `max` avatars and a `+N` overflow indicator.

---

### LetterAvatar

Simpler letter avatar with explicit color control.

```ts
// web/src/components/shared/ui/LetterAvatar.tsx

interface LetterAvatarProps {
  label: string;
  color: string;               // Hex color for background
  imageUrl?: string;
  alt?: string;
  class?: string;
  gradient?: boolean;          // Gradient from color to lighter shade
  size?: number;               // px override
}
```

```tsx
import { LetterAvatar } from '@/components/shared/ui/LetterAvatar';

<LetterAvatar label="Carlos" color="#007aff" gradient size={48} />
```

---

### MediaPreview

Renders image, video, or audio based on URL file extension.

```ts
// web/src/components/shared/ui/MediaPreview.tsx

interface MediaPreviewProps {
  url: string;
  class?: string;
  onClick?: () => void;
  showControls?: boolean;       // Default: true
  autoPlay?: boolean;
  muted?: boolean;
}
```

Also exports `MediaGrid`:

```ts
interface MediaGridProps {
  items: { url: string; type?: 'image' | 'video' | 'audio' }[];
  columns?: 2 | 3 | 4;         // Default: 3
  class?: string;
  onItemClick?: (url: string, index: number) => void;
}
```

---

### MediaLightbox

Fullscreen overlay for viewing a single image or video.

```ts
// web/src/components/shared/ui/MediaLightbox.tsx

interface Props {
  url: string | null;           // null = hidden
  onClose: () => void;
}
```

```tsx
import { MediaLightbox } from '@/components/shared/ui/MediaLightbox';

<MediaLightbox url={lightboxUrl()} onClose={() => setLightboxUrl(null)} />
```

---

### NfcShareSheet

Radar-style bottom sheet for sharing via NFC (nearby players).

```ts
// web/src/components/shared/ui/NfcShareSheet.tsx

interface NfcShareSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (targetServerId: number) => void;
  title?: string;
  maxDistance?: number;          // Default: 5.0
  disabled?: boolean;
}
```

Polls `getNearbyPlayers` every 2 seconds while open. Shows a radar visualization and player list.

```tsx
import { NfcShareSheet } from '@/components/shared/ui/NfcShareSheet';

<NfcShareSheet
  open={nfc.isOpen()}
  onClose={nfc.close}
  onSelect={nfc.handleSelect}
  title="Share Contact"
/>
```

Typically paired with `useNfcShare()` hook (see [hooks-reference.md](./hooks-reference.md)).

---

### SkeletonList

Loading placeholder with animated skeleton rows.

```ts
// web/src/components/shared/ui/SkeletonList.tsx

interface SkeletonListProps {
  rows?: number;                // Default: 6
  avatar?: boolean;             // Show circular avatar placeholder
}
```

```tsx
import { SkeletonList } from '@/components/shared/ui/SkeletonList';

<SkeletonList rows={4} avatar />
```

---

### AppPlaceholder

Full-page skeleton with header, rows, optional tabs, and FAB. Used as `Suspense` fallback for lazy-loaded apps.

```ts
// web/src/components/shared/ui/AppPlaceholder.tsx

interface AppPlaceholderProps {
  title?: string;               // Real title text (or skeleton if omitted)
  rows?: number;                // Default: 6
  showHeader?: boolean;         // Default: true
  showTabs?: boolean;           // Default: false
  class?: string;
}
```

Also exports `SkeletonText`:

```ts
interface SkeletonTextProps {
  lines?: number;               // Default: 1
  class?: string;
}
```

```tsx
import { AppPlaceholder } from '@/components/shared/ui/AppPlaceholder';

<Suspense fallback={<AppPlaceholder title="Notes" rows={5} showTabs />}>
  <NotesApp />
</Suspense>
```
