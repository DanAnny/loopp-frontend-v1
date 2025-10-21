// frontend/src/lib/resetClientState.js
import { apiClient, setAccessToken } from "@/services/http";
import { getSocket } from "@/lib/socket";

// Best-effort: clear caches, SW, storage, tokens, socket.
export async function hardClientReset() {
  try {
    // 1) Server: revoke refresh cookie if present
    try {
      await apiClient.post("/auth/logout", {}); // ignores if not logged in
    } catch { /* ignore */ }

    // 2) Token in memory (axios) & any listeners
    try { setAccessToken(null); } catch {}

    // 3) Socket: disconnect and forget
    try {
      const s = getSocket?.();
      if (s && s.connected) s.disconnect();
    } catch {}

    // 4) Caches (service worker cache api)
    if (typeof caches !== "undefined" && caches.keys) {
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      } catch {}
    }

    // 5) Service workers
    if ("serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {}
    }

    // 6) Storage
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}

    // 7) IndexedDB (best-effort: wipe common DBs; ignore failures)
    const tryDeleteDB = (name) =>
      new Promise((resolve) => {
        let req;
        try {
          req = indexedDB.deleteDatabase(name);
        } catch { return resolve(); }
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });

    try {
      // Known libs/frameworks DB names to delete (add yours if needed)
      await Promise.all([
        tryDeleteDB("keyval-store"),
        tryDeleteDB("localforage"),
        tryDeleteDB("firebaseLocalStorageDb"),
        tryDeleteDB("vite-plugin-pwa"),
        tryDeleteDB("workbox-precache-v2"),
        tryDeleteDB("workbox-precache-v3"),
        tryDeleteDB("workbox-precache-v4"),
        tryDeleteDB("workbox-precache-v5"),
      ]);
    } catch {}
  } catch {}
}

// Convenience: reset then hard reload to kill any lingering app state.
export async function hardResetAndReload(url = null) {
  await hardClientReset();
  if (url) {
    window.location.replace(url);
  } else {
    window.location.reload();
  }
}
