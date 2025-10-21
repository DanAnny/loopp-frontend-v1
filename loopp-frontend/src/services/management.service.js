// src/services/management.service.js
import { apiClient } from "./http";

export const getOverview = () => apiClient.get("/management/overview");
export const getAudits = (limit = 20) =>
  apiClient.get(`/management/audits?limit=${encodeURIComponent(limit)}`);
export const bulkUpdate = (ids, patch) =>
  apiClient.patch("/management/users/bulk", { ids, patch });
export const toggleUser = (id, patch) =>
  apiClient.patch(`/management/users/${id}/toggle`, patch);

export default { getOverview, getAudits, bulkUpdate, toggleUser };
