import { createSignal, For, Show, onMount } from 'solid-js';
import { SectionHeader } from '../../shared/ui/SectionBlock';
import { APP_DEFINITIONS, APP_IDS } from '../../../config/apps';
import { appName } from '../../../i18n';
import { usePermissions } from '../../../store/permissions';
import { ICONS, IconImage } from './settingsShared';
import styles from './SettingsApp.module.scss';

interface SettingsAppsPermissionsProps {
  language: () => string;
  onBack: () => void;
}

interface AppPermissionEntry {
  app_id: string;
  permission: string;
  granted: boolean;
}

interface BlockedAppEntry {
  app_id: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  location: 'Ubicacion',
  contacts: 'Contactos',
  messages: 'Mensajes',
  notifications: 'Notificaciones',
  camera: 'Camara',
  microphone: 'Microfono',
  gallery: 'Galeria',
  calls: 'Llamadas',
  maps: 'Mapas',
  storage: 'Almacenamiento',
};

function getAppIcon(appId: string): string {
  const def = APP_DEFINITIONS.find((a) => a.id === appId);
  return def?.icon || './img/icons_ios/appstore.svg';
}

function getAppTitle(appId: string, lang: string): string {
  const def = APP_DEFINITIONS.find((a) => a.id === appId);
  if (def) return appName(def.id, def.name, lang);
  return appId;
}

function isSystemApp(appId: string): boolean {
  return APP_IDS.includes(appId);
}

