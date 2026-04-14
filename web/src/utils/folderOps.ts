import type { AppLayout } from '../types';
import {
  ALLOWED_FOLDER_COLORS,
  DEFAULT_FOLDER_COLOR,
  FOLDER_ID_RE,
  FOLDER_NAME_RE,
  MAX_APPS_PER_FOLDER,
  MAX_FOLDERS,
  PINNED_APP_IDS,
  type AllowedFolderColor,
  type Folder,
} from '../types/home';

export type OpError =
  | 'read_only'
  | 'invalid_name'
  | 'invalid_color'
  | 'invalid_app'
  | 'invalid_folder'
  | 'pinned_app'
  | 'folder_full'
  | 'too_many_folders'
  | 'duplicate'
  | 'not_found';

export type OpResult = { ok: true; layout: AppLayout } | { ok: false; reason: OpError };

const COLOR_SET: ReadonlySet<string> = new Set(ALLOWED_FOLDER_COLORS);
const PINNED_SET: ReadonlySet<string> = new Set(PINNED_APP_IDS);
const FOLDER_REF_PREFIX = 'folder:';

export function validateFolderName(raw: unknown): { ok: true; value: string } | { ok: false } {
  if (typeof raw !== 'string') return { ok: false };
  const trimmed = raw.trim();
  if (!FOLDER_NAME_RE.test(trimmed)) return { ok: false };
  return { ok: true, value: trimmed };
}

export function validateFolderColor(raw: unknown): AllowedFolderColor | null {
  if (typeof raw !== 'string') return null;
  return COLOR_SET.has(raw) ? (raw as AllowedFolderColor) : null;
}

export function validateFolderId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return FOLDER_ID_RE.test(raw) ? raw : null;
}

export function genFolderId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'folder_';
  const bytes = new Uint8Array(10);
  (globalThis.crypto ?? window.crypto).getRandomValues(bytes);
  for (let i = 0; i < 10; i++) id += alphabet[bytes[i] % alphabet.length];
  return id;
}

function isFolderRef(id: string): boolean {
  if (!id.startsWith(FOLDER_REF_PREFIX)) return false;
  return FOLDER_ID_RE.test(id.slice(FOLDER_REF_PREFIX.length));
}

function folderRefId(ref: string): string {
  return ref.slice(FOLDER_REF_PREFIX.length);
}

export interface NormalizeContext {
  allowedAppIds: ReadonlySet<string>;
  enabledAppIds: ReadonlySet<string>;
  defaultHomeIds: readonly string[];
  pinnedHomeIds: readonly string[];
}

