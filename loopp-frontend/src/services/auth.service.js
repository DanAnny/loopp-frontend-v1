// frontend/src/services/auth.service.js
import { apiClient } from "./http";

// keep these simple and side-effect free
export const signupSuperAdmin = (body) =>
  apiClient.post("/auth/signup-superadmin", body);

export const addUser = (body) => apiClient.post("/auth/add-user", body);

export const refresh = () => apiClient.post("/auth/refresh");

export const logout = () => apiClient.post("/auth/logout");

// plain sign-in; caller handles token
export const signIn = async (body) => {
  const { data } = await apiClient.post("/auth/signin", body);
  return { data };
};

// client sign-up; caller handles token
export const signUpClient = async (body) => {
  const { data } = await apiClient.post("/auth/customer/signup", body);
  return { data };
};

export default {
  signIn,
  signUpClient,
  refresh,
  logout,
  addUser,
  signupSuperAdmin,
};
