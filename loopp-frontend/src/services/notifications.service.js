import { apiClient } from "@/services/http";

export async function fetchNotifications({ cursor = null, limit = 20 } = {}) {
  const { data } = await apiClient.get("/notifications", {
    params: { cursor, limit },
  });
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await apiClient.post("/notifications/read", { id });
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await apiClient.post("/notifications/read-all", {});
  return data;
}
