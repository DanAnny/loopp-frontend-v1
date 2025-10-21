import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useDispatch } from "react-redux";
import { signInThunk } from "../authSlice";
import * as Auth from "@/services/auth.service";
import {
  UserRound, Mail, Phone, ShieldCheck, Eye, EyeOff, Loader2, Sparkles,
} from "lucide-react";

const GENDERS = ["Male", "Female", "Other"];

export default function SignUp() {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", gender: "",
    password: "", confirm: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // simple validations
  const emailValid = useMemo(() => /.+@.+\..+/.test(form.email.trim()), [form.email]);
  const firstValid = useMemo(() => form.firstName.trim().length >= 2, [form.firstName]);
  const lastValid  = useMemo(() => form.lastName.trim().length >= 2, [form.lastName]);
  const phoneValid = useMemo(() => /^\+?[0-9\s-()]{7,}$/.test(form.phone.trim()), [form.phone]);
  const genderValid = useMemo(() => GENDERS.includes(form.gender), [form.gender]);

  const passMin = useMemo(() => form.password.length >= 6, [form.password]);
  const passHasNum = useMemo(() => /\d/.test(form.password), [form.password]);
  const passHasCase = useMemo(() => /([a-z].*[A-Z])|([A-Z].*[a-z])/.test(form.password), [form.password]);
  const match = useMemo(() => form.password && form.password === form.confirm, [form.password, form.confirm]);

  const formValid = firstValid && lastValid && emailValid && phoneValid && genderValid && passMin && passHasNum && passHasCase && match;

  const strength = [passMin, passHasNum, passHasCase, match].filter(Boolean).length;

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!formValid || loading) return;
    setLoading(true);
    setErr("");

    try {
      // Create user
      // If your backend doesn't need password here, remove password/confirm from payload.
      await Auth.signupSuperAdmin({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        password: form.password, // ← remove if not expected
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

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Left: Brand panel */}
      <div className="hidden lg:flex items-center justify-center relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          <div className="absolute -top-28 -left-24 h-80 w-80 bg-emerald-200/50 blur-3xl rounded-full" />
          <div className="absolute bottom-10 right-10 h-96 w-96 bg-indigo-200/50 blur-3xl rounded-full" />
          <div className="absolute top-1/3 right-1/3 h-24 w-24 bg-primary/10 -rotate-12 rounded-2xl blur-xl" />
          <div className="absolute bottom-24 left-20 h-20 w-20 bg-emerald-100/70 rotate-45 rounded-2xl blur-md" />
        </motion.div>

        <motion.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="z-10 max-w-lg text-center px-10"
        >
          <div className="inline-flex items-center gap-2 bg-black text-white px-3 py-1 rounded-full text-xs mb-4">
            <Sparkles className="w-3.5 h-3.5" /> New to Loopp?
          </div>
          <h1 className="text-3xl font-semibold text-slate-800 mb-3">Create your Loopp account</h1>
          <p className="text-slate-600 leading-relaxed">
            Join your team, collaborate in real-time chat, manage tasks, and deliver faster. 🚀
          </p>
        </motion.div>
      </div>

      {/* Right: Form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-xl bg-white rounded-2xl shadow-md border border-slate-200"
        >
          <div className="p-8">
            {err && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {err}
              </div>
            )}
            <h2 className="text-2xl font-semibold mb-2">Sign up</h2>
            <p className="text-slate-600 mb-6">We’ll get you set up in minutes.</p>

            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* First Name */}
              <div className="md:col-span-1">
                <label htmlFor="firstName" className="block text-sm font-medium mb-1">First name</label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Jane"
                    value={form.firstName}
                    onChange={onChange}
                    className="w-full pl-9 pr-3 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                  />
                </div>
                {!firstValid && form.firstName && (
                  <p className="text-xs text-red-600 mt-1">Use at least 2 characters.</p>
                )}
              </div>

              {/* Last Name */}
              <div className="md:col-span-1">
                <label htmlFor="lastName" className="block text-sm font-medium mb-1">Last name</label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Cooper"
                    value={form.lastName}
                    onChange={onChange}
                    className="w-full pl-9 pr-3 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                  />
                </div>
                {!lastValid && form.lastName && (
                  <p className="text-xs text-red-600 mt-1">Use at least 2 characters.</p>
                )}
              </div>

              {/* Email */}
              <div className="md:col-span-1">
                <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@loopp.com"
                    value={form.email}
                    onChange={onChange}
                    className="w-full pl-9 pr-3 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                  />
                </div>
                {!emailValid && form.email && (
                  <p className="text-xs text-red-600 mt-1">Please enter a valid email.</p>
                )}
              </div>

              {/* Phone */}
              <div className="md:col-span-1">
                <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+234 801 234 5678"
                    value={form.phone}
                    onChange={onChange}
                    className="w-full pl-9 pr-3 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                  />
                </div>
                {!phoneValid && form.phone && (
                  <p className="text-xs text-red-600 mt-1">Enter a valid phone number.</p>
                )}
              </div>

              {/* Gender */}
              <div className="md:col-span-2">
                <span className="block text-sm font-medium mb-1">Gender</span>
                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setForm((p) => ({ ...p, gender: g }))}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        form.gender === g
                          ? "border-black bg-black text-white"
                          : "border-slate-300 hover:border-slate-400"
                      }`}
                      aria-pressed={form.gender === g}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                {!genderValid && (
                  <p className="text-xs text-red-600 mt-1">Please select a gender.</p>
                )}
              </div>

              {/* Password */}
              <div className="md:col-span-1">
                <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    id="password"
                    name="password"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={onChange}
                    className="w-full pl-9 pr-10 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength meter */}
                <div className="flex gap-1 mt-2" aria-label="Password strength">
                  {[0,1,2,3].map((i) => (
                    <div key={i} className={`h-1.5 w-full rounded-full ${i < strength ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  ))}
                </div>
                <ul className="text-xs text-slate-500 mt-2 space-y-1">
                  <li className={passMin ? "text-emerald-600" : ""}>• At least 6 characters</li>
                  <li className={passHasNum ? "text-emerald-600" : ""}>• Includes a number</li>
                  <li className={passHasCase ? "text-emerald-600" : ""}>• Upper & lower case</li>
                </ul>
              </div>

              {/* Confirm */}
              <div className="md:col-span-1">
                <label htmlFor="confirm" className="block text-sm font-medium mb-1">Confirm password</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    id="confirm"
                    name="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={onChange}
                    className="w-full pl-9 pr-10 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black"
                    aria-label={showConfirm ? "Hide confirm" : "Show confirm"}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.confirm && !match && (
                  <p className="text-xs text-red-600 mt-1">Passwords do not match.</p>
                )}
              </div>

              {/* Submit */}
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={loading || !formValid}
                  className="w-full py-3 bg-black text-white rounded-lg hover:opacity-90 disabled:opacity-70 transition"
                >
                  {loading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating account…
                    </span>
                  ) : (
                    "Create account"
                  )}
                </button>
              </div>
            </form>

            {/* <p className="text-sm text-slate-600 mt-6">
              Already have an account?{" "}
              <Link to="/signin" className="text-black underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p> */}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
