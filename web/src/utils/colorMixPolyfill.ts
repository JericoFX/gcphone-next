/**
 * Runtime polyfill for CSS color-mix().
 *
 * FiveM NUI may use Chromium < 111 which does not support color-mix().
 * This polyfill detects the issue and injects a stylesheet that replaces
 * the most critical color-mix patterns with static fallback values.
 *
 * This is NOT a full polyfill — it only covers the patterns used in
 * gcphone's theme system (--tint, --surface, --bg, etc.).
 */

function supportsColorMix(): boolean {
  try {
    return CSS.supports('color', 'color-mix(in srgb, red 50%, blue)');
  } catch {
    return false;
  }
}

const FALLBACK_CSS = `
/* color-mix() polyfill fallback — injected at runtime */

/* ── Tint variants ── */
:root, .gcphone-app {
  --tint-hover: #006ae6;
  --tint-12: rgba(0, 122, 255, 0.12);
  --tint-18: rgba(0, 122, 255, 0.18);
  --tint-20: rgba(0, 122, 255, 0.20);
  --tint-30: rgba(0, 122, 255, 0.30);
  --tint-60: rgba(0, 122, 255, 0.60);
  --tint-88: rgba(0, 122, 255, 0.88);
  --color-primary-dark: #0060cc;
}

.gcphone-app.theme-dark, [data-theme="dark"] {
  --tint-hover: #0975d9;
  --tint-12: rgba(10, 132, 255, 0.12);
  --tint-18: rgba(10, 132, 255, 0.18);
  --tint-20: rgba(10, 132, 255, 0.20);
  --tint-30: rgba(10, 132, 255, 0.30);
  --tint-60: rgba(10, 132, 255, 0.60);
  --tint-88: rgba(10, 132, 255, 0.88);
  --color-primary-dark: #0660cc;
}

/* ── Surface mix fallbacks ── */
:root, .gcphone-app {
  --surface-72-bg: rgba(242, 242, 247, 0.72);
  --surface-70-bg: rgba(242, 242, 247, 0.70);
  --surface-92-bg: rgba(242, 242, 247, 0.92);
}

.gcphone-app.theme-dark, [data-theme="dark"] {
  --surface-72-bg: rgba(28, 28, 30, 0.72);
  --surface-70-bg: rgba(28, 28, 30, 0.70);
  --surface-92-bg: rgba(28, 28, 30, 0.92);
}

/* ── Common overrides for elements using color-mix ── */

/* Buttons - hover state */
button:hover {
  filter: brightness(0.92);
}

/* Toggle switches */
input[type="checkbox"]:checked + *,
[class*="toggle"][class*="active"],
[class*="Toggle"][class*="active"] {
  opacity: 1;
}

/* Borders with tint mix */
[class*="focused"], [class*="focus"] {
  border-color: rgba(0, 122, 255, 0.6) !important;
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.18) !important;
}

/* Action sheet / modal backdrops */
[class*="overlay"], [class*="Overlay"] {
  background-color: rgba(0, 0, 0, 0.5) !important;
}

/* Segment tabs */
[class*="segment"][class*="active"], [class*="Segment"][class*="active"] {
  background-color: rgba(0, 122, 255, 0.12);
}

/* Notice / inline banners */
[class*="notice"], [class*="Notice"] {
  background-color: rgba(0, 122, 255, 0.08);
  border-color: rgba(0, 122, 255, 0.2);
}
`;

export function installColorMixPolyfill(): void {
  if (supportsColorMix()) return;

  console.warn('[gcphone] color-mix() not supported — injecting polyfill fallback');

  const style = document.createElement('style');
  style.id = 'gcphone-color-mix-polyfill';
  style.textContent = FALLBACK_CSS;
  document.head.appendChild(style);
}
