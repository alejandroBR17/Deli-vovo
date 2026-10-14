export interface RelatedApp { platform?: string; id?: string; url?: string; }
export type InstallDetection = 'installed' | 'not-detected' | 'unknown';
export async function detectInstalledApp(origin: string, browser: {getInstalledRelatedApps?: () => Promise<RelatedApp[]>}, timeoutMs = 3000): Promise<InstallDetection> {
  if (typeof browser.getInstalledRelatedApps !== 'function') return 'unknown';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const apps = await Promise.race([
      browser.getInstalledRelatedApps(),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    if (!Array.isArray(apps)) return 'unknown';
    return apps.some(app => app.platform === 'webapp' && (app.id === origin + '/' || app.url === origin + '/manifest.json')) ? 'installed' : 'not-detected';
  } catch { return 'unknown'; }
  finally { clearTimeout(timer); }
}
