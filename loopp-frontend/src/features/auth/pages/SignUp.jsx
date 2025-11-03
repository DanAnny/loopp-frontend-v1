// src/features/auth/pages/SignUp.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useDispatch } from "react-redux";
import { signInThunk } from "../authSlice";
import * as Auth from "@/services/auth.service";
import {
  UserRound,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Circle,
  XCircle,
} from "lucide-react";
import Logo from "../components/Logo.jsx";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */
const GENDERS = ["Male", "Female"]; // updated: only Male/Female

const BENEFITS = [
  "Complete system control and configuration",
  "User management and role assignment",
  "Advanced security and audit logs",
];

export default function SignUp() {
  /* ---------------------------------------------------------------------- */
  /* State                                                                  */
  /* ---------------------------------------------------------------------- */
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    password: "",
    confirm: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [touched, setTouched] = useState({});

  const dispatch = useDispatch();
  const navigate = useNavigate();

  /* ---------------------------------------------------------------------- */
  /* Validation                                                             */
  /* ---------------------------------------------------------------------- */
  const emailValid = useMemo(() => /.+@.+\..+/.test(form.email.trim()), [form.email]);
  const firstValid = useMemo(() => form.firstName.trim().length >= 2, [form.firstName]);
  const lastValid = useMemo(() => form.lastName.trim().length >= 2, [form.lastName]);
  const phoneValid = useMemo(() => /^\+?[0-9\s-()]{7,}$/.test(form.phone.trim()), [form.phone]);
  const genderValid = useMemo(() => GENDERS.includes(form.gender), [form.gender]);

  const passMin = useMemo(() => form.password.length >= 6, [form.password]);
  const passHasNum = useMemo(() => /\d/.test(form.password), [form.password]);
  const passHasCase = useMemo(
    () => /([a-z].*[A-Z])|([A-Z].*[a-z])/.test(form.password),
    [form.password]
  );

  // Live match check: runs immediately as user types in either field
  const match = useMemo(
    () => !!form.password && !!form.confirm && form.password === form.confirm,
    [form.password, form.confirm]
  );
  const showMismatch = useMemo(
    () => !!form.confirm && form.password !== form.confirm, // immediate feedback when confirm has any value
    [form.password, form.confirm]
  );

  const formValid =
    firstValid &&
    lastValid &&
    emailValid &&
    phoneValid &&
    genderValid &&
    passMin &&
    passHasNum &&
    passHasCase &&
    match;

  // Visual password strength (3 bars)
  const getPasswordStrength = () => {
    if (!passMin) return "red";
    if (passMin && !passHasNum && !passHasCase) return "yellow";
    if (passMin && passHasNum && !passHasCase) return "amber";
    if (passMin && passHasNum && passHasCase) return "green";
    return "red";
  };
  const strengthColor = getPasswordStrength();
  const getStrengthColor = (level) => {
    if (strengthColor === "red") return level <= 1 ? "bg-red-500" : "bg-slate-200";
    if (strengthColor === "yellow") return level <= 2 ? "bg-yellow-400" : "bg-slate-200";
    if (strengthColor === "amber") return level <= 2 ? "bg-yellow-600" : "bg-slate-200";
    if (strengthColor === "green") return level <= 3 ? "bg-green-500" : "bg-slate-200";
    return "bg-slate-200";
  };

  /* ---------------------------------------------------------------------- */
  /* Handlers                                                               */
  /* ---------------------------------------------------------------------- */
  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErr("");
  }
  function onBlur(e) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!formValid || loading) return;
    setLoading(true);
    setErr("");

    try {
      // Create user (keep original logic)
      await Auth.signupSuperAdmin({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        password: form.password, // keep if backend expects it
      });

      // Auto sign-in so user lands inside app
      const res = await dispatch(signInThunk({ email: form.email, password: form.password }));
      if (signInThunk.fulfilled.match(res)) {
        navigate("/", { replace: true });
      } else {
        setErr(res.payload?.message || "Sign in after signup failed");
      }
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* UI                                                                     */
  /* ---------------------------------------------------------------------- */
  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden relative">
      {/* Background Image - only on mobile/tablet when right panel hidden */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none lg:hidden"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1587522630593-3b9e5f3255f2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080')",
        }}
      />
      {/* Mobile overlays for readability + subtle motion */}
      <div className="absolute inset-0 pointer-events-none lg:hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/30" />
        <motion.div
          className="absolute top-20 right-10 w-64 h-64 bg-white/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-80 h-80 bg-black/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <div className="absolute inset-0 bg-white/30 backdrop-blur-sm" />
      </div>

      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl relative"
        >
          {/* Logo/Brand */}
          <motion.div
            className="mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Logo />
          </motion.div>

          {/* Heading */}
          <motion.div
            className="mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl mb-1">Initialize Super Admin</h2>
            <p className="text-slate-500 text-sm">
              Set up the primary administrator account for Loopp
            </p>
          </motion.div>

          {/* Error */}
          {err && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm"
            >
              {err}
            </motion.div>
          )}

          {/* Form */}
          <motion.form
            onSubmit={onSubmit}
            className="space-y-3 bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 shadow-xl shadow-black/5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {/* Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* First Name */}
              <div className="group">
                <label htmlFor="firstName" className="block text-sm mb-1">
                  First name
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-black transition-colors">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Jane"
                    value={form.firstName}
                    onChange={onChange}
                    onBlur={onBlur}
                    className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white/80 backdrop-blur-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all shadow-sm hover:shadow-md hover:border-slate-400"
                    required
                  />
                </div>
                {touched.firstName && !firstValid && form.firstName && (
                  <p className="text-xs text-red-600 mt-1.5">At least 2 characters required</p>
                )}
              </div>

              {/* Last Name */}
              <div className="group">
                <label htmlFor="lastName" className="block text-sm mb-1">
                  Last name
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-black transition-colors">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Cooper"
                    value={form.lastName}
                    onChange={onChange}
                    onBlur={onBlur}
                    className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white/80 backdrop-blur-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all shadow-sm hover:shadow-md hover:border-slate-400"
                    required
                  />
                </div>
                {touched.lastName && !lastValid && form.lastName && (
                  <p className="text-xs text-red-600 mt-1.5">At least 2 characters required</p>
                )}
              </div>
            </div>

            {/* Contact Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Email */}
              <div className="group">
                <label htmlFor="email" className="block text-sm mb-1">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-black transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@loopp.com"
                    value={form.email}
                    onChange={onChange}
                    onBlur={onBlur}
                    className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white/80 backdrop-blur-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all shadow-sm hover:shadow-md hover:border-slate-400"
                    required
                  />
                </div>
                {touched.email && !emailValid && form.email && (
                  <p className="text-xs text-red-600 mt-1.5">Enter a valid email address</p>
                )}
              </div>

              {/* Phone */}
              <div className="group">
                <label htmlFor="phone" className="block text-sm mb-1">
                  Phone
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-black transition-colors">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+234 801 234 5678"
                    value={form.phone}
                    onChange={onChange}
                    onBlur={onBlur}
                    className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white/80 backdrop-blur-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all shadow-sm hover:shadow-md hover:border-slate-400"
                    required
                  />
                </div>
                {touched.phone && !phoneValid && form.phone && (
                  <p className="text-xs text-red-600 mt-1.5">Enter a valid phone number</p>
                )}
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm mb-1">Gender</label>
              <div className="grid grid-cols-2 gap-3">
                {GENDERS.map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setForm((p) => ({ ...p, gender: g }))}
                    className={`py-2.5 px-4 rounded-lg border transition-all shadow-sm hover:shadow-md ${
                      form.gender === g
                        ? "border-black bg-black text-white shadow-lg shadow-black/10"
                        : "border-slate-300 hover:border-slate-400 bg-white/80 backdrop-blur-sm"
                    }`}
                    aria-pressed={form.gender === g}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {touched.gender && !genderValid && (
                <p className="text-xs text-red-600 mt-1.5">Please select a gender</p>
              )}
            </div>

            {/* Password Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Password */}
              <div className="group">
                <label htmlFor="password" className="block text-sm mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-black transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPass ? "text" : "password"}
                    placeholder="Create password"
                    value={form.password}
                    onChange={onChange}
                    onBlur={onBlur}
                    className="w-full pl-11 pr-11 py-2.5 rounded-lg border border-slate-300 bg-white/80 backdrop-blur-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all shadow-sm hover:shadow-md hover:border-slate-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black transition-colors"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Password Strength */}
                {form.password && (
                  <div className="mt-1.5">
                    <div className="flex gap-1 mb-1.5">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${getStrengthColor(
                            level
                          )}`}
                        />
                      ))}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div
                        className={`flex items-center gap-1.5 ${
                          passMin ? "text-black" : "text-slate-500"
                        }`}
                      >
                        {passMin ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Circle className="w-3 h-3" />
                        )}
                        <span>At least 6 characters</span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${
                          passHasNum ? "text-black" : "text-slate-500"
                        }`}
                      >
                        {passHasNum ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Circle className="w-3 h-3" />
                        )}
                        <span>Contains a number</span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${
                          passHasCase ? "text-black" : "text-slate-500"
                        }`}
                      >
                        {passHasCase ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Circle className="w-3 h-3" />
                        )}
                        <span>Upper and lowercase letters</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password — live matching */}
              <div className="group">
                <label htmlFor="confirm" className="block text-sm mb-1">
                  Confirm password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-black transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="confirm"
                    name="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm password"
                    value={form.confirm}
                    onChange={onChange}
                    onBlur={onBlur}
                    className={`w-full pl-11 pr-11 py-2.5 rounded-lg border bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-black/10 transition-all shadow-sm hover:shadow-md ${
                      showMismatch
                        ? "border-red-400 focus:border-red-600"
                        : match && form.confirm
                        ? "border-green-500 focus:border-green-600"
                        : "border-slate-300 hover:border-slate-400 focus:border-black"
                    }`}
                    required
                    aria-invalid={showMismatch ? "true" : "false"}
                    aria-describedby="confirmHelp"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black transition-colors"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>

                  {/* Live status icon on the far right (inside input) */}
                  {form.confirm ? (
                    match ? (
                      <CheckCircle2
                        className="w-5 h-5 text-green-600 absolute right-10 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle
                        className="w-5 h-5 text-red-600 absolute right-10 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                    )
                  ) : null}
                </div>

                {/* Immediate helper/error text */}
                <p
                  id="confirmHelp"
                  className={`text-xs mt-1.5 ${
                    showMismatch
                      ? "text-red-600"
                      : match && form.confirm
                      ? "text-green-600"
                      : "text-slate-500"
                  }`}
                  aria-live="polite"
                >
                  {showMismatch
                    ? "Passwords do not match"
                    : match && form.confirm
                    ? "Passwords match"
                    : "Re-enter the same password"}
                </p>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!formValid || loading}
              className="w-full py-3 bg-gradient-to-r from-black to-slate-800 text-white rounded-lg hover:shadow-lg hover:shadow-black/20 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none transition-all flex items-center justify-center gap-2 group mt-4 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10" />
                  <span className="relative z-10">Creating account...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Create account</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform relative z-10" />
                </>
              )}
            </button>
          </motion.form>

          {/* Sign In Link */}
          <motion.p
            className="text-center text-sm text-slate-600 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            Already have an account?{" "}
            <Link to="/signin" className="text-black hover:underline font-medium transition-colors">
              Sign in
            </Link>
          </motion.p>
        </motion.div>
      </div>

      {/* Right Panel - Branding (desktop) */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8">
        <div
          className="w-full h-full bg-black rounded-3xl p-12 flex items-center justify-center relative overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,.6), rgba(0,0,0,.6)), url('https://images.unsplash.com/photo-1564518534518-e79657852a1a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080')",
          }}
        >
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative z-10 max-w-lg"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-full text-white text-xs mb-8">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span>One-time setup</span>
            </div>

            <h2 className="text-4xl text-white mb-4">Welcome to Loopp</h2>
            <p className="text-slate-300 text-lg mb-12 leading-relaxed">
              Initialize your platform by creating the Super Admin account. This is the foundational
              step to configure and manage your entire system.
            </p>

            <div className="space-y-4">
              {BENEFITS.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                  className="flex items-center gap-3 text-white"
                >
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-slate-200">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
