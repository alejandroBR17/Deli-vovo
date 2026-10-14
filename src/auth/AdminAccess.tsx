import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';

const AdminAccessContext = createContext({hasAdminAccess: false, refreshAdminAccess: async () => false});
export const useAdminAccess = () => useContext(AdminAccessContext);

// This controls visible shortcuts only. Every admin endpoint still authorizes its own request.
export function AdminAccessProvider({children}: {children: React.ReactNode}) {
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const authorized = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const pending = useRef<Promise<boolean> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const refreshAdminAccess = useCallback(() => {
    if (pending.current) return pending.current;
    const version = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 6000);
    const request = (async () => {
      let allowed = false;
      try {
        const response = await fetch('/api/admin/session', {credentials: 'same-origin', cache: 'no-store', signal: abort.signal});
        allowed = response.ok && (await response.json()).authenticated === true;
      } catch { /* A failed check never grants access. */ }
      finally { clearTimeout(timer); }
      if (version === generation.current && mounted.current) {
        authorized.current = allowed;
        setHasAdminAccess(allowed);
      }
      return version === generation.current && allowed;
    })();
    pending.current = request;
    void request.finally(() => {if (pending.current === request) pending.current = null;});
    return request;
  }, []);
  useEffect(() => {
    mounted.current = true;
    const clear = () => {
      generation.current++;
      controller.current?.abort();
      pending.current = null;
      authorized.current = false;
      setHasAdminAccess(false);
    };
    const changed = () => {clear(); void refreshAdminAccess();};
    const visible = () => {if (authorized.current && document.visibilityState === 'visible') void refreshAdminAccess();};
    void refreshAdminAccess();
    window.addEventListener('vovo-admin-access-changed', changed);
    window.addEventListener('vovo-admin-session-expired', clear);
    document.addEventListener('visibilitychange', visible);
    return () => {
      mounted.current = false; generation.current++; controller.current?.abort(); pending.current = null;
      window.removeEventListener('vovo-admin-access-changed', changed);
      window.removeEventListener('vovo-admin-session-expired', clear);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refreshAdminAccess]);
  return <AdminAccessContext.Provider value={{hasAdminAccess, refreshAdminAccess}}>{children}</AdminAccessContext.Provider>;
}
