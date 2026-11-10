/**
 * BetBoy AI Predictor Client Script
 * Version: 1.0.4
 * Auto-syncs live match slates and busts stale caches across all mobile browsers
 */
(function() {
  if (typeof window !== "undefined") {
    window.__BETBOY_VERSION__ = "1.0.4";

    // Unregister any stale legacy Service Workers if present
    if (typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(r) { r.unregister(); });
      }).catch(function() {});
    }

    // Flush CacheStorage if version mismatches
    if (typeof caches !== "undefined" && caches.keys) {
      caches.keys().then(function(names) {
        names.forEach(function(n) { caches.delete(n); });
      }).catch(function() {});
    }
  }
})();
