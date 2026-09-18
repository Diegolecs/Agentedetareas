// Service Worker Push & Notification Handler
// This script receives background Web Push events from Google FCM / Push Service
// and presents real system notifications on Android / Desktop OS.

self.addEventListener('push', (event) => {
  console.log('[SW Push] Push event received at:', new Date().toISOString(), event);

  let payload = {
    title: 'Recordatorio',
    body: 'Tienes un recordatorio pendiente.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'reminder-tag',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const title = payload.title || 'Recordatorio';
  const options = {
    body: payload.body || 'Es hora de atender este recordatorio programado.',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || `rem-${Date.now()}`,
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    data: payload.data || { url: '/' },
    actions: payload.actions || [
      { action: 'open', title: 'Abrir' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      console.log('[SW Push] showNotification() executed successfully for:', title);
    }).catch((err) => {
      console.error('[SW Push] showNotification() failed:', err);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW Push] Notification clicked:', event.notification);
  event.notification.close();

  const clickAction = event.action;
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and optionally notify it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.notification.data) {
            client.postMessage({
              type: 'PUSH_NOTIFICATION_CLICKED',
              data: event.notification.data,
              action: clickAction,
            });
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