export function SettingsAppsPermissions(props: SettingsAppsPermissionsProps) {
  const permissions = usePermissions();

  const [allPerms, setAllPerms] = createSignal<AppPermissionEntry[]>([]);
  const [blockedApps, setBlockedApps] = createSignal<BlockedAppEntry[]>([]);
  const [selectedApp, setSelectedApp] = createSignal<string | null>(null);

  const loadData = async () => {
    const perms = await permissions.getAllPermissions();
    setAllPerms((perms || []) as AppPermissionEntry[]);
    const blocked = await permissions.getBlockedApps();
    setBlockedApps((blocked || []) as BlockedAppEntry[]);
  };

  onMount(() => {
    void loadData();
  });

  const groupedApps = () => {
    const map = new Map<string, AppPermissionEntry[]>();
    for (const entry of allPerms()) {
      if (!entry?.app_id) continue;
      const list = map.get(entry.app_id) || [];
      list.push(entry);
      map.set(entry.app_id, list);
    }
    return map;
  };

  const appIds = () => [...groupedApps().keys()];

  const grantedCount = (appId: string): number => {
    const perms = groupedApps().get(appId) || [];
    return perms.filter((p) => p.granted).length;
  };

  const appPerms = () => {
    const id = selectedApp();
    if (!id) return [];
    return groupedApps().get(id) || [];
  };

  const handleToggle = (appId: string, permission: string, currentGranted: boolean) => {
    permissions.setPermission(appId, permission, !currentGranted);
    setAllPerms((prev) =>
      prev.map((p) =>
        p.app_id === appId && p.permission === permission
          ? { ...p, granted: !currentGranted }
          : p
      )
    );
  };

  const handleBlock = (appId: string) => {
    permissions.blockApp(appId);
    setSelectedApp(null);
    setAllPerms((prev) => prev.filter((p) => p.app_id !== appId));
    setBlockedApps((prev) => [...prev, { app_id: appId }]);
  };

  const handleUnblock = (appId: string) => {
    permissions.unblockApp(appId);
    setBlockedApps((prev) => prev.filter((b) => b.app_id !== appId));
  };

  return (
    <div class={styles.content}>
      <Show when={selectedApp() === null}>
        {/* App list view */}
        <SectionHeader title="APPS" />
        <div class="ios18-list">
          <For each={appIds()} fallback={
            <div class="ios18-cell">
              <span class="ios18-cell__subtitle" style={{ 'text-align': 'center', width: '100%', padding: '8px 0' }}>
                Sin permisos registrados
              </span>
            </div>
          }>
            {(appId, index) => (
              <button
                class={styles.appRow}
                style={{ cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', 'text-align': 'left', "animation-delay": `${index() * 30}ms` }}
                onClick={() => setSelectedApp(appId)}
              >
                <div class={styles.appIcon}><img src={getAppIcon(appId)} alt="" /></div>
                <div class={styles.appInfo}>
                  <div class={styles.appName}>{getAppTitle(appId, props.language())}</div>
                  <div class={styles.appStatus}>{grantedCount(appId)} permisos concedidos</div>
                </div>
                <div class={styles.chevron} />
              </button>
            )}
          </For>
        </div>

        <Show when={blockedApps().length > 0}>
          <SectionHeader title="BLOQUEADAS" />
          <div class="ios18-list">
            <For each={blockedApps()}>
              {(blocked) => (
                <div class={styles.appRow}>
                  <div class={styles.appIcon}><img src={getAppIcon(blocked.app_id)} alt="" /></div>
                  <div class={styles.appInfo}>
                    <div class={styles.appName} classList={{ [styles.muted]: true }}>
                      {getAppTitle(blocked.app_id, props.language())}
                    </div>
                    <div class={styles.appStatus}>Bloqueada</div>
                  </div>
                  <button
                    style={{
                      background: 'var(--tint)',
                      color: '#fff',
                      border: 'none',
                      'border-radius': 'var(--r-md)',
                      padding: '4px 10px',
                      'font-size': 'var(--fs-caption1)',
                      'font-weight': '600',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleUnblock(blocked.app_id)}
                  >
                    Reinstalar
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={selectedApp() !== null}>
        {/* Detail view for selected app */}
        <button
          class="ios18-cell"
          style={{ cursor: 'pointer', width: '100%', 'text-align': 'left', background: 'transparent', border: 'none', 'margin-bottom': '4px' }}
          onClick={() => setSelectedApp(null)}
        >
          <span style={{ color: 'var(--tint)', 'font-size': 'var(--fs-footnote)', 'font-weight': '500' }}>
            ← Volver
          </span>
        </button>

        <div style={{ display: 'flex', 'align-items': 'center', gap: '10px', padding: '0 0 8px' }}>
          <div class={styles.appIcon}><img src={getAppIcon(selectedApp()!)} alt="" /></div>
          <div>
            <div style={{ 'font-size': 'var(--fs-headline)', 'font-weight': '600', color: 'var(--text)' }}>
              {getAppTitle(selectedApp()!, props.language())}
            </div>
            <Show when={isSystemApp(selectedApp()!)}>
              <span style={{
                'font-size': 'var(--fs-caption2)',
                color: 'var(--text-3)',
                background: 'var(--surface-2)',
                padding: '2px 6px',
                'border-radius': 'var(--r-sm, 4px)',
                'font-weight': '500',
              }}>
                App del sistema
              </span>
            </Show>
          </div>
        </div>

        <SectionHeader title="PERMISOS" />
        <div class="ios18-list">
          <For each={appPerms()} fallback={
            <div class="ios18-cell">
              <span class="ios18-cell__subtitle" style={{ 'text-align': 'center', width: '100%', padding: '8px 0' }}>
                Sin permisos
              </span>
            </div>
          }>
            {(perm) => (
              <div class={styles.appRow}>
                <div class={styles.appInfo}>
                  <div class={styles.appName}>
                    {PERMISSION_LABELS[perm.permission] || perm.permission}
                  </div>
                </div>
                <div
                  class="ios18-switch"
                  role="switch"
                  aria-checked={perm.granted}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleToggle(perm.app_id, perm.permission, perm.granted)}
                >
                  <div class="ios18-switch__thumb" />
                </div>
              </div>
            )}
          </For>
        </div>

        <Show when={!isSystemApp(selectedApp()!)}>
          <div style={{ 'margin-top': 'var(--s-4)' }}>
            <div class="ios18-list">
              <button
                class="ios18-cell"
                style={{
                  cursor: 'pointer',
                  width: '100%',
                  'text-align': 'center',
                  background: 'transparent',
                  border: 'none',
                  'justify-content': 'center',
                }}
                onClick={() => handleBlock(selectedApp()!)}
              >
                <span style={{ color: 'var(--danger)', 'font-weight': '600', 'font-size': 'var(--fs-footnote)' }}>
                  Eliminar app
                </span>
              </button>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