export function normalizeLayout(layout: Partial<AppLayout> | null | undefined, ctx: NormalizeContext): AppLayout {
  const rawFolders = Array.isArray(layout?.folders) ? layout!.folders! : [];
  const rawHome = Array.isArray(layout?.home) ? layout!.home! : [];
  const rawMenu = Array.isArray(layout?.menu) ? layout!.menu! : [];

  const folders: Folder[] = [];
  const foldersById = new Map<string, Folder>();
  const usedApps = new Set<string>();

  for (const f of rawFolders) {
    if (folders.length >= MAX_FOLDERS) break;
    if (!f || typeof f !== 'object') continue;
    const id = validateFolderId((f as Folder).id);
    if (!id || foldersById.has(id)) continue;
    const nameCheck = validateFolderName((f as Folder).name);
    const name = nameCheck.ok ? nameCheck.value : 'Folder';
    const color = validateFolderColor((f as Folder).color) ?? DEFAULT_FOLDER_COLOR;

    const apps: string[] = [];
    const seen = new Set<string>();
    const rawApps = Array.isArray((f as Folder).apps) ? (f as Folder).apps : [];
    for (const appId of rawApps) {
      if (typeof appId !== 'string') continue;
      if (apps.length >= MAX_APPS_PER_FOLDER) break;
      if (seen.has(appId) || usedApps.has(appId)) continue;
      if (!ctx.allowedAppIds.has(appId)) continue;
      if (!ctx.enabledAppIds.has(appId)) continue;
      if (PINNED_SET.has(appId)) continue;
      apps.push(appId);
      seen.add(appId);
      usedApps.add(appId);
    }

    if (apps.length === 0) continue;
    const folder: Folder = { id, name, color, apps };
    folders.push(folder);
    foldersById.set(id, folder);
  }

  const home: string[] = [];
  const menu: string[] = [];
  const homeSeen = new Set<string>();

  for (const entry of rawHome) {
    if (typeof entry !== 'string' || homeSeen.has(entry)) continue;
    if (entry.startsWith(FOLDER_REF_PREFIX)) {
      if (!isFolderRef(entry)) continue;
      if (!foldersById.has(folderRefId(entry))) continue;
      home.push(entry);
      homeSeen.add(entry);
      continue;
    }
    if (!ctx.allowedAppIds.has(entry)) continue;
    if (!ctx.enabledAppIds.has(entry)) continue;
    if (usedApps.has(entry)) continue;
    home.push(entry);
    homeSeen.add(entry);
    usedApps.add(entry);
  }

  for (const folder of folders) {
    const ref = FOLDER_REF_PREFIX + folder.id;
    if (!homeSeen.has(ref)) {
      home.push(ref);
      homeSeen.add(ref);
    }
  }

  for (const entry of rawMenu) {
    if (typeof entry !== 'string') continue;
    if (!ctx.allowedAppIds.has(entry)) continue;
    if (!ctx.enabledAppIds.has(entry)) continue;
    if (usedApps.has(entry)) continue;
    menu.push(entry);
    usedApps.add(entry);
  }

  for (const appId of ctx.allowedAppIds) {
    if (!ctx.enabledAppIds.has(appId)) continue;
    if (usedApps.has(appId)) continue;
    if (ctx.defaultHomeIds.includes(appId)) home.push(appId);
    else menu.push(appId);
    usedApps.add(appId);
  }

  const pinnedHome = ctx.pinnedHomeIds.filter((id) => ctx.enabledAppIds.has(id));
  const pinnedSet = new Set<string>(pinnedHome);
  const orderedHome = [...pinnedHome, ...home.filter((id) => !pinnedSet.has(id))];
  const filteredMenu = menu.filter((id) => !pinnedSet.has(id));

  return { home: orderedHome, menu: filteredMenu, folders };
}

function clone(layout: AppLayout): AppLayout {
  return {
    home: [...layout.home],
    menu: [...layout.menu],
    folders: (layout.folders ?? []).map((f) => ({ ...f, apps: [...f.apps] })),
  };
}

function removeFromHome(layout: AppLayout, id: string): void {
  const idx = layout.home.indexOf(id);
  if (idx >= 0) layout.home.splice(idx, 1);
}

function findFolder(layout: AppLayout, folderId: string): Folder | null {
  const list = layout.folders ?? [];
  for (const f of list) if (f.id === folderId) return f;
  return null;
}

export function createFolderFromMerge(
  layout: AppLayout,
  draggedAppId: string,
  targetAppId: string,
  ctx: NormalizeContext,
  name: string,
): OpResult {
  if (draggedAppId === targetAppId) return { ok: false, reason: 'duplicate' };
  if (PINNED_SET.has(draggedAppId) || PINNED_SET.has(targetAppId)) return { ok: false, reason: 'pinned_app' };
  if (!ctx.allowedAppIds.has(draggedAppId) || !ctx.allowedAppIds.has(targetAppId)) return { ok: false, reason: 'invalid_app' };

  const nameCheck = validateFolderName(name);
  if (!nameCheck.ok) return { ok: false, reason: 'invalid_name' };

  const folders = layout.folders ?? [];
  if (folders.length >= MAX_FOLDERS) return { ok: false, reason: 'too_many_folders' };

  const next = clone(layout);
  const id = genFolderId();
  const folder: Folder = {
    id,
    name: nameCheck.value,
    color: DEFAULT_FOLDER_COLOR,
    apps: [draggedAppId, targetAppId],
  };

  const targetIdx = next.home.indexOf(targetAppId);
  removeFromHome(next, draggedAppId);
  removeFromHome(next, targetAppId);
  const ref = FOLDER_REF_PREFIX + id;
  const insertAt = targetIdx >= 0 ? Math.min(targetIdx, next.home.length) : next.home.length;
  next.home.splice(insertAt, 0, ref);
  next.folders = [...(next.folders ?? []), folder];

  return { ok: true, layout: normalizeLayout(next, ctx) };
}

