// src/services/dashboard.service.js
import { apiClient } from "./http";

// Make BOTH point to /dashboard/overview
export const overview = (range = "month") =>
  apiClient.get("/dashboard/overview", { params: { range } });

export const superOverview = (range = "month") =>
  apiClient.get("/dashboard/overview", { params: { range } });

export default { overview, superOverview };
