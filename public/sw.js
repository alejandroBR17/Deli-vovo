const CACHE_VERSION = 'v2-urgent-update';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000], // Padrão de vibração bem longo e insistente
    requireInteraction: true, // A notificação NÃO some até a pessoa clicar ou fechar
    renotify: true, // Faz o celular apitar/vibrar de novo mesmo se já tiver uma notificação lá
    tag: 'vovoh-urgent-alert', // Tag para agrupar e permitir o renotify
    silent: false,
    sound: 'https://actions.google.com/sounds/v1/alarms/beeping_alarm.ogg', // Tenta tocar o alarme no Android
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🚨 NOVO PEDIDO!', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
