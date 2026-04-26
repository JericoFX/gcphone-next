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
  grantPermissions: (appId: string, permissions: string[]) => Promise<boolean>;
  denyPermissions: (appId: string, permissions: string[]) => Promise<boolean>;
  setPermission: (appId: string, permission: string, granted: boolean) => Promise<boolean>;
  blockApp: (appId: string) => Promise<boolean>;
  unblockApp: (appId: string) => Promise<boolean>;
  getAllPermissions: () => Promise<unknown[]>;
  getBlockedApps: () => Promise<unknown[]>;
  getPermissionRequest: () => PermissionRequest | null;
}

const PermissionsContext = createContext<PermissionsActions>();

const isSuccessResponse = (result: unknown): boolean => {
  if (result === true) return true;
  if (result && typeof result === 'object' && 'success' in result) {
    return (result as { success?: unknown }).success === true;
  }
  return false;
};

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

  const grantPermissions = async (appId: string, permissions: string[]) => {
    const req = permissionRequest();
    const result = await fetchNui('sdkGrantAllPermissions', { appId, permissions });
    const success = isSuccessResponse(result);
    setPermissionRequest(null);
    if (req && req.appId === appId) {
      req.resolve(success);
    }
    return success;
  };

  const denyPermissions = async (appId: string, permissions: string[]) => {
    const req = permissionRequest();
    const result = await fetchNui('sdkDenyAllPermissions', { appId, permissions });
    const success = isSuccessResponse(result);
    setPermissionRequest(null);
    if (req && req.appId === appId) {
      req.resolve(false);
    }
    return success;
  };

  const setPermission = async (appId: string, permission: string, granted: boolean) => {
    const result = await fetchNui('sdkSetPermission', { appId, permission, granted });
    return isSuccessResponse(result);
  };

  const blockApp = async (appId: string) => {
    const result = await fetchNui('sdkBlockApp', { appId });
    return isSuccessResponse(result);
  };

  const unblockApp = async (appId: string) => {
    const result = await fetchNui('sdkUnblockApp', { appId });
    return isSuccessResponse(result);
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
