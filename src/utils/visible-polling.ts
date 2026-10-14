// One request at a time. Hidden/offline pages make no automatic requests.
export function startVisiblePolling(task: () => Promise<unknown>, interval: number, immediate = true) {
  let stopped = false;
  let running = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const available = () => document.visibilityState === 'visible' && navigator.onLine;
  const run = async () => {
    if (stopped || running || !available()) return;
    clearTimeout(timer);
    running = true;
    try { failures = await task() === false ? Math.min(failures + 1, 4) : 0; }
    catch { failures = Math.min(failures + 1, 4); }
    finally {
      running = false;
      if (!stopped && available()) timer = setTimeout(run, Math.min(interval * 2 ** failures, Math.max(interval, 300000)));
    }
  };
  const resume = () => { clearTimeout(timer); if (available()) void run(); };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener('offline', resume);
  if (immediate) void run(); else if (available()) timer = setTimeout(run, interval);
  return () => {
    stopped = true; clearTimeout(timer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('offline', resume);
  };
}
