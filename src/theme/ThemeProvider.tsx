import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
const ThemeContext = createContext<{mode: ThemeMode; resolved: 'light' | 'dark'; setMode: (mode: ThemeMode) => void} | null>(null);

export function ThemeProvider({children}: {children: React.ReactNode}) {
  // Each app opening starts with the device. Manual choices belong to this session.
  const [mode, setMode] = useState<ThemeMode>('system');
  const [deviceDark, setDeviceDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const change = (event: MediaQueryListEvent) => setDeviceDark(event.matches);
    setDeviceDark(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const resolved = mode === 'system' ? (deviceDark ? 'dark' : 'light') : mode;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#191b20' : '#fff8ee');
  }, [resolved]);
  const value = useMemo(() => ({mode, resolved, setMode}), [mode, resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider ausente.');
  return value;
}
