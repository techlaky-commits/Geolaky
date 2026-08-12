// Service worker minimal : rend l'app installable (PWA) sans mise en cache
// agressive, pour eviter de servir du contenu perime pendant le MVP.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pas de cache : toutes les requetes passent au reseau normalement.
});
