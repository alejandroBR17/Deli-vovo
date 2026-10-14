export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pending: InstallPrompt | null = null;
let initialized = false;
const subscribers = new Set<() => void>();
const publish = () => subscribers.forEach(notify => notify());

// Start before React and worker registration so an early browser event is retained.
export function initializeAppInstall() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pending = event as InstallPrompt;
    publish();
  });
  window.addEventListener('appinstalled', () => {
    pending = null;
    publish();
  });
}

export const getInstallPrompt = () => pending;
export function subscribeInstallPrompt(notify: () => void) {
  subscribers.add(notify);
  return () => { subscribers.delete(notify); };
}

// The browser event is single-use, including a dismissed or failed attempt.
export function takeInstallPrompt() {
  const event = pending;
  pending = null;
  publish();
  return event;
}
