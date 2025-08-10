// Service Worker for handling push notifications
// Place this in your frontend public folder as sw.js

self.addEventListener("push", function (event) {
  console.log("Push event received:", event);

  if (!event.data) {
    return;
  }

  const data = event.data.json();
  console.log("Push data:", data);

  const options = {
    body: data.body,
    icon: data.icon || "/icon-192x192.png",
    badge: data.badge || "/badge-72x72.png",
    url: data.url || "/",
    tag: data.tag,
    data: data.data,
    actions: data.actions || [],
    requireInteraction: true, // Keep notification visible until user interacts
    vibrate: [100, 50, 100], // Vibration pattern for mobile
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function (event) {
  console.log("Notification clicked:", event);

  event.notification.close();

  const url = event.notification.data?.url || event.notification.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then(function (clientList) {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }

      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("notificationclose", function (event) {
  console.log("Notification closed:", event);

  // Optional: Track notification dismissal
  // You could send this data back to your analytics
});
