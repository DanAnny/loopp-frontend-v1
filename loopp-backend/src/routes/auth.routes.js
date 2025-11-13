import express from "express";
import {
  signUpSuperAdmin, addUser, signIn, refreshToken, logout,
  signUpClient,

  // ↓ NEW controllers for verification
  sendVerificationEmail,
  consumeVerificationToken,
  getVerificationStatus,
} from "../controllers/auth.controller.js";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// Core auth
router.post("/signup-superadmin", signUpSuperAdmin);
router.post("/customer/signup", signUpClient);
router.post("/add-user", requireAuth, authorizeRoles("SuperAdmin","Admin"), addUser);
router.post("/signin", signIn);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

// ───────────────────────────────────────────────────────────────────────────────
// Email Verification (matches your frontend service calls)
// ───────────────────────────────────────────────────────────────────────────────

// Send (or resend) a verification email for the currently signed-in user
router.post("/verify/send", requireAuth, sendVerificationEmail);

// Consume a verification token from email (visited in a separate tab/window)
// Note: no auth required because the link contains the signed token.
router.post("/verify/consume", consumeVerificationToken);

// Optional convenience (your frontend can also just call /auth/me)
router.get("/verify/status", optionalAuth, getVerificationStatus);

export default router;
