const KEY = 'loopp:pending-intake';

export function capturePendingFromURL() {
  const url = new URL(window.location.href);
  const pendingB64 = url.searchParams.get('pending') || '';
  const clientKey  = url.searchParams.get('key') || '';
  const titleRaw   = url.searchParams.get('title') || '';

  let pending = null;
  if (pendingB64) {
    try {
      const json = decodeURIComponent(escape(atob(pendingB64)));
      pending = JSON.parse(json);
    } catch {}
  }

  let projectTitle = '';
  try { projectTitle = decodeURIComponent(titleRaw); } catch { projectTitle = titleRaw; }

  if (!clientKey) return null;

  const data = { clientKey, projectTitle: (projectTitle || '').trim(), pending, capturedAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

export function readPendingFromStore() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function clearPending() { sessionStorage.removeItem(KEY); }
