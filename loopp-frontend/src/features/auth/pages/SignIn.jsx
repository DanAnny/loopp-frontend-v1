import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signInThunk } from "../authSlice";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, X } from "lucide-react";

const TIPS = [
  "Use your work email to sign in.",
  "Stuck? Ping the PM in #it-support.",
  "Keep your password private. 🛡️",
];

export default function SignIn() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const { status, error } = useSelector((s) => s.auth);
  const [visibleTipIndex, setVisibleTipIndex] = useState(null);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [hideError, setHideError] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const emailValid = useMemo(() => /.+@.+\..+/.test(formData.email.trim()), [formData.email]);
  const passwordValid = useMemo(() => formData.password.trim().length >= 6, [formData.password]);
  const formValid = emailValid && passwordValid;
  const loading = status === "loading";

  useEffect(() => {
    let timer;
    if (loading && !error) {
      setVisibleTipIndex(0);
      timer = setInterval(() => {
        setVisibleTipIndex((prev) => ((prev ?? -1) + 1) % TIPS.length);
      }, 2800);
    } else {
      setVisibleTipIndex(null);
    }
    return () => clearInterval(timer);
  }, [loading, error]);

  useEffect(() => {
    if (!error) setHideError(false);
  }, [error]);

  function handleChange(e) {
    const { value, name } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }
  function handleBlur(e) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formValid || loading) return;
    const res = await dispatch(signInThunk(formData));
    if (signInThunk.fulfilled.match(res)) navigate(from, { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Decorative panel */}
      <div className="hidden lg:flex items-center justify-center flex-1 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          <div className="absolute -top-28 -right-24 h-80 w-80 bg-purple-200/50 blur-3xl rounded-full" />
          <div className="absolute bottom-10 left-10 h-96 w-96 bg-blue-200/50 blur-3xl rounded-full" />
          <div className="absolute top-1/3 left-1/3 h-24 w-24 bg-primary/10 rotate-45 rounded-2xl blur-xl" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="z-10 text-center max-w-md px-8"
        >
          <h1 className="text-3xl font-semibold text-slate-800 mb-3">
            Welcome back to Loopp
          </h1>
          <p className="text-slate-600 leading-relaxed">
            Sign in to manage projects, collaborate in chat, and keep your workflow moving.
          </p>
        </motion.div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 border border-slate-200"
        >
          {!!error && !hideError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg"
            >
              <span>{typeof error === "string" ? error : "Sign in failed"}</span>
              <button
                type="button"
                onClick={() => setHideError(true)}
                className="hover:bg-red-100 p-1 rounded"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          <h2 className="text-2xl font-semibold mb-2">Log in to your account</h2>
          <p className="text-slate-600 mb-6">
            Enter your credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@loopp.com"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className="w-full pl-9 pr-3 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>
              {touched.email && !emailValid && (
                <p className="text-xs text-red-600 mt-1">Please enter a valid email.</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className="w-full pl-9 pr-10 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {touched.password && !passwordValid && (
                <p className="text-xs text-red-600 mt-1">
                  Password must be at least 6 characters.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !formValid}
              className="w-full py-3 bg-black text-white rounded-lg hover:opacity-90 disabled:opacity-70 transition"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-sm text-slate-600 mt-6">
            Don’t have an account?{" "}
            <Link to="/signup" className="text-black underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>

      {loading && visibleTipIndex !== null && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-black text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <span className="border border-white/30 px-2 py-0.5 rounded-full text-xs uppercase tracking-wide">
              Tip
            </span>
            <p className="text-sm">{TIPS[visibleTipIndex]}</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
