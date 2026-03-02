# TODO Tomorrow - gcphone-next

## High Priority

- [ ] Full Lua audit: naming, guard clauses, callback consistency, exports cleanup.
- [x] Add SQL triggers/migrations to reduce manual counter updates in Lua modules.
- [x] Review and fix all self-resource export patterns and legacy callbacks.

## UI / UX (iOS 18 style)

- [x] Unify palette/tokens across all apps (reduce saturation, premium iOS feel).
- [x] Final pass on WaveChat and Chirp complete redesign.
- [x] Snap creation flow polish (camera-first, story/post/live clear actions).
- [x] Contactos/Llamadas/Mensajes consistency pass (icons, tabs, actions).
- [x] Add missing motion system (spring transitions, staggered cards, sheet gestures).

## System Surfaces

- [x] Notification Center: app icons, timestamps, grouped summaries, compact mode.
- [x] Control Center: tile resize behavior and reorder presets.
- [x] Settings sync for all quick controls (airplane, dnd, data, silent, rotation, brightness, volume).

## Camera App

- [x] Create dedicated Camera app route and UI.
- [x] Add FOV controls and filter presets (normal/noir/vivid/warm).
- [x] Camera preview controls and capture UX polish.

## Media and Social

- [ ] Unified full-screen media viewer in all media apps.
- [ ] Chirp: video handling and richer composer.
- [ ] Snap: image/video zoom, swipe stories, viewer actions.

## Technical / QA

- [x] Expand Playwright coverage for drag gestures and control surfaces.
- [x] Add regression checks for desktop persistence and multitasking lifecycle.
- [x] Verify no `backdrop-filter` dependency for critical visibility in FiveM.

https://www.figma.com/design/Y2eulsqaXnixweHCIflm1b/iOS-18-and-iPadOS-18--Community-?node-id=221-56229&p=f&t=1omqmlY5ITFsd3fl-0

