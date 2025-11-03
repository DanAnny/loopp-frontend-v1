// src/features/auth/pages/SignIn.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signInThunk } from "../authSlice";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, X, CheckCircle2, ArrowRight } from "lucide-react";
import Logo from "../components/Logo.jsx";

/* ----------------------------- UI-only constants ---------------------------- */
const TIPS = [
  "Use your work email to sign in.",
  "Keep your password private. 🛡️",
];

const FEATURES = [
  "Secure authentication",
  "Real-time collaboration",
  "Advanced project management",
];

export default function SignIn() {
  /* --------------------------------- state --------------------------------- */
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const { status, error } = useSelector((s) => s.auth);
  const [visibleTipIndex, setVisibleTipIndex] = useState(null);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [hideError, setHideError] = useState(false);

  /* ------------------------------- navigation ------------------------------ */
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  /* ------------------------------ validations ------------------------------ */
  const emailValid = useMemo(() => /.+@.+\..+/.test(formData.email.trim()), [formData.email]);
  const passwordLen = formData.password.trim().length;
  const passwordValid = useMemo(() => passwordLen >= 6, [passwordLen]);
  const formValid = emailValid && passwordValid;
  const loading = status === "loading";

  /* ------------------------------- tip ticker ------------------------------- */
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

  /* ------------------------------ error toggle ------------------------------ */
  useEffect(() => {
    if (!error) setHideError(false);
  }, [error]);

  /* -------------------------------- handlers -------------------------------- */
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

  /* ----------------------------------- UI ----------------------------------- */
  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden relative">
      {/* Background Image - Only on small screens (right panel hidden) */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none lg:hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.15)), url('https://images.unsplash.com/photo-1640109341881-1cd3eaf50909?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080')",
        }}
      />
      {/* Mobile overlays + animated orbs for subtle depth */}
      <div className="absolute inset-0 pointer-events-none lg:hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black/15 via-transparent to-black/25" />
        <motion.div
          className="absolute top-20 right-10 w-64 h-64 bg-white/25 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.18, 0.28, 0.18] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-80 h-80 bg-black/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <div className="absolute inset-0 bg-white/30 backdrop-blur-sm" />
      </div>

      {/* Left Panel — Form card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative z-10">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Brand */}
          <div className="mb-8">
            <Logo />
          </div>

          {/* Error banner (preserves dismiss + redux error) */}
          {!!error && !hideError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg"
            >
              <span className="text-sm">
                {typeof error === "string" ? error : "Sign in failed"}
              </span>
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

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6"
          >
            <h2 className="text-3xl mb-2">Log in to your account</h2>
            <p className="text-slate-500">Please enter your details</p>
          </motion.div>

          {/* Form Card */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-5 bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 shadow-xl shadow-black/5"
          >
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm mb-2">
                Email
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 group-hover:text-black transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@loopp.com"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-300 bg-white/80 backdrop-blur-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all shadow-sm hover:shadow-md hover:border-slate-400"
                  required
                />
              </div>
              {touched.email && !emailValid && (
                <p className="text-xs text-red-600 mt-1.5">Please enter a valid email address</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-end justify-between mb-2">
                <label htmlFor="password" className="block text-sm">
                  Password
                </label>
                {/* Live hint when below minimum */}
                <span
                  className={`text-xs ${
                    passwordLen > 0 && passwordLen < 6 ? "text-red-600" : "text-slate-400"
                  }`}
                  aria-live="polite"
                >
                  {passwordLen > 0 && passwordLen < 6
                    ? `Minimum 6 characters (${passwordLen}/6)`
                    : ""}
                </span>
              </div>

              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 group-hover:text-black transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full pl-11 pr-11 py-3 rounded-lg border bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-black/10 transition-all shadow-sm hover:shadow-md ${
                    touched.password && !passwordValid && passwordLen > 0
                      ? "border-red-400 focus:border-red-600"
                      : "border-slate-300 hover:border-slate-400 focus:border-black"
                  }`}
                  required
                  aria-invalid={touched.password && !passwordValid ? "true" : "false"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-700 hover:text-black transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Error/help text under password */}
              {touched.password && !passwordValid && passwordLen > 0 && (
                <p className="text-xs text-red-600 mt-1.5" aria-live="assertive">
                  Password must be at least 6 characters.
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !formValid}
              className="w-full py-3.5 bg-gradient-to-r from-black to-slate-800 text-white rounded-lg hover:shadow-lg hover:shadow-black/20 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2 relative z-10">
                  <Loader2 className="w-5 h-5 animate-spin" /> Signing in…
                </span>
              ) : (
                <>
                  <span className="relative z-10">Log in</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform relative z-10" />
                </>
              )}
            </button>
          </motion.form>

          {/* Sign Up Link */}
          {/* <motion.p
            className="text-center text-sm text-slate-600 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            Don’t have an account?{" "}
            <Link to="/signup" className="text-black hover:underline font-medium transition-colors">
              Sign up
            </Link>
          </motion.p> */}
        </motion.div>
      </div>

      {/* Right Panel — Branding (desktop only) */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8">
        <div
          className="w-full h-full bg-black rounded-3xl p-12 flex items-center justify-center relative overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,.72), rgba(0,0,0,.72)), url('https://images.unsplash.com/photo-1759884247264-86c2aa311632?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600')",
          }}
        >
          {/* Decorative blur glows */}
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative z-10 max-w-lg"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-full text-white text-xs mb-8">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span>Welcome back</span>
            </div>

            <h2 className="text-4xl text-white mb-4">Empowering healthier communities</h2>
            <p className="text-slate-300 text-lg mb-12 leading-relaxed">
              Welcome back to Loopp. Manage projects, collaborate with your team, and deliver
              exceptional results.
            </p>

            {/* Feature bullets (purely visual) */}
            <div className="space-y-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                  className="flex items-center gap-3 text-white"
                >
                  <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />
                  <span className="text-slate-200">{f}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Loading tips toast (unchanged logic) */}
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
