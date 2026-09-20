/**
 * Service worker for push notifications.
 *
 * Deliberately small. It does not cache anything and does not try to make the
 * app work offline: a checklist that appears to save while offline and then
 * quietly loses the answer is worse than one that plainly refuses. All this
 * does is receive a push and show it.
 *
 * Served from /sw.js so its scope is the whole origin.
 */

self.addEventListener('install', () => {
  // Take over without waiting for existing tabs to close, so a staff member who
  // grants permission does not have to close the app for it to work.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'GM Checklista';
  const options = {
    body: data.body || '',
    // Same tag for the same list, so a later reminder replaces the earlier one
    // instead of stacking four identical warnings in the tray.
    tag: data.tag || 'gm-checklist',
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
    lang: 'sv',
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Reuse an open tab if there is one; a warehouse handheld should not end
      // up with a dozen copies of the app open by the end of a shift.
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
