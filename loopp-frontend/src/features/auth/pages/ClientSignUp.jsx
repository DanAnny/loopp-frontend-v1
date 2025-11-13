import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import authService from "@/services/auth.service";
import { apiClient, setAccessToken } from "@/services/http";
import { useDispatch } from "react-redux";
import { setAccess } from "@/features/auth/authSlice";
import { hardClientReset } from "@/lib/resetClientState";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Lock,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Sparkles,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

import CheckEmail from "../components/CheckEmail.jsx"; 

/* -------------------------------------------------------------------------- */
/*                           WP param persistence utils                       */
/* -------------------------------------------------------------------------- */
const WP_QS_STORAGE_KEY = "wpBridgeParams.v1";
const WP_QS_INJECT_FLAG = "wpBridgeParams.injected";

function saveWpParamsToSession(searchStr) {
  try {
    const clean = (searchStr || "").replace(/^\?/, "");
    if (clean) sessionStorage.setItem(WP_QS_STORAGE_KEY, clean);
  } catch {}
}
function getSavedWpParams() {
  try {
    return sessionStorage.getItem(WP_QS_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
function ensureUrlHasSavedParamsOnce(location, nav) {
  try {
    const already = sessionStorage.getItem(WP_QS_INJECT_FLAG);
    const saved = getSavedWpParams();
    if (!location.search && saved && !already) {
      sessionStorage.setItem(WP_QS_INJECT_FLAG, "1");
      nav(`${location.pathname}?${saved}`, { replace: true });
    }
  } catch {}
}

/* -------------------------- helpers & formatting -------------------------- */
const isPlaceholder = (v) =>
  typeof v === "string" && (/%[A-Za-z0-9_]+%/.test(v) || /^\{.*\}$/.test(v));
const safeDecodeTwice = (v) => {
  try {
    v = decodeURIComponent(v);
  } catch {}
  try {
    v = decodeURIComponent(v);
  } catch {}
  return v;
};

/* ----------------------------- Minimal overlays ----------------------------- */
function CreatingOverlay() {
  const steps = [
    {
      title: "Setting things up",
      note: "Preparing your workspace…",
      img: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=800&auto=format&fit=crop",
      alt: "Team collaborating in a workspace",
    },
    {
      title: "Creating the room",
      note: "setting things up for your chat room…",
      img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "creating the chat room",
    },
    {
      title: "Assigning a PM",
      note: "Finding the best available PM…",
      img: "https://images.unsplash.com/photo-1627634777217-c864268db30c?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Digital workspace and chat UI",
    },
  ];

  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((s) => (s + 1) % steps.length), 3000);
    return () => clearInterval(id);
  }, []);

  const current = steps[i];

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md text-center px-6"
      >
        <div className="rounded-2xl border border-black/10 bg-white/95 p-6 shadow-2xl">
          {current.img && (
            <div className="mb-4 overflow-hidden rounded-2xl">
              <img
                src={current.img}
                alt={current.alt || current.title}
                className="w-full h-40 object-cover"
              />
            </div>
          )}

          <h2 className="text-[1.05rem] font-semibold tracking-tight text-gray-900">
            {current.title}
          </h2>
          <p className="text-sm text-gray-600 mt-1">{current.note}</p>

          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:300ms]" />
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Hang tight — this only takes a moment.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function VerifiedCard({ email, onContinue }) {
  return (
    <div className="min-h-[50vh] grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm p-10 text-center border border-black/10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2} />
            </div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight mb-2">
            Email verified
          </h1>
          <p className="text-gray-600 mb-6">
            <span className="text-black font-medium">{email}</span> is confirmed.
          </p>

          <button
            onClick={onContinue}
            className="w-full bg-black text-white px-6 py-3 rounded-lg hover:-translate-y-0.5 hover:shadow transition"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export default function ClientSignUp() {
  const nav = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // stages: "form" | "verify" | "verified" | "creating"
  const [stage, setStage] = useState("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(undefined); // number|undefined

  /* 1) Persist WP params immediately, then hard-reset auth/session */
  useEffect(() => {
    saveWpParamsToSession(location.search);
    ensureUrlHasSavedParamsOnce(location, nav);

    (async () => {
      try {
        if (typeof authService.logout === "function") await authService.logout();
      } catch {}
      try {
        await hardClientReset();
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL params (from URL or saved copy)
  const qs = useMemo(
    () => new URLSearchParams(location.search || `?${getSavedWpParams()}`),
    [location.search]
  );

  const rawKey = qs.get("key") || "";
  const rawTitle = qs.get("title") || "";
  const rawFirst = qs.get("firstName") || "";
  const rawLast = qs.get("lastName") || "";
  const rawEmail = qs.get("email") || "";
  const rawDesc = qs.get("projectDescription") || "";
  const rawDate = qs.get("completionDate") || "";
  const verifyTokenFromURL = qs.get("verifyToken") || ""; // optional same-tab token

  const clientKey = isPlaceholder(rawKey) ? "" : rawKey.trim();
  const projectTitle = isPlaceholder(rawTitle) ? "" : safeDecodeTwice(rawTitle).trim();
  const firstNameFromURL = isPlaceholder(rawFirst) ? "" : rawFirst.trim();
  const lastNameFromURL = isPlaceholder(rawLast) ? "" : rawLast.trim();
  const emailFromURL = isPlaceholder(rawEmail) ? "" : rawEmail.trim();
  const projectDescription = isPlaceholder(rawDesc) ? "" : rawDesc.trim();
  const completionDate = isPlaceholder(rawDate) ? "" : rawDate.trim();

  const hasProjectParams = Boolean(clientKey);
  const missingCritical = !clientKey;

  const [form, setForm] = useState({
    firstName: firstNameFromURL,
    lastName: lastNameFromURL,
    email: emailFromURL,
    password: "",
    phone: "",
    gender: "",
  });
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  const mismatch = confirm && form.password !== confirm;

  // custom gender dropdown state
  const [genderOpen, setGenderOpen] = useState(false);
  const genderRef = useRef(null);
  const genderOptions = ["Male", "Female"];

  // close gender menu on outside click
  useEffect(() => {
    if (!genderOpen) return;
    const handleClick = (e) => {
      if (!genderRef.current) return;
      if (!genderRef.current.contains(e.target)) setGenderOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [genderOpen]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      email: prev.email || emailFromURL,
      firstName: prev.firstName || firstNameFromURL,
      lastName: prev.lastName || lastNameFromURL,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFromURL, firstNameFromURL, lastNameFromURL]);

  function onChange(e) {
    setErr("");
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function continueAfterVerified() {
    try {
      setCreating(true);
      setStage("creating");
      await apiClient.post("/projects/client/create", {
        clientKey,
        projectTitle,
        firstName: form.firstName || firstNameFromURL,
        lastName: form.lastName || lastNameFromURL,
        email: form.email || emailFromURL,
        projectDescription,
        completionDate,
      });
      window.location.replace("/client-chat");
    } catch (e) {
      setCreating(false);
      setStage("verify");
      setVerifyMsg(
        e?.response?.data?.message || e?.message || "Could not create project"
      );
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (loading || mismatch) return;

    if (missingCritical) {
      setErr(
        "No project was selected. Please go back and request a project before creating an account."
      );
      return;
    }

    setLoading(true);
    setErr("");
    setVerifyMsg("");
    setExpiresInHours(undefined);

    try {
      try {
        if (typeof authService.logout === "function") await authService.logout();
      } catch {}
      try {
        await hardClientReset();
      } catch {}

      // 1) Create account and capture verification info (avoid double-send)
      let signupVerification = { sent: false, expiresInHours: null };
      try {
        const signUpResp = await authService.signUpClient(form);
        const verification = signUpResp?.data?.verification || signUpResp?.verification;
        if (verification?.sent) {
          signupVerification.sent = true;
          signupVerification.expiresInHours = verification?.expiresInHours ?? null;
        }
      } catch {
        // ignore "already exists" etc — sign-in will handle next
      }

      // 2) Sign in
      const { data } = await authService.signIn({
        email: form.email,
        password: form.password,
      });
      if (!data?.success)
        throw new Error(data?.message || "Authentication failed");

      const token = data?.accessToken || data?.token || "";
      if (token) {
        setAccessToken(token);
        dispatch(setAccess(token));
      }

      // 3) Optional same-tab verify if verifyToken present in URL
      if (verifyTokenFromURL) {
        try {
          await authService.verifyEmailToken(verifyTokenFromURL);
        } catch {}
      }

      // 4) Check current user -> isVerified?
      const profile = await authService.me();
      const user = profile?.user || profile;
      const isVerified = !!user?.isVerified;
      setPendingEmail(user?.email || form.email);

      if (!isVerified) {
        // If backend already sent email during sign-up, don't resend
        if (signupVerification.sent) {
          if (typeof signupVerification.expiresInHours === "number") {
            setExpiresInHours(signupVerification.expiresInHours);
          }
          setVerifyMsg("Verification email sent. Check your inbox.");
          setStage("verify");
          return;
        }

        // Otherwise, request a send now
        try {
          const sv = await authService.sendVerificationEmail();
          if (typeof sv?.expiresInHours === "number")
            setExpiresInHours(sv.expiresInHours);
          if (sv?.message) setVerifyMsg(sv.message);
        } catch (eSend) {
          setVerifyMsg(
            eSend?.response?.data?.message ||
              eSend?.message ||
              "Could not send verification email"
          );
        }
        setStage("verify");
        return;
      }

      // Already verified → proceed
      await continueAfterVerified();
    } catch (eMain) {
      setErr(
        eMain?.response?.data?.message || eMain?.message || "Sign up failed"
      );
    } finally {
      setLoading(false);
    }
  }

  // Resend → show backend expiry again if provided
  const handleResend = async () => {
    setVerifyMsg("");
    setExpiresInHours(undefined);
    try {
      const data = await authService.resendVerificationEmail?.();
      if (typeof data?.expiresInHours === "number")
        setExpiresInHours(data.expiresInHours);
      setVerifyMsg(data?.message || "Verification email sent.");
    } catch (e) {
      setVerifyMsg(
        e?.response?.data?.message || e?.message || "Could not resend email"
      );
    }
  };

  // “I’ve verified” → re-check via /auth/me, then advance
  const handleIHaveVerified = async () => {
    setVerifyMsg("");
    try {
      const profile = await authService.me();
      const user = profile?.user || profile;
      if (user?.isVerified) {
        setStage("verified");
        await continueAfterVerified();
      } else {
        setVerifyMsg(
          "Still not verified yet. Please click the link in your email."
        );
      }
    } catch (e) {
      setVerifyMsg(
        e?.response?.data?.message || e?.message || "Could not check status"
      );
    }
  };

  // Auto-handle same-tab verify if verifyToken in URL after mount
  useEffect(() => {
    const go = async () => {
      if (!verifyTokenFromURL) return;
      try {
        await authService.verifyEmailToken(verifyTokenFromURL);
        const profile = await authService.me();
        const user = profile?.user || profile;
        if (user?.isVerified) {
          setPendingEmail(user.email);
          setStage("verified");
          await continueAfterVerified();
        }
      } catch {}
    };
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔔 Auto-continue on verification (same-browser events + cross-browser polling)
  useEffect(() => {
    let alive = true;

    const proceedIfVerified = async () => {
      try {
        const profile = await authService.me();
        const user = profile?.user || profile;
        if (user?.isVerified && alive) {
          setPendingEmail(user.email || form.email);
          setStage("verified");
          await continueAfterVerified();
        }
      } catch {}
    };

    // 1) storage event (other tab in same browser)
    const onStorage = (e) => {
      if (e.key === "loopp.emailVerified") proceedIfVerified();
    };

    // 2) postMessage (if verify tab was opened via window.open, or same tab posts back)
    const onMessage = (e) => {
      if (e?.data?.type === "EMAIL_VERIFIED") proceedIfVerified();
    };

    // 3) BroadcastChannel (modern same-browser cross-tab)
    let bc;
    try {
      bc = new BroadcastChannel("loopp-events");
      bc.onmessage = (e) => {
        if (e?.data?.type === "EMAIL_VERIFIED") proceedIfVerified();
      };
    } catch {}

    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);

    // 4) ✅ Cross-browser/device fallback: poll /auth/me while on "verify" stage
    const pollId = setInterval(() => {
      if (stage === "verify" && !creating) proceedIfVerified();
    }, 3500);

    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
      try {
        if (bc) bc.close();
      } catch {}
      clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, creating, form.email]);

  /* ------------------------ main signup form (default) ----------------------- */

  const floatedLabel =
    "absolute left-11 pointer-events-none transition-all " +
    "px-1 bg-white/90 rounded " +
    "top-0 -translate-y-1/2 text-[12px] text-gray-500 " +
    "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 " +
    "peer-placeholder-shown:text-[14px] peer-placeholder-shown:px-0 peer-placeholder-shown:bg-transparent " +
    "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[12px] peer-focus:px-1 peer-focus:bg-white/90";

  /* ---------- stage UIs ---------- */
  if (stage === "verify" && !creating) {
    return (
      <CheckEmail
        email={pendingEmail || form.email}
        expiresInHours={expiresInHours}
        info={verifyMsg || null}
        onResendEmail={handleResend}
        onIHaveVerified={handleIHaveVerified}
      />
    );
  }

  if (stage === "verified" && !creating) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-gray-50 via-white to-[#fdcece]/20">
        <div className="max-w-3xl mx-auto p-6">
          <VerifiedCard
            email={pendingEmail || form.email}
            onContinue={continueAfterVerified}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-white flex antialiased">
      {creating && <CreatingOverlay />}

      {/* MAIN CONTENT (dimmed & non-interactive when no project key) */}
      <div
        className={`flex w-full ${
          !hasProjectParams ? "pointer-events-none" : ""
        }`}
        aria-hidden={!hasProjectParams}
      >
        {/* Left Panel (brand) */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-gray-900 via-gray-800 to-black p-12 items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
                `,
                backgroundSize: "50px 50px",
              }}
            />
          </div>

          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-[#fdcece] rounded-full blur-3xl opacity-50"
          />
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-black rounded-full blur-3xl opacity-40"
          />

          <div className="relative z-10 max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mb-8 inline-flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-black to-[#fdcece]" />
                </div>
                <span className="text-white text-2xl tracking-tight">Loopp</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-[40px] leading-[1.1] text-white mb-4 tracking-tight"
              >
                Create Your Account
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-[18px] text-gray-300 mb-12 leading-relaxed"
              >
                Join Loopp and bring your ideas to life with expert PMs and
                engineers in real time.
              </motion.p>
            </motion.div>
          </div>
        </div>

        {/* Right Panel — locked to 100vh */}
        <div className="flex-1 relative h-screen overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-[#fdcece]/20" />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.06, 0.03] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 right-0 w-96 h-96 bg-[#fdcece] rounded-full blur-3xl"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.02, 0.05, 0.02] }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            className="absolute bottom-0 left-0 w-80 h-80 bg-black rounded-full blur-3xl opacity-10"
          />

          <div className="relative z-10 h-full grid place-items-center px-6">
            <div className="w-full max-w-md">
              {/* Error banner */}
              <AnimatePresence>
                {err && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {err}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Auth card */}
              <div className="relative">
                <div className="absolute -inset-1 bg-[conic-gradient(at_top_left,#000,#fdcece,#000)] rounded-3xl blur-xl opacity-10" />
                <div className="relative rounded-3xl border border-white/20 bg-white/85 backdrop-blur-xl shadow-2xl">
                  <div className="h-1.5 w-full rounded-t-3xl bg-gradient-to-r from-black via-black to-[#fdcece]" />
                  <div className="p-6 md:p-8">
                    <div className="mb-6 text-center">
                      <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[26px] font-bold tracking-tight text-gray-900"
                      >
                        Create your account
                      </motion.h1>
                      <p className="mt-1 text-[13px] text-gray-600">
                        Join Loopp and bring your ideas to life.
                      </p>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-4">
                      {/* Names */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <User className="w-5 h-5" />
                          </div>
                          <input
                            id="firstName"
                            name="firstName"
                            value={form.firstName}
                            onChange={onChange}
                            placeholder=" "
                            className="peer w-full h-12 rounded-xl border-2 bg-white/60 pl-11 pr-3 text-[15px] tracking-tight text-gray-900 outline-none transition placeholder-transparent focus:border-black focus:ring-4 focus:ring-black/10 border-gray-200 hover:border-gray-300"
                            required
                            disabled={!hasProjectParams || creating}
                          />
                          <label htmlFor="firstName" className={floatedLabel}>
                            First name
                          </label>
                        </div>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <User className="w-5 h-5" />
                          </div>
                          <input
                            id="lastName"
                            name="lastName"
                            value={form.lastName}
                            onChange={onChange}
                            placeholder=" "
                            className="peer w-full h-12 rounded-xl border-2 bg-white/60 pl-11 pr-3 text-[15px] tracking-tight text-gray-900 outline-none transition placeholder-transparent focus:border-black focus:ring-4 focus:ring-black/10 border-gray-200 hover:border-gray-300"
                            required
                            disabled={!hasProjectParams || creating}
                          />
                          <label htmlFor="lastName" className={floatedLabel}>
                            Last name
                          </label>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <Mail className="w-5 h-5" />
                        </div>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={onChange}
                          placeholder=" "
                          className="peer w-full h-12 rounded-xl border-2 bg-white/60 pl-11 pr-3 text-[15px] tracking-tight text-gray-900 outline-none transition placeholder-transparent focus:border-black focus:ring-4 focus:ring-black/10 border-gray-200 hover:border-gray-300"
                          required
                          disabled={!hasProjectParams || creating}
                        />
                        <label htmlFor="email" className={floatedLabel}>
                          Email
                        </label>
                      </div>

                      {/* Phone + Gender */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Phone */}
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <Phone className="w-5 h-5" />
                          </div>
                          <input
                            id="phone"
                            name="phone"
                            value={form.phone}
                            onChange={onChange}
                            placeholder=" "
                            className="peer w-full h-12 rounded-xl border-2 bg-white/60 pl-11 pr-10 text-[15px] tracking-tight text-gray-900 outline-none transition placeholder-transparent focus:border-black focus:ring-4 focus:ring-black/10 border-gray-200 hover:border-gray-300"
                            required
                            disabled={!hasProjectParams || creating}
                          />
                          <label htmlFor="phone" className={floatedLabel}>
                            Phone
                          </label>
                        </div>

                        {/* Gender – custom dropdown with black highlight */}
                        <div className="relative" ref={genderRef}>
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <User className="w-5 h-5" />
                          </div>

                          <label
                            htmlFor="gender-button"
                            className="absolute left-11 -top-2 text-[12px] text-gray-500 px-1 bg-white/90 rounded"
                          >
                            Gender
                          </label>

                          <button
                            id="gender-button"
                            type="button"
                            onClick={() => {
                              if (!hasProjectParams || creating) return;
                              setGenderOpen((o) => !o);
                            }}
                            className={`mt-1 w-full h-12 rounded-xl border-2 bg-white/60 pl-11 pr-10 text-left text-[15px] tracking-tight outline-none transition
                              ${
                                !hasProjectParams || creating
                                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                                  : "border-gray-200 hover:border-gray-300 focus:border-black focus:ring-4 focus:ring-black/10"
                              }`}
                            aria-haspopup="listbox"
                            aria-expanded={genderOpen}
                            disabled={!hasProjectParams || creating}
                          >
                            <span
                              className={
                                form.gender ? "text-gray-900" : "text-gray-400"
                              }
                            >
                              {form.gender || "Select gender"}
                            </span>
                          </button>

                          <ChevronDown
                            className={`pointer-events-none absolute right-3 top-[calc(50%+6px)] -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform ${
                              genderOpen ? "rotate-180" : ""
                            }`}
                          />

                          {genderOpen && (
                            <div
                              className="absolute z-20 mt-1 w-full rounded-xl border-2 border-black bg-black shadow-lg overflow-hidden"
                              role="listbox"
                              aria-label="Select gender"
                            >
                              {genderOptions.map((opt) => {
                                const active = form.gender === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    onClick={() => {
                                      setForm((p) => ({ ...p, gender: opt }));
                                      setGenderOpen(false);
                                    }}
                                    className={`w-full text-left px-11 pr-10 py-2 text-[14px] transition
                                      ${
                                        active
                                          ? "bg-black text-white"
                                          : "bg-black/80 text-white hover:bg-black"
                                      }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Password */}
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <Lock className="w-5 h-5" />
                        </div>
                        <input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          value={form.password}
                          onChange={onChange}
                          placeholder=" "
                          className="peer w-full h-12 rounded-xl border-2 bg-white/60 pl-11 pr-3 text-[15px] tracking-tight text-gray-900 outline-none transition placeholder-transparent focus:border-black focus:ring-4 focus:ring-black/10 border-gray-200 hover:border-gray-300"
                          required
                          disabled={!hasProjectParams || creating}
                        />
                        <label htmlFor="password" className={floatedLabel}>
                          Password
                        </label>
                      </div>

                      {/* Confirm */}
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <Lock className="w-5 h-5" />
                        </div>
                        <input
                          id="confirm"
                          name="confirm"
                          type="password"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          placeholder=" "
                          className={`peer w-full h-12 rounded-xl border-2 bg-white/60 pl-11 pr-3 text-[15px] tracking-tight text-gray-900 outline-none transition placeholder-transparent focus:ring-4
                            ${
                              mismatch
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                                : "border-gray-200 hover:border-gray-300 focus:border-black focus:ring-black/10"
                            }`}
                          required
                          disabled={!hasProjectParams || creating}
                        />
                        <label htmlFor="confirm" className={floatedLabel}>
                          Confirm password
                        </label>
                        {mismatch && (
                          <p className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Passwords do not
                            match.
                          </p>
                        )}
                      </div>

                      {/* Submit */}
                      <motion.button
                        type="submit"
                        disabled={
                          loading || mismatch || !hasProjectParams || creating
                        }
                        whileHover={
                          !loading && !mismatch && hasProjectParams && !creating
                            ? { scale: 1.01 }
                            : undefined
                        }
                        whileTap={
                          !loading && !mismatch && hasProjectParams && !creating
                            ? { scale: 0.99 }
                            : undefined
                        }
                        className="group relative flex w-full items-center justify-center h-12 rounded-xl border border-black bg-black px-4 font-semibold text-white tracking-tight transition disabled:cursor-not-allowed disabled:opacity-70 hover:shadow-lg hover:-translate-y-0.5"
                      >
                        <span className="flex items-center gap-2">
                          {loading ? "Loading…" : "Sign up"}
                          {!loading && (
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          )}
                        </span>
                      </motion.button>

                      {/* Switch to sign in (preserves query) */}
                      <p className="text-xs text-gray-600 text-center">
                        Already have an account?{" "}
                        <Link
                          to={`/client-sign-in${
                            (location.search || `?${getSavedWpParams()}`)
                              ? `?${(
                                  location.search ||
                                  `?${getSavedWpParams()}`
                                ).replace(/^\?/, "")}`
                              : ""
                          }`}
                          className="underline decoration-black/50 underline-offset-2 hover:decoration-black"
                        >
                          Sign in
                        </Link>
                      </p>
                    </form>

                    {hasProjectParams && !creating && (
                      <div className="mt-4 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70">
                        After signing up and verifying your email, we’ll create
                        your project and open chat.
                      </div>
                    )}

                    <p className="mt-5 text-center text-[11px] text-gray-400">
                      Email verification links may expire — if your link is
                      expired, request a new one.
                    </p>
                  </div>
                </div>
              </div>
              {/* /card */}
            </div>
          </div>
        </div>
      </div>

      {/* FULL-PAGE ACTION REQUIRED OVERLAY */}
      <AnimatePresence>
        {!hasProjectParams && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300]"
          >
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[6px]" />
            <div className="relative z-10 h-full grid place-items-center p-6">
              <div className="w-full max-w-md rounded-2xl p-[1px] bg-[conic-gradient(at_top_left,#000,#fdcece,#000)] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.45)]">
                <div className="rounded-2xl bg-white/95 backdrop-blur-xl p-5 md:p-6 border border-black/10">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-[#fdcece]/60 text-black grid place-items-center border border-black/10">
                        <Briefcase className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="inline-flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] rounded-full bg-black text-white font-medium">
                          Action Required
                        </span>
                        <Sparkles className="w-4 h-4 text-black/70" />
                      </div>
                      <h3 className="mt-2 text-[15px] font-semibold text-gray-900 tracking-tight">
                        Select a project to continue
                      </h3>
                      <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
                        It looks like no project key was found. To complete your
                        signup and unlock your workspace with a dedicated
                        Project Manager, please select a project first.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href="https://angelmap.foundryradar.com/"
                          className="inline-flex items-center gap-2 rounded-xl bg-black text-white text-xs font-semibold px-3.5 py-2 transition hover:-translate-y-0.5 hover:shadow-lg"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Explore our services
                        </a>
                        <Link
                          to="https://angelmap.foundryradar.com/hire-an-engineer/"
                          className="inline-flex items-center gap-2 rounded-xl border border-black/20 bg-white text-gray-900 text-xs font-semibold px-3.5 py-2 transition hover:border-black"
                        >
                          Hire an AI Engineer
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-white/80">
                The page is locked until a project is selected.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