```css
/* ios18.css — iOS 18-ish UI Kit (web) — components-heavy
   Notes:
   - Not Apple official. iOS-like tokens + a11y-first.
   - Works great with SolidJS (or any framework).
*/

:root {
  color-scheme: light dark;

  --font-sans:
    ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', 'SF Pro Display',
    'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
  --font-mono:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;

  --text-scale: 1;

  --fs-caption2: calc(0.6875rem * var(--text-scale));
  --fs-caption1: calc(0.75rem * var(--text-scale));
  --fs-footnote: calc(0.8125rem * var(--text-scale));
  --fs-subhead: calc(0.9375rem * var(--text-scale));
  --fs-body: calc(1rem * var(--text-scale));
  --fs-callout: calc(1.0625rem * var(--text-scale));
  --fs-headline: calc(1.0625rem * var(--text-scale));
  --fs-title3: calc(1.25rem * var(--text-scale));
  --fs-title2: calc(1.375rem * var(--text-scale));
  --fs-title1: calc(1.75rem * var(--text-scale));
  --fs-large: calc(2.125rem * var(--text-scale));

  --lh-tight: 1.15;
  --lh-normal: 1.35;
  --lh-relaxed: 1.55;

  --r-2xs: 6px;
  --r-xs: 8px;
  --r-sm: 10px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;
  --r-2xl: 26px;
  --r-pill: 999px;

  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 20px;
  --s-6: 24px;
  --s-7: 28px;
  --s-8: 32px;
  --s-9: 40px;
  --s-10: 48px;

  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.08);
  --shadow-2: 0 6px 18px rgba(0, 0, 0, 0.12);
  --shadow-3: 0 14px 34px rgba(0, 0, 0, 0.18);

  --blur-1: 12px;
  --blur-2: 24px;
  --blur-3: 40px;

  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-inout: cubic-bezier(0.25, 0.1, 0.25, 1);
  --dur-1: 120ms;
  --dur-2: 180ms;
  --dur-3: 260ms;

  --safe-t: env(safe-area-inset-top, 0px);
  --safe-r: env(safe-area-inset-right, 0px);
  --safe-b: env(safe-area-inset-bottom, 0px);
  --safe-l: env(safe-area-inset-left, 0px);

  /* Light tokens */
  --bg: #f2f2f7;
  --surface: #ffffff;
  --surface-2: #f7f7fa;
  --surface-3: #efeff4;

  --text: #111111;
  --text-2: rgba(17, 17, 17, 0.72);
  --text-3: rgba(17, 17, 17, 0.52);

  --border: rgba(0, 0, 0, 0.12);
  --separator: rgba(0, 0, 0, 0.1);

  --tint: #007aff;
  --tint-2: #0a84ff;
  --danger: #ff3b30;
  --success: #34c759;
  --warning: #ff9500;

  --focus: rgba(0, 122, 255, 0.35);

  --kbd: rgba(0, 0, 0, 0.08);
  --kbd-border: rgba(0, 0, 0, 0.14);

  --selection: rgba(0, 122, 255, 0.18);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;
    --surface: #1c1c1e;
    --surface-2: #2c2c2e;
    --surface-3: #3a3a3c;

    --text: #ffffff;
    --text-2: rgba(255, 255, 255, 0.72);
    --text-3: rgba(255, 255, 255, 0.52);

    --border: rgba(255, 255, 255, 0.14);
    --separator: rgba(255, 255, 255, 0.12);

    --tint: #0a84ff;
    --tint-2: #64d2ff;

    --focus: rgba(10, 132, 255, 0.42);

    --kbd: rgba(255, 255, 255, 0.1);
    --kbd-border: rgba(255, 255, 255, 0.14);

    --selection: rgba(10, 132, 255, 0.26);
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-1: 0ms;
    --dur-2: 0ms;
    --dur-3: 0ms;
  }
}

* {
  box-sizing: border-box;
}
html,
body {
  height: 100%;
}
body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
::selection {
  background: var(--selection);
}
a {
  color: var(--tint);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}

/* Layout helpers */
.ios18-container {
  padding: calc(var(--s-6) + var(--safe-t)) calc(var(--s-6) + var(--safe-r))
    calc(var(--s-6) + var(--safe-b)) calc(var(--s-6) + var(--safe-l));
}
.ios18-stack {
  display: grid;
  gap: var(--s-4);
}
.ios18-row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.ios18-row--between {
  justify-content: space-between;
}
.ios18-wrap {
  flex-wrap: wrap;
}
.ios18-grow {
  flex: 1 1 auto;
  min-width: 0;
}
.ios18-center {
  display: grid;
  place-items: center;
}
.ios18-hidden {
  display: none !important;
}

/* Typography */
.ios18-h1 {
  font-size: var(--fs-title1);
  line-height: var(--lh-tight);
  margin: 0 0 var(--s-4);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.ios18-h2 {
  font-size: var(--fs-title2);
  line-height: var(--lh-tight);
  margin: 0 0 var(--s-3);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.ios18-h3 {
  font-size: var(--fs-title3);
  line-height: var(--lh-tight);
  margin: 0 0 var(--s-2);
  font-weight: 700;
  letter-spacing: -0.01em;
}
.ios18-headline {
  font-size: var(--fs-headline);
  line-height: var(--lh-normal);
  font-weight: 600;
  margin: 0;
}
.ios18-body {
  font-size: var(--fs-body);
  line-height: var(--lh-relaxed);
  color: var(--text-2);
  margin: 0;
}
.ios18-callout {
  font-size: var(--fs-callout);
  line-height: var(--lh-relaxed);
  color: var(--text-2);
  margin: 0;
}
.ios18-footnote {
  font-size: var(--fs-footnote);
  line-height: var(--lh-normal);
  color: var(--text-3);
}
.ios18-caption {
  font-size: var(--fs-caption1);
  line-height: var(--lh-normal);
  color: var(--text-3);
}
.ios18-mono {
  font-family: var(--font-mono);
}

/* Surfaces */
.ios18-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-1);
  padding: var(--s-5);
}
.ios18-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-2);
  padding: var(--s-6);
}
.ios18-divider {
  height: 1px;
  background: var(--separator);
  border: 0;
  margin: var(--s-4) 0;
}
.ios18-inset {
  padding: var(--s-4);
  border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--surface) 70%, var(--bg));
  border: 1px solid var(--border);
}

/* Materials (blur) */
.ios18-material {
  background: color-mix(in srgb, var(--surface) 78%, transparent);

  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
}
.ios18-material--thin {
  background: color-mix(in srgb, var(--surface) 66%, transparent);
}
.ios18-material--thick {
  background: color-mix(in srgb, var(--surface) 86%, transparent);
}

/* Buttons */
.ios18-btn {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: var(--r-pill);
  padding: 12px 16px;
  min-height: 44px;
  font-size: var(--fs-body);
  line-height: var(--lh-tight);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition:
    transform var(--dur-1) var(--ease-standard),
    background var(--dur-2) var(--ease-standard),
    border-color var(--dur-2) var(--ease-standard),
    opacity var(--dur-2) var(--ease-standard),
    box-shadow var(--dur-2) var(--ease-standard);
}
.ios18-btn:hover {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--tint) 10%, transparent);
}
.ios18-btn:active {
  transform: scale(0.98);
}
.ios18-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.ios18-btn--primary {
  background: var(--tint);
  border-color: rgba(0, 0, 0, 0);
  color: #fff;
}
.ios18-btn--primary:hover {
  background: color-mix(in srgb, var(--tint) 92%, black);
}

.ios18-btn--danger {
  background: var(--danger);
  border-color: rgba(0, 0, 0, 0);
  color: #fff;
}
.ios18-btn--danger:hover {
  background: color-mix(in srgb, var(--danger) 92%, black);
}

.ios18-btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--tint);
}
.ios18-btn--ghost:hover {
  background: color-mix(in srgb, var(--tint) 10%, transparent);
}

.ios18-btn--secondary {
  background: var(--surface-2);
  border-color: var(--border);
}
.ios18-btn--secondary:hover {
  background: color-mix(in srgb, var(--surface-2) 92%, black);
}

.ios18-btn--pill {
  border-radius: var(--r-pill);
}
.ios18-btn--square {
  border-radius: var(--r-md);
}
.ios18-btn--sm {
  min-height: 36px;
  padding: 8px 12px;
  font-size: var(--fs-footnote);
}
.ios18-btn--lg {
  min-height: 52px;
  padding: 14px 18px;
  font-size: var(--fs-callout);
}
.ios18-btn__icon {
  width: 18px;
  height: 18px;
  display: inline-block;
}

/* Button group */
.ios18-btngroup {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  overflow: hidden;
  background: var(--surface);
}
.ios18-btngroup > .ios18-btn {
  border: 0;
  border-radius: 0;
}
.ios18-btngroup > .ios18-btn + .ios18-btn {
  border-left: 1px solid var(--separator);
}

/* Badges / Tags */
.ios18-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: var(--r-pill);
  background: rgba(120, 120, 128, 0.16);
  color: var(--text-2);
  font-size: var(--fs-caption1);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
.ios18-badge--tint {
  background: color-mix(in srgb, var(--tint) 18%, transparent);
  border-color: color-mix(in srgb, var(--tint) 20%, transparent);
  color: var(--tint);
}
.ios18-badge--danger {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
  border-color: color-mix(in srgb, var(--danger) 20%, transparent);
  color: var(--danger);
}
.ios18-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: var(--fs-footnote);
}
.ios18-chip__x {
  width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  border-radius: var(--r-pill);
  background: rgba(120, 120, 128, 0.16);
}

/* Inputs / Forms */
.ios18-field {
  display: grid;
  gap: var(--s-2);
}
.ios18-label {
  font-size: var(--fs-footnote);
  color: var(--text-2);
}
.ios18-help {
  font-size: var(--fs-footnote);
  color: var(--text-3);
}
.ios18-error {
  font-size: var(--fs-footnote);
  color: var(--danger);
}

.ios18-input,
.ios18-textarea,
.ios18-select {
  width: 100%;
  min-height: 44px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  padding: 10px 12px;
  font-size: var(--fs-body);
  outline: none;
  transition:
    border-color var(--dur-2) var(--ease-standard),
    box-shadow var(--dur-2) var(--ease-standard),
    background var(--dur-2) var(--ease-standard);
}
.ios18-input::placeholder,
.ios18-textarea::placeholder {
  color: var(--text-3);
}

.ios18-input:focus,
.ios18-textarea:focus,
.ios18-select:focus {
  border-color: color-mix(in srgb, var(--tint) 60%, var(--border));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--tint) 18%, transparent);
}
.ios18-textarea {
  min-height: 96px;
  resize: vertical;
}
.ios18-select {
  padding-right: 36px;
}

/* Input group */
.ios18-inputgroup {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--r-md);
  overflow: hidden;
}
.ios18-inputgroup > .ios18-input {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.ios18-inputgroup__addon {
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  color: var(--text-3);
  border-left: 1px solid var(--separator);
  background: color-mix(in srgb, var(--surface) 80%, var(--bg));
}

/* Search field */
.ios18-search {
  position: relative;
}
.ios18-search .ios18-input {
  padding-left: 40px;
  border-radius: var(--r-pill);
}
.ios18-search__icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  opacity: 0.6;
}

/* Checkbox / Radio (native but styled wrapper) */
.ios18-check {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}
.ios18-check input {
  width: 20px;
  height: 20px;
  accent-color: var(--tint);
}
.ios18-check__text {
  display: grid;
  gap: 2px;
}
.ios18-check__title {
  font-size: var(--fs-body);
  color: var(--text);
}
.ios18-check__desc {
  font-size: var(--fs-footnote);
  color: var(--text-3);
}

/* Switch (role="switch" aria-checked="true/false") */
.ios18-switch {
  position: relative;
  width: 52px;
  height: 32px;
  border-radius: var(--r-pill);
  background: rgba(120, 120, 128, 0.16);
  border: 1px solid var(--border);
  transition:
    background var(--dur-2) var(--ease-standard),
    border-color var(--dur-2) var(--ease-standard),
    opacity var(--dur-2) var(--ease-standard);
  flex: 0 0 auto;
}
.ios18-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 28px;
  height: 28px;
  border-radius: var(--r-pill);
  background: #fff;
  box-shadow: var(--shadow-1);
  transition: transform var(--dur-2) var(--ease-standard);
}
.ios18-switch[aria-checked='true'] {
  background: var(--success);
  border-color: rgba(0, 0, 0, 0);
}
.ios18-switch[aria-checked='true'] .ios18-switch__thumb {
  transform: translateX(20px);
}
.ios18-switch[aria-disabled='true'] {
  opacity: 0.45;
}

/* Segmented control */
.ios18-seg {
  display: inline-flex;
  background: rgba(120, 120, 128, 0.16);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  padding: 2px;
  min-height: 38px;
}
.ios18-seg__btn {
  border: 0;
  background: transparent;
  color: var(--text);
  padding: 8px 12px;
  border-radius: var(--r-pill);
  font-size: var(--fs-footnote);
  cursor: pointer;
  transition:
    background var(--dur-2) var(--ease-standard),
    box-shadow var(--dur-2) var(--ease-standard),
    color var(--dur-2) var(--ease-standard);
}
.ios18-seg__btn[aria-pressed='true'] {
  background: var(--surface);
  box-shadow: var(--shadow-1);
}

/* Progress */
.ios18-progress {
  width: 100%;
  height: 6px;
  border-radius: var(--r-pill);
  background: rgba(120, 120, 128, 0.16);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
}
.ios18-progress__bar {
  height: 100%;
  width: 0%;
  background: var(--tint);
  border-radius: var(--r-pill);
  transition: width var(--dur-3) var(--ease-standard);
}

/* Spinner */
.ios18-spinner {
  width: 18px;
  height: 18px;
  border-radius: var(--r-pill);
  border: 2px solid color-mix(in srgb, var(--tint) 30%, transparent);
  border-top-color: var(--tint);
  animation: ios18-spin 800ms linear infinite;
}
@keyframes ios18-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Toast */
.ios18-toastwrap {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--s-6) + var(--safe-b));
  display: grid;
  gap: 10px;
  z-index: 60;
  pointer-events: none;
}
.ios18-toast {
  pointer-events: auto;
  max-width: min(520px, calc(100vw - 24px));
  padding: 12px 14px;
  border-radius: var(--r-lg);
  color: var(--text);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-2);
}
.ios18-toast--success {
  border-color: color-mix(in srgb, var(--success) 35%, var(--border));
}
.ios18-toast--danger {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
}
.ios18-toast--warning {
  border-color: color-mix(in srgb, var(--warning) 35%, var(--border));
}

/* Tooltip */
.ios18-tooltip {
  position: absolute;
  z-index: 70;
  padding: 8px 10px;
  border-radius: var(--r-md);
  font-size: var(--fs-footnote);
  color: var(--text);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-2);
}

/* Lists / Settings cells */
.ios18-list {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: clip;
}
.ios18-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: 12px 14px;
  min-height: 44px;
  border-top: 1px solid var(--separator);
}
.ios18-cell:first-child {
  border-top: 0;
}
.ios18-cell--pressable {
  cursor: pointer;
}
.ios18-cell--pressable:active {
  background: color-mix(in srgb, var(--surface) 75%, var(--bg));
}
.ios18-cell__left {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 0;
}
.ios18-cell__icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: rgba(120, 120, 128, 0.16);
  color: var(--text);
  flex: 0 0 auto;
}
.ios18-cell__title {
  font-size: var(--fs-body);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ios18-cell__subtitle {
  font-size: var(--fs-footnote);
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ios18-cell__right {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  color: var(--text-3);
  flex: 0 0 auto;
}
.ios18-chevron {
  width: 10px;
  height: 10px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
  opacity: 0.7;
}

/* Table (simple) */
.ios18-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.ios18-table th,
.ios18-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--separator);
  text-align: left;
}
.ios18-table th {
  font-size: var(--fs-footnote);
  color: var(--text-2);
  background: color-mix(in srgb, var(--surface) 78%, var(--bg));
}
.ios18-table tr:last-child td {
  border-bottom: 0;
}

/* Tabs (top tabs) */
.ios18-tabs {
  display: flex;
  gap: 8px;
  padding: 4px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: rgba(120, 120, 128, 0.16);
}
.ios18-tab {
  border: 0;
  background: transparent;
  color: var(--text-2);
  min-height: 38px;
  padding: 8px 12px;
  border-radius: var(--r-pill);
  cursor: pointer;
}
.ios18-tab[aria-selected='true'] {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-1);
}

/* Navbar / Toolbar */
.ios18-navbar {
  position: sticky;
  top: 0;
  padding-top: var(--safe-t);
  z-index: 40;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  border-bottom: 1px solid var(--separator);
}
.ios18-navbar__row {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: 0 var(--s-4);
}
.ios18-navbar__title {
  font-size: var(--fs-headline);
  font-weight: 600;
}
.ios18-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: 10px var(--s-4);
  border-top: 1px solid var(--separator);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
}

/* Tabbar */
.ios18-tabbar {
  position: sticky;
  bottom: 0;
  padding-bottom: var(--safe-b);
  z-index: 40;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  border-top: 1px solid var(--separator);
}
.ios18-tabbar__row {
  height: 49px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 6px;
  padding: 0 var(--s-2);
}
.ios18-tabbar__item {
  min-width: 64px;
  height: 44px;
  border-radius: var(--r-md);
  display: grid;
  place-items: center;
  color: var(--text-3);
  cursor: pointer;
}
.ios18-tabbar__item[aria-current='page'] {
  color: var(--tint);
}
.ios18-tabbar__item:active {
  background: color-mix(in srgb, var(--tint) 10%, transparent);
}

/* Sheet / Modal / Dialog */
.ios18-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 80;
}
.ios18-sheetwrap {
  position: fixed;
  inset: 0;
  display: grid;
  align-items: end;
  padding: var(--s-4);
  z-index: 90;
}
.ios18-sheet {
  background: var(--surface);
  border-radius: var(--r-2xl);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-3);
  padding: var(--s-4);
  max-height: min(80vh, 720px);
  overflow: auto;
}
.ios18-grabber {
  width: 48px;
  height: 5px;
  border-radius: var(--r-pill);
  background: rgba(120, 120, 128, 0.35);
  margin: 0 auto var(--s-3);
}
.ios18-dialogwrap {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--s-4);
  z-index: 90;
}
.ios18-dialog {
  width: min(520px, calc(100vw - 24px));
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-2xl);
  box-shadow: var(--shadow-3);
  overflow: hidden;
}
.ios18-dialog__body {
  padding: var(--s-5);
}
.ios18-dialog__footer {
  display: flex;
  gap: 10px;
  padding: var(--s-4);
  border-top: 1px solid var(--separator);
  background: color-mix(in srgb, var(--surface) 80%, var(--bg));
}
.ios18-dialog__footer .ios18-btn {
  flex: 1 1 0;
}

/* Popover */
.ios18-popover {
  position: absolute;
  z-index: 90;
  min-width: 220px;
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 84%, transparent);
  box-shadow: var(--shadow-3);

  overflow: clip;
}
.ios18-popover__item {
  padding: 12px 14px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--separator);
  cursor: pointer;
}
.ios18-popover__item:first-child {
  border-top: 0;
}
.ios18-popover__item:active {
  background: color-mix(in srgb, var(--surface) 75%, var(--bg));
}

/* Menu (context menu-ish) */
.ios18-menu {
  display: grid;
  gap: 0;
}
.ios18-menu__label {
  padding: 10px 14px;
  font-size: var(--fs-footnote);
  color: var(--text-3);
  background: color-mix(in srgb, var(--surface) 78%, var(--bg));
  border-bottom: 1px solid var(--separator);
}

/* Alerts (inline) */
.ios18-alert {
  padding: 12px 14px;
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 75%, var(--bg));
  color: var(--text);
}
.ios18-alert--success {
  border-color: color-mix(in srgb, var(--success) 40%, var(--border));
  background: color-mix(in srgb, var(--success) 12%, var(--surface));
}
.ios18-alert--danger {
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
  background: color-mix(in srgb, var(--danger) 12%, var(--surface));
}
.ios18-alert--warning {
  border-color: color-mix(in srgb, var(--warning) 40%, var(--border));
  background: color-mix(in srgb, var(--warning) 12%, var(--surface));
}

/* Avatar */
.ios18-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--r-pill);
  background: rgba(120, 120, 128, 0.16);
  border: 1px solid var(--border);
  overflow: hidden;
  display: grid;
  place-items: center;
}
.ios18-avatar--sm {
  width: 32px;
  height: 32px;
}
.ios18-avatar--lg {
  width: 56px;
  height: 56px;
}

/* Skeleton */
.ios18-skel {
  border-radius: var(--r-sm);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--surface) 70%, var(--bg)) 0%,
    color-mix(in srgb, var(--surface) 92%, var(--bg)) 50%,
    color-mix(in srgb, var(--surface) 70%, var(--bg)) 100%
  );
  background-size: 200% 100%;
  animation: ios18-skel 1200ms var(--ease-inout) infinite;
}
@keyframes ios18-skel {
  to {
    background-position: -200% 0;
  }
}

/* Code / kbd */
.ios18-code {
  font-family: var(--font-mono);
  font-size: var(--fs-footnote);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  background: rgba(120, 120, 128, 0.16);
  border: 1px solid var(--border);
}
.ios18-kbd {
  font-family: var(--font-mono);
  font-size: var(--fs-footnote);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  background: var(--kbd);
  border: 1px solid var(--kbd-border);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
}

/* Disclosure / accordion */
.ios18-acc {
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  background: var(--surface);
  overflow: clip;
}
.ios18-acc__btn {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  padding: 12px 14px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}
.ios18-acc__panel {
  border-top: 1px solid var(--separator);
  padding: 12px 14px;
  color: var(--text-2);
}

/* Slider (native input range, iOS-ish) */
.ios18-slider {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
}
.ios18-slider input[type='range'] {
  width: 100%;
  accent-color: var(--tint);
}

/* Pagination */
.ios18-pager {
  display: flex;
  gap: 8px;
  align-items: center;
}
.ios18-page {
  min-width: 38px;
  height: 38px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--text);
}
.ios18-page[aria-current='page'] {
  background: color-mix(in srgb, var(--tint) 16%, var(--surface));
  border-color: color-mix(in srgb, var(--tint) 25%, var(--border));
  color: var(--tint);
}

/* Dropzone */
.ios18-drop {
  border: 1px dashed color-mix(in srgb, var(--border) 90%, transparent);
  border-radius: var(--r-lg);
  padding: var(--s-6);
  background: color-mix(in srgb, var(--surface) 65%, var(--bg));
  color: var(--text-2);
  text-align: center;
}
.ios18-drop[aria-busy='true'] {
  opacity: 0.7;
}

/* Empty state */
.ios18-empty {
  text-align: center;
  padding: var(--s-8) var(--s-6);
  color: var(--text-3);
}
.ios18-empty__icon {
  width: 56px;
  height: 56px;
  margin: 0 auto var(--s-3);
  border-radius: 16px;
  background: rgba(120, 120, 128, 0.16);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
  color: var(--text);
}

/* Utility: visually hidden */
.ios18-sr {
  position: absolute !important;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Optional: high-contrast override via attribute */
:root[data-contrast='increased'] {
  --border: color-mix(in srgb, var(--border) 55%, var(--text));
  --separator: color-mix(in srgb, var(--separator) 45%, var(--text));
}
```