export function addAppToFolder(
  layout: AppLayout,
  folderId: string,
  appId: string,
  ctx: NormalizeContext,
): OpResult {
  if (!validateFolderId(folderId)) return { ok: false, reason: 'invalid_folder' };
  if (PINNED_SET.has(appId)) return { ok: false, reason: 'pinned_app' };
  if (!ctx.allowedAppIds.has(appId)) return { ok: false, reason: 'invalid_app' };

  const next = clone(layout);
  const folder = findFolder(next, folderId);
  if (!folder) return { ok: false, reason: 'not_found' };
  if (folder.apps.length >= MAX_APPS_PER_FOLDER) return { ok: false, reason: 'folder_full' };
  if (folder.apps.includes(appId)) return { ok: false, reason: 'duplicate' };

  for (const other of next.folders ?? []) {
    if (other.id === folderId) continue;
    const idx = other.apps.indexOf(appId);
    if (idx >= 0) other.apps.splice(idx, 1);
  }
  removeFromHome(next, appId);
  folder.apps.push(appId);

  return { ok: true, layout: normalizeLayout(next, ctx) };
}

export function removeAppFromFolder(
  layout: AppLayout,
  folderId: string,
  appId: string,
  ctx: NormalizeContext,
): OpResult {
  if (!validateFolderId(folderId)) return { ok: false, reason: 'invalid_folder' };
  const next = clone(layout);
  const folder = findFolder(next, folderId);
  if (!folder) return { ok: false, reason: 'not_found' };
  const idx = folder.apps.indexOf(appId);
  if (idx < 0) return { ok: false, reason: 'not_found' };

  folder.apps.splice(idx, 1);

  const ref = FOLDER_REF_PREFIX + folderId;
  const refIdx = next.home.indexOf(ref);
  const insertAt = refIdx >= 0 ? refIdx + 1 : next.home.length;
  if (!next.home.includes(appId)) next.home.splice(insertAt, 0, appId);

  return { ok: true, layout: normalizeLayout(next, ctx) };
}

export function renameFolder(
  layout: AppLayout,
  folderId: string,
  name: string,
  ctx: NormalizeContext,
): OpResult {
  if (!validateFolderId(folderId)) return { ok: false, reason: 'invalid_folder' };
  const check = validateFolderName(name);
  if (!check.ok) return { ok: false, reason: 'invalid_name' };

  const next = clone(layout);
  const folder = findFolder(next, folderId);
  if (!folder) return { ok: false, reason: 'not_found' };
  folder.name = check.value;

  return { ok: true, layout: normalizeLayout(next, ctx) };
}

export function recolorFolder(
  layout: AppLayout,
  folderId: string,
  color: string,
  ctx: NormalizeContext,
): OpResult {
  if (!validateFolderId(folderId)) return { ok: false, reason: 'invalid_folder' };
  const validColor = validateFolderColor(color);
  if (!validColor) return { ok: false, reason: 'invalid_color' };

  const next = clone(layout);
  const folder = findFolder(next, folderId);
  if (!folder) return { ok: false, reason: 'not_found' };
  folder.color = validColor;

  return { ok: true, layout: normalizeLayout(next, ctx) };
}

export function deleteFolder(
  layout: AppLayout,
  folderId: string,
  ctx: NormalizeContext,
): OpResult {
  if (!validateFolderId(folderId)) return { ok: false, reason: 'invalid_folder' };
  const next = clone(layout);
  const folder = findFolder(next, folderId);
  if (!folder) return { ok: false, reason: 'not_found' };

  const ref = FOLDER_REF_PREFIX + folderId;
  const refIdx = next.home.indexOf(ref);
  const apps = [...folder.apps];
  if (refIdx >= 0) next.home.splice(refIdx, 1, ...apps);
  else next.home.push(...apps);
  next.folders = (next.folders ?? []).filter((f) => f.id !== folderId);

  return { ok: true, layout: normalizeLayout(next, ctx) };
}

export function reorderHome(
  layout: AppLayout,
  itemId: string,
  targetIndex: number,
  ctx: NormalizeContext,
): OpResult {
  const next = clone(layout);
  const fromIdx = next.home.indexOf(itemId);
  if (fromIdx < 0) return { ok: false, reason: 'not_found' };
  next.home.splice(fromIdx, 1);
  const clamped = Math.max(0, Math.min(targetIndex, next.home.length));
  next.home.splice(clamped, 0, itemId);
  return { ok: true, layout: normalizeLayout(next, ctx) };
}
