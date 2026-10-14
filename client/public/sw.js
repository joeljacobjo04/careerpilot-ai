// CareerPilot service worker: receives push messages and shows them in the device's notification panel,
// even when the app is closed. It does no caching, so it never serves stale pages.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : "" }; }

  event.waitUntil(
    self.registration.showNotification(data.title || "CareerPilot AI", {
      body: data.body || "",
      tag: data.tag,                       // the same notification never shows twice
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = open.find((c) => new URL(c.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if (existing.url !== url && "navigate" in existing) await existing.navigate(url).catch(() => {});
      return;
    }
    await self.clients.openWindow(url);
  })());
});
