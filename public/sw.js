self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));
function safeNotificationUrl(value) {
  try {
    const url = new URL(value || '/', self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin + '/';
  } catch { return self.location.origin + '/'; }
}
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || 'Aviso da Delícias da Vovó', {
    body: data.body || 'Abra o aplicativo para conferir.', icon: '/icon-192.png', badge: '/icon-192.png',
    tag: data.tag || 'vovo-' + Date.now(), vibrate: [300, 100, 300], requireInteraction: true,
    data: { url: safeNotificationUrl(data.url) },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); return existing.focus(); }
    return clients.openWindow(url);
  }));
});
