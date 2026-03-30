# Styling

## SCSS Modules

All component styles use CSS Modules with SCSS. Files are named `<Component>.module.scss` and imported as an object:

```tsx
import styles from './MyApp.module.scss';

<div class={styles.container}>
  <span classList={{ [styles.active]: isActive() }}>Hello</span>
</div>
```

Class names are scoped automatically -- no collisions between apps.

To apply multiple classes or conditional classes, use `classList`:

```tsx
<div classList={{
  [styles.card]: true,
  [styles.selected]: isSelected(),
  [props.class || '']: !!props.class,
}}>
```

### File Location

Place your `.module.scss` file next to the component that uses it:

```
web/src/components/apps/notes/
  NotesApp.tsx
  NotesApp.module.scss
```

---

## CSS Variables

All theme tokens are defined in `web/src/styles/_ios-system.scss` and `web/src/styles/_variables.scss`. Use these variables instead of hardcoded colors.

### Colors

| Variable | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | `#f2f2f7` | `#000000` | Page background |
| `--surface` | `#ffffff` | `#1c1c1e` | Cards, lists, panels |
| `--surface-2` | `#f7f7fa` | `#2c2c2e` | Secondary surface |
| `--surface-3` | `#efeff4` | `#3a3a3c` | Tertiary surface, chips |
| `--text` | `#111111` | `#ffffff` | Primary text |
| `--text-2` | `rgba(17,17,17,0.72)` | `rgba(235,235,245,0.6)` | Secondary text |
| `--text-3` | `rgba(17,17,17,0.52)` | `rgba(235,235,245,0.3)` | Tertiary/placeholder text |
| `--border` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.14)` | Borders |
| `--separator` | `rgba(0,0,0,0.1)` | `rgba(84,84,88,0.65)` | List separators |
| `--tint` | `#007aff` | `#0a84ff` | Primary accent / links |
| `--tint-2` | `#0a84ff` | `#64d2ff` | Secondary accent |
| `--danger` | `#ff3b30` | `#ff453a` | Destructive actions |
| `--success` | `#34c759` | `#30d158` | Success states |
| `--warning` | `#ff9500` | `#ff9f0a` | Warning states |
| `--focus` | `rgba(0,122,255,0.35)` | `rgba(10,132,255,0.42)` | Focus rings |
| `--hover-bg` | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.06)` | Hover background |
| `--active-bg` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.1)` | Active/pressed background |

Subtle tint variants for backgrounds:

| Variable | Usage |
|---|---|
| `--tint-subtle` | Light tint background |
| `--tint-hover` | Tint hover state |
| `--danger-subtle` | Light danger background |
| `--success-subtle` | Light success background |
| `--warning-subtle` | Light warning background |

RGB variants for `rgba()` usage: `--tint-rgb`, `--danger-rgb`, `--success-rgb`, `--warning-rgb`, `--surface-rgb`, `--text-rgb`, `--border-rgb`, `--separator-rgb`.

### Typography

| Variable | Default | Usage |
|---|---|---|
| `--fs-caption2` | `0.6875rem` | Smallest labels |
| `--fs-caption1` | `0.75rem` | Badges, timestamps |
| `--fs-footnote` | `0.8125rem` | Secondary text, buttons |
| `--fs-subhead` | `0.9375rem` | List item labels |
| `--fs-body` | `1rem` | Default body text |
| `--fs-callout` | `1.0625rem` | Callout text |
| `--fs-headline` | `1.0625rem` | Bold headlines |
| `--fs-title3` | `1.25rem` | Section titles |
| `--fs-title2` | `1.375rem` | Page subtitles |
| `--fs-title1` | `1.75rem` | Page titles |
| `--fs-large` | `2.125rem` | Large display text |

All font sizes scale with `--text-scale` (default `1`).

### Spacing

| Variable | Value |
|---|---|
| `--s-1` | `4px` |
| `--s-2` | `8px` |
| `--s-3` | `12px` |
| `--s-4` | `16px` |
| `--s-5` | `20px` |
| `--s-6` | `24px` |

### Radii

| Variable | Value |
|---|---|
| `--r-xs` | `8px` |
| `--r-sm` | `10px` |
| `--r-md` | `12px` |
| `--r-lg` | `16px` |
| `--r-xl` | `20px` |
| `--r-2xl` | `26px` |
| `--r-pill` | `999px` |

### Shadows

