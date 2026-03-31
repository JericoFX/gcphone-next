import { Show, For } from 'solid-js';
import { Motion, Presence } from '@motionone/solid';
import { usePermissions } from '../../../store/permissions';
import styles from './PermissionModal.module.scss';

const PERMISSION_DISPLAY: Record<string, { icon: string; label: string }> = {
  location: { icon: './img/icons_ios/ui-location.svg', label: 'Tu ubicacion' },
  contacts: { icon: './img/icons_ios/contacts.svg', label: 'Tus contactos' },
  messages: { icon: './img/icons_ios/messages.svg', label: 'Enviar mensajes' },
  notifications: { icon: './img/icons_ios/ui-bell.svg', label: 'Notificaciones' },
  camera: { icon: './img/icons_ios/camera.svg', label: 'Camara' },
  microphone: { icon: './img/icons_ios/ui-mic.svg', label: 'Microfono' },
  gallery: { icon: './img/icons_ios/gallery.svg', label: 'Galeria de fotos' },
  calls: { icon: './img/icons_ios/calls.svg', label: 'Realizar llamadas' },
  maps: { icon: './img/icons_ios/maps.svg', label: 'Mapas y navegacion' },
  storage: { icon: './img/icons_ios/ui-storage.svg', label: 'Almacenamiento' },
};

function getPermissionDisplay(key: string): { icon: string; label: string } {
  return PERMISSION_DISPLAY[key] || { icon: './img/icons_ios/ui-lock.svg', label: key };
}

export function PermissionModal() {
  const permissions = usePermissions();

  const request = () => permissions.getPermissionRequest();
  const isOpen = () => !!request();

  const handleAllow = () => {
    const req = request();
    if (!req) return;
    permissions.grantPermissions(req.appId, req.permissions);
  };

  const handleDeny = () => {
    const req = request();
    if (!req) return;
    permissions.denyPermissions(req.appId, req.permissions);
  };

  return (
    <Presence>
      <Show when={isOpen()}>
        <Motion.div
          class={styles.overlay}
          onClick={handleDeny}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Motion.div
            class={styles.modal}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ duration: 0.25, easing: [0.32, 0.72, 0, 1] }}
          >
            <div class={styles.header}>
              <Show when={request()?.appIcon}>
                <span class={styles.appIcon}>{request()!.appIcon}</span>
              </Show>
              <p class={styles.appTitle}>{request()?.appTitle ?? ''}</p>
              <p class={styles.subtitle}>quiere acceder a:</p>
            </div>

            <div class={styles.permissionList}>
              <For each={request()?.permissions ?? []}>
                {(perm) => {
                  const display = getPermissionDisplay(perm);
                  return (
                    <div class={styles.permissionRow}>
                      <img class={styles.permissionIcon} src={display.icon} alt="" />
                      <span class={styles.permissionLabel}>{display.label}</span>
                    </div>
                  );
                }}
              </For>
            </div>

            <div class={styles.actions}>
              <button class={styles.denyBtn} onClick={handleDeny}>Rechazar</button>
              <button class={styles.allowBtn} onClick={handleAllow}>Permitir</button>
            </div>
          </Motion.div>
        </Motion.div>
      </Show>
    </Presence>
  );
}
