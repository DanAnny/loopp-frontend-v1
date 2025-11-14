// frontend/src/services/auth.service.js
import { apiClient } from "./http";

/**
 * Auth + verification helpers
 * Aligned to backend routes:
 *  - POST /auth/verify/send      (send OTP to current user)
 *  - POST /auth/verify/consume   (verify OTP code)
 *  - GET  /auth/verify/status?email=...
 *  - GET  /auth/me
 */

// Admin helpers (unchanged)
export const signupSuperAdmin = (body) =>
  apiClient.post("/auth/signup-superadmin", body);

export const addUser = (body) => apiClient.post("/auth/add-user", body);

// Token/Session
export const refresh = () => apiClient.post("/auth/refresh");
export const logout  = () => apiClient.post("/auth/logout", {});

// Sign in / Sign up (client)
export const signIn = async (body) => {
  const { data } = await apiClient.post("/auth/signin", body);
  return { data };
};

export const signUpClient = async (body) => {
  const { data } = await apiClient.post("/auth/customer/signup", body);
  return { data };
};

// Current user profile
export const me = async () => {
  const { data } = await apiClient.get("/auth/me");
  return data;
};

/* -------------------------------------------------------------------------- */
/* Email verification / OTP flows                                             */
/* -------------------------------------------------------------------------- */

/**
 * Send verification OTP email to the currently authenticated user.
 * Backend returns: { success, message?, expiresInMinutes? }
 */
export const sendVerificationEmail = async () => {
  const { data } = await apiClient.post("/auth/verify/send", {});
  return data;
};

/**
 * Resend verification OTP email.
 */
export const resendVerificationEmail = async () => {
  const { data } = await apiClient.post("/auth/verify/send", {});
  return data;
};

/**
 * Verify the email using a 6-digit OTP code.
 *
 * Usage:
 *   await verifyEmailOtp({ email, code: "123456" });
 *
 * Backend: POST /auth/verify/consume { email, code }
 * Response: { success, email }
 */
export const verifyEmailOtp = async ({ email, code }) => {
  const { data } = await apiClient.post("/auth/verify/consume", {
    email,
    code,
    otp: code, // 👈 extra alias for safety
  });
  return data; // { success, email }
};

/**
 * Alias for backward compatibility.
 * You can also call:
 *   await verifyEmailToken({ email, code });
 */
export const verifyEmailToken = verifyEmailOtp;

/**
 * Check verification status for an email
 */
export const verifyStatus = async (email) => {
  const { data } = await apiClient.get("/auth/verify/status", {
    params: { email },
  });
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
  // Verification / OTP
  sendVerificationEmail,
  resendVerificationEmail,
  verifyEmailOtp,
  verifyEmailToken,
  verifyStatus,
};
