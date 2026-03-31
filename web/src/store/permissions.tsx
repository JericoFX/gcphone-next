import { createContext, createSignal, useContext, type ParentComponent } from 'solid-js';
import { fetchNui } from '../utils/fetchNui';
import { isEnvBrowser } from '../utils/misc';

export interface PermissionRequest {
  appId: string;
  appTitle: string;
  appIcon?: string;
  permissions: string[];
  resolve: (granted: boolean) => void;
}

export interface PermissionsActions {
  requestPermissions: (appId: string, appTitle: string, appIcon: string | undefined, permissions: string[]) => Promise<boolean>;
  grantPermissions: (appId: string, permissions: string[]) => void;
  denyPermissions: (appId: string, permissions: string[]) => void;
  setPermission: (appId: string, permission: string, granted: boolean) => void;
  blockApp: (appId: string) => void;
  unblockApp: (appId: string) => void;
  getAllPermissions: () => Promise<unknown[]>;
  getBlockedApps: () => Promise<unknown[]>;
  getPermissionRequest: () => PermissionRequest | null;
}

const PermissionsContext = createContext<PermissionsActions>();

export const PermissionsProvider: ParentComponent = (props) => {
  const [permissionRequest, setPermissionRequest] = createSignal<PermissionRequest | null>(null);

  const requestPermissions = (appId: string, appTitle: string, appIcon: string | undefined, permissions: string[]): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPermissionRequest({
        appId,
        appTitle,
        appIcon,
        permissions,
        resolve,
      });
    });
  };

  const grantPermissions = (appId: string, permissions: string[]) => {
    const req = permissionRequest();
    fetchNui('sdkGrantAllPermissions', { appId, permissions });
    setPermissionRequest(null);
    if (req && req.appId === appId) {
      req.resolve(true);
    }
  };

  const denyPermissions = (appId: string, permissions: string[]) => {
    const req = permissionRequest();
    fetchNui('sdkDenyAllPermissions', { appId, permissions });
    setPermissionRequest(null);
    if (req && req.appId === appId) {
      req.resolve(false);
    }
  };

  const setPermission = (appId: string, permission: string, granted: boolean) => {
    fetchNui('sdkSetPermission', { appId, permission, granted });
  };

  const blockApp = (appId: string) => {
    fetchNui('sdkBlockApp', { appId });
  };

  const unblockApp = (appId: string) => {
    fetchNui('sdkUnblockApp', { appId });
  };

  const getAllPermissions = (): Promise<unknown[]> => {
    return fetchNui<unknown[]>('sdkGetAllAppPermissions', undefined, []);
  };

  const getBlockedApps = (): Promise<unknown[]> => {
    return fetchNui<unknown[]>('sdkGetBlockedApps', undefined, []);
  };

  const getPermissionRequest = () => permissionRequest();

  const actions: PermissionsActions = {
    requestPermissions,
    grantPermissions,
    denyPermissions,
    setPermission,
    blockApp,
    unblockApp,
    getAllPermissions,
    getBlockedApps,
    getPermissionRequest,
  };

  if (isEnvBrowser()) {
    (window as any).__gcphonePermissions = actions;
  }

  return (
    <PermissionsContext.Provider value={actions}>
      {props.children}
    </PermissionsContext.Provider>
  );
};

export function usePermissions(): PermissionsActions {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
}
