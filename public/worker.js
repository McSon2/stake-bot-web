// Écoute pour les événements push et affiche les notifications
self.addEventListener("push", (event) => {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: "public/ios.png",
    data: data.data, // Assurez-vous que 'data' contient l'URL à ouvrir
  });
});

// Gestion des clics sur les notifications
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  notification.close();

  if (notification.data && notification.data.url) {
    event.waitUntil(clients.openWindow(notification.data.url));
  }
});