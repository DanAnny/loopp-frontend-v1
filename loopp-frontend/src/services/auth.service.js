// frontend/src/services/auth.service.js
import { apiClient } from "./http";

/**
 * Auth + verification helpers
 * Aligned to backend routes:
 *  - POST /auth/verify/send
 *  - POST /auth/verify/consume
 *  - GET  /auth/verify/status?email=...
 *  - GET  /auth/me
 */

// Admin helpers (unchanged)
export const signupSuperAdmin = (body) =>
  apiClient.post("/auth/signup-superadmin", body);

export const addUser = (body) => apiClient.post("/auth/add-user", body);

// Token/Session
export const refresh = () => apiClient.post("/auth/refresh");
export const logout  = () => apiClient.post("/auth/logout", {}); // withCredentials via apiClient

// Sign in / Sign up (client)
export const signIn = async (body) => {
  const { data } = await apiClient.post("/auth/signin", body);
  return { data };
};

export const signUpClient = async (body) => {
  const { data } = await apiClient.post("/auth/customer/signup", body);
  return { data };
};

// Current user profile (expects { user: {..., isVerified, email } } or raw object)
export const me = async () => {
  const { data } = await apiClient.get("/auth/me");
  return data;
};

// Email verification flows (backend-driven)
export const sendVerificationEmail = async () => {
  const { data } = await apiClient.post("/auth/verify/send", {});
  // { success, message?, expiresInHours? }
  return data;
};

// Alias resend to the same endpoint (backend handles issuing a fresh token)
export const resendVerificationEmail = async () => {
  const { data } = await apiClient.post("/auth/verify/send", {});
  return data;
};

export const verifyEmailToken = async (token) => {
  const { data } = await apiClient.post("/auth/verify/consume", { token });
  // { success, email }
  return data;
};

export const verifyStatus = async (email) => {
  const { data } = await apiClient.get("/auth/verify/status", { params: { email } });
  // { success, isVerified }
  return data;
};

export default {
  // Admin
  signupSuperAdmin,
  addUser,
  // Tokens
  refresh,
  logout,
  // Auth
  signIn,
  signUpClient,
  // Me
  me,
  // Verification
  sendVerificationEmail,
  resendVerificationEmail,
  verifyEmailToken,
  verifyStatus,
};