| Variable | Usage |
|---|---|
| `--shadow-1` | Subtle card shadow |
| `--shadow-2` | Elevated panels |
| `--shadow-3` | Modals, overlays |

### Transitions

| Variable | Value |
|---|---|
| `--dur-1` | `120ms` |
| `--dur-2` | `180ms` |
| `--dur-3` | `260ms` |
| `--ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

---

## iOS Utility Classes

Global utility classes defined in `_ios-system.scss`. Use these directly in `class` attributes (no module import needed).

### Layout

| Class | Description |
|---|---|
| `.ios-page` | Root flex column container for an app page |
| `.ios-nav` | Navigation bar (58px height, sticky top) |
| `.ios-nav-title` | Centered nav title text |
| `.ios-content` | Scrollable content area (`flex: 1, overflow-y: auto`) |
| `.ios-grid-2` | 2-column grid |
| `.ios-grid-3` | 3-column grid |
| `.ios-grid-4` | 4-column grid |

### Buttons

| Class | Description |
|---|---|
| `.ios-icon-btn` | 36px circular icon button (tint background) |
| `.ios-btn` | Standard button |
| `.ios-btn-primary` | Primary filled button (tint bg, white text) |
| `.ios-btn-danger` | Danger button (red tint) |

### Lists and Cards

| Class | Description |
|---|---|
| `.ios-card` | Rounded card with border and shadow |
| `.ios-list` | Card-style list container (rounded, border, overflow hidden) |
| `.ios-row` | List row (min-height 48px, separator border) |
| `.ios-label` | Row label text (subhead weight 600) |
| `.ios-value` | Row value text (footnote, tertiary color) |
| `.ios-section-title` | Section header (uppercase, caption, tertiary) |
| `.ios-divider` | Horizontal separator line |

### Forms

| Class | Description |
|---|---|
| `.ios-input` | Text input (44px height, rounded, focus ring) |
| `.ios-textarea` | Multi-line textarea |
| `.ios-select` | Select dropdown |

### Chips and Segments

| Class | Description |
|---|---|
| `.ios-chip` | Pill-shaped tag/chip |
| `.ios-segment` | Segmented control container |
| `.ios-segment-btn` | Segment button |
| `.ios-segment-btn-active` | Active segment (white bg, shadow) |

### Switch

| Class | Description |
|---|---|
| `.ios18-switch` | Toggle switch (set `aria-checked="true"` for on state) |
| `.ios18-switch__thumb` | Switch thumb element |

### Animations

| Class | Description |
|---|---|
| `.ios18-motion-rise` | Fade up + scale entrance (260ms) |
| `.ios18-motion-pop` | Scale pop entrance (180ms) |
| `.ios18-motion-sheet` | Slide up entrance (260ms) |
| `.ios18-stagger` | Stagger children animations (40ms increments) |
| `.ios18-skel` | Skeleton shimmer animation |

### Empty State

| Class | Description |
|---|---|
| `.ios18-empty` | Centered empty state container |

---

## Theme Support

The phone supports three theme modes: `light`, `dark`, and `auto`.

Theme is applied via CSS class on the phone screen element:

- `.gcphone-app.theme-light` -- forces light mode
- `.gcphone-app.theme-dark` -- forces dark mode
- No class (auto) -- follows `prefers-color-scheme`

All CSS variables update automatically. Your styles respond to theme changes with no extra code as long as you use the variables above.

```scss
.myCard {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}
```

---

## Accent Colors

The primary accent is `--tint` (blue by default). Some apps override this with a custom accent using inline `style`:

```tsx
<div style={{ '--tint': '#ff9500', '--tint-rgb': '255, 149, 0' }}>
  {/* All children using --tint will be orange */}
</div>
```

---

## Scoping Styles Per App

Each app's styles are automatically scoped via CSS Modules. For app-wide overrides, wrap in a container class:

```scss
// NotesApp.module.scss
.notesApp {
  .ios-row {
    min-height: 64px;
  }
}
```

```tsx
<AppScaffold title="Notes">
  <div class={styles.notesApp}>
    {/* ios-row here gets 64px min-height */}
  </div>
</AppScaffold>
```

---

## Important Restrictions

**Never use `backdrop-filter: blur()`**. FiveM's NUI (CEF) does not support it. Use solid or semi-transparent backgrounds instead:

```scss
// BAD -- will not render in FiveM
.overlay {
  backdrop-filter: blur(20px);
}

// GOOD
.overlay {
  background: rgba(var(--surface-rgb), 0.94);
}
```
