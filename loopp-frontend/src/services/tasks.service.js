import { apiClient } from "@/services/http";
const withCreds = { withCredentials: true };

export const getByEngineer = (engineerId) => {
  if (!engineerId) throw new Error("Missing engineerId");
  return apiClient.get(`/tasks/engineer/${engineerId}`, withCreds);
};

export const getSummary = (engineerId) => {
  if (!engineerId) throw new Error("Missing engineerId");
  return apiClient.get(`/tasks/engineer/${engineerId}/summary`, withCreds);
};

export const accept   = (payload) => apiClient.post("/tasks/accept", payload, withCreds);
export const complete = (payload) => apiClient.post("/tasks/complete", payload, withCreds);
export const createTask = (payload) => apiClient.post("/tasks/create", payload, withCreds);

export default { getByEngineer, getSummary, accept, complete, createTask };
