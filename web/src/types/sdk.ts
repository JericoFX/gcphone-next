// Phone UI SDK — Shared TypeScript types

// ── Element types ──

export interface SDKElementBase {
  type: string;
  id?: string;
  label?: string;
}

export interface SDKInputElement extends SDKElementBase {
  type: 'input';
  id: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
  default?: string;
  required?: boolean;
}

export interface SDKNumberElement extends SDKElementBase {
  type: 'number';
  id: string;
  label: string;
  placeholder?: string;
  min?: number;
  max?: number;
  default?: number;
  required?: boolean;
}

export interface SDKTextareaElement extends SDKElementBase {
  type: 'textarea';
  id: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  default?: string;
}

export interface SDKSelectOption {
  value: string;
  label: string;
}

export interface SDKSelectElement extends SDKElementBase {
  type: 'select';
  id: string;
  label: string;
  options: SDKSelectOption[];
  default?: string;
  required?: boolean;
}

export interface SDKCheckboxElement extends SDKElementBase {
  type: 'checkbox';
  id: string;
  label: string;
  default?: boolean;
}

export interface SDKHeaderElement extends SDKElementBase {
  type: 'header';
  text: string;
}

export interface SDKLabelElement extends SDKElementBase {
  type: 'label';
  text: string;
  tone?: 'default' | 'muted' | 'danger';
}

export interface SDKDividerElement extends SDKElementBase {
  type: 'divider';
}

export interface SDKImageElement extends SDKElementBase {
  type: 'image';
  url: string;
  height?: number;
}

export interface SDKListItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  tone?: 'default' | 'primary' | 'danger';
  navigateTo?: string;
  disabled?: boolean;
}

export interface SDKListElement extends SDKElementBase {
  type: 'list';
  id: string;
  items: SDKListItem[];
}

export type SDKElement =
  | SDKInputElement
  | SDKNumberElement
  | SDKTextareaElement
  | SDKSelectElement
  | SDKCheckboxElement
  | SDKHeaderElement
  | SDKLabelElement
  | SDKDividerElement
  | SDKImageElement
  | SDKListElement;

// ── Action buttons ──

export interface SDKOption {
  id: string;
  label: string;
  tone?: 'default' | 'primary' | 'danger';
  navigateTo?: string;
}

// ── View ──

export interface SDKView {
  title?: string;
  elements: SDKElement[];
  options?: SDKOption[];
}

// ── Modal payload (sent from Lua to NUI) ──

export type SDKModalMode = 'input' | 'confirm' | 'select' | 'registered';

export interface SDKModalPayload {
  requestId: string;
  mode: SDKModalMode;
  title: string;
  icon?: string;
  resourceName?: string;

  // For 'input' mode
  elements?: SDKElement[];
  submitLabel?: string;
  submitTone?: 'default' | 'primary' | 'danger';
  cancelLabel?: string;

  // For 'confirm' mode
  description?: string;
  confirmLabel?: string;
  confirmTone?: 'default' | 'primary' | 'danger';

  // For 'select' mode
  items?: SDKListItem[];
  searchable?: boolean;

  // For 'registered' mode
  views?: Record<string, SDKView>;
  startView?: string;
  options?: SDKOption[];
}

// ── Result (sent from NUI back to Lua) ──

export interface SDKModalResult {
  requestId: string;
  cancelled: boolean;
  optionId?: string;
  selectedId?: string;
  confirmed?: boolean;
  view?: string;
  formData?: Record<string, string | number | boolean>;
  error?: string;
}
