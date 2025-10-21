// src/services/projects.service.js
import { apiClient } from "./http";

export const intake = (body) => apiClient.post("/projects/intake", body);
export const assignEngineer = (body) => apiClient.post("/projects/assign-engineer", body);
export const review = (body) => apiClient.post("/projects/review", body);
export const rate = (body) => apiClient.post("/projects/rate", body);
export const close = (body) => apiClient.post("/projects/close", body);
export const reopen = (body) => apiClient.post("/projects/reopen", body);

// NEW: client asks PM to reopen a closed room/project
export const requestReopen = (body) => apiClient.post("/projects/client/request-reopen", body);

export const getAll = () => apiClient.get("/projects");
export const getById = (id) => apiClient.get(`/projects/${id}`);
export const remove = (id) => apiClient.delete(`/projects/${id}`);
export const getByRoom = (roomId) => apiClient.get(`/projects/by-room/${roomId}`);

// META is now fully public — keep function the same (opts ignored safely)
export const getRoomMeta = (roomId) => apiClient.get(`/projects/by-room/${roomId}/meta`);

// Useful for public status checks (unchanged)
export const getPublicByKey = (key) =>
  apiClient.get(`/projects/public/by-key/${encodeURIComponent(key)}`);

export default {
  intake,
  assignEngineer,
  review,
  rate,
  close,
  reopen,
  requestReopen,   // ← include in default export
  getAll,
  getById,
  remove,
  getByRoom,
  getRoomMeta,
  getPublicByKey,
};
