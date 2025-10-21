// Builds absolute links for preview/download that match your http.js config.
// VITE_API_URL already includes `/api` (e.g., http://localhost:5500/api)
import { API_BASE_URL } from "@/services/http";

export function fileHref(fileId, { download = false } = {}) {
  const base = String(API_BASE_URL).replace(/\/+$/, ""); // .../api
  const path = `/files/${encodeURIComponent(fileId)}`;   // .../api/files/:id
  return `${base}${path}${download ? "?download=1" : ""}`;
}
