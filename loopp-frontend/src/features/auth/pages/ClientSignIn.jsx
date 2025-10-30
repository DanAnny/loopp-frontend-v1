// src/features/auth/pages/ClientSignIn.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import authService from '@/services/auth.service';
import { apiClient, setAccessToken } from '@/services/http';
import { useDispatch } from 'react-redux';
import { setAccess } from '@/features/auth/authSlice';
import { hardClientReset } from '@/lib/resetClientState';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                           WP param persistence utils                       */
/* -------------------------------------------------------------------------- */
const WP_QS_STORAGE_KEY = 'wpBridgeParams.v1';
const WP_QS_INJECT_FLAG = 'wpBridgeParams.injected';

function saveWpParamsToSession(searchStr) {
  try {
    const clean = (searchStr || '').replace(/^\?/, '');
    if (clean) sessionStorage.setItem(WP_QS_STORAGE_KEY, clean);
  } catch {}
}
function getSavedWpParams() {
  try {
    return sessionStorage.getItem(WP_QS_STORAGE_KEY) || '';
  } catch { return ''; }
}
function ensureUrlHasSavedParamsOnce(location, nav) {
  try {
    const already = sessionStorage.getItem(WP_QS_INJECT_FLAG);
    const saved = getSavedWpParams();
    if (!location.search && saved && !already) {
      sessionStorage.setItem(WP_QS_INJECT_FLAG, '1');
      nav(`${location.pathname}?${saved}`, { replace: true });
    }
  } catch {}
}

/* ----------------------------- helpers (original) ---------------------------- */
const isPlaceholder = (v) =>
  typeof v === 'string' && (/%[A-Za-z0-9_]+%/.test(v) || /^\{.*\}$/.test(v));
const safeDecodeTwice = (v) => { try { v = decodeURIComponent(v); } catch {} try { v = decodeURIComponent(v); } catch {} return v; };

// accept 64-hex OR uuid v4
const isHex64 = (s='') => /^[a-f0-9]{64}$/i.test(s);
const isUuidV4 = (s='') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const isValidClientKey = (s='') => isHex64(s) || isUuidV4(s);

/* ----------------------------- Creating Overlay UI --------------------------- */
function CreatingOverlay() {
  const steps = [
    { title: 'Setting things up',            note: 'We’re preparing your workspace…' },
    { title: 'Assigning a Project Manager',  note: 'Finding the best available PM…' },
    { title: 'Creating your chat room',      note: 'Almost ready to collaborate…' },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((s) => (s + 1) % steps.length), 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md text-center px-6"
      >
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-xl opacity-25" />
          <div className="relative rounded-2xl border border-white/20 bg-white/90 backdrop-blur-xl shadow-2xl p-6">
            <img
              src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1200&auto=format&fit=crop"
              alt=""
              className="w-full h-40 object-cover rounded-xl"
            />
            <div className="mt-6">
              <h2 className="text-[1.15rem] font-semibold tracking-tight text-gray-900">{steps[i].title}</h2>
              <p className="text-sm text-gray-600 mt-1">{steps[i].note}</p>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:300ms]" />
            </div>
            <p className="mt-4 text-xs text-gray-500">Sit back — this only takes a moment.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* --------------------------------- Page ------------------------------------- */
export default function ClientSignIn() {
  const nav = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  /* 1) Persist WP params immediately, then force a cold start (logout + reset) */
  useEffect(() => {
    // Save current params (from WP) BEFORE we clear anything
    saveWpParamsToSession(location.search);
    // If router navigation stripped them, re-inject once
    ensureUrlHasSavedParamsOnce(location, nav);

    // Force logout + hard reset (tokens/cookies/session/localStorage)
    (async () => {
      try { if (typeof authService.logout === 'function') await authService.logout(); } catch {}
      try { await hardClientReset(); } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parse (restored) params
  const qs = useMemo(
    () => new URLSearchParams(location.search || `?${getSavedWpParams()}`),
    [location.search]
  );

  // Support both param spellings
  const rawKey   = qs.get('clientKey') || qs.get('key') || '';
  const rawTitle = qs.get('projectTitle') || qs.get('title') || '';
  const rawFirst = qs.get('firstName') || '';
  const rawLast  = qs.get('lastName') || '';
  const rawEmail = qs.get('email') || '';
  const rawDesc  = qs.get('projectDescription') || '';
  const rawDate  = qs.get('completionDate') || '';

  const clientKey          = isPlaceholder(rawKey)   ? '' : rawKey.trim();
  const projectTitle       = isPlaceholder(rawTitle) ? '' : safeDecodeTwice(rawTitle).trim();
  const firstName          = isPlaceholder(rawFirst) ? '' : rawFirst.trim();
  const lastName           = isPlaceholder(rawLast)  ? '' : rawLast.trim();
  const emailFromQuery     = isPlaceholder(rawEmail) ? '' : rawEmail.trim();
  const projectDescription = isPlaceholder(rawDesc)  ? '' : rawDesc.trim();
  const completionDate     = isPlaceholder(rawDate)  ? '' : rawDate.trim();

  const haveProjectParams =
    Boolean(projectTitle || projectDescription || completionDate || firstName || lastName || emailFromQuery) &&
    isValidClientKey(clientKey);

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (emailFromQuery && !form.email) setForm((p) => ({ ...p, email: emailFromQuery }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFromQuery]);

  const validEmail = useMemo(() => /.+@.+\..+/.test(form.email.trim()), [form.email]);
  const validPassword = useMemo(() => form.password.trim().length >= 3, [form.password]);
  const formValid = validEmail && validPassword;

  function onChange(e) {
    setErr('');
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (loading || !formValid) return;

    setLoading(true); setErr('');
    try {
      // Extra safety: clear any stragglers again before auth
      try { if (typeof authService.logout === 'function') await authService.logout(); } catch {}
      try { await hardClientReset(); } catch {}

      // 1) sign in
      const { data } = await authService.signIn({ email: form.email, password: form.password });
      if (!data?.success) throw new Error(data?.message || 'Failed to sign in');

      const token = data?.accessToken || data?.token;
      if (token) {
        setAccessToken(token);
        dispatch(setAccess(token));
      }

      // 2) If we came with a real project intent (URL present), create it now
      if (haveProjectParams) {
        setCreating(true);
        try {
          await apiClient.post('/projects/client/create', {
            clientKey,                   // accept uuid or 64hex
            projectTitle,                // from title/projectTitle
            firstName,
            lastName,
            email: emailFromQuery || form.email, // backend trusts the auth user; we still pass for convenience
            projectDescription,
            completionDate,
          });
        } catch (_) {
          // soft-fail: if already exists or transient missing, continue to chat
        }
      }

      // 3) Hard route (no history back to login)
      window.location.replace('/client-chat');
    } catch (eMain) {
      setErr(eMain?.response?.data?.message || eMain?.message || 'Sign in failed');
    } finally {
      setLoading(false);
      setCreating(false);
    }
  }

  const hasWpParamsBanner =
    haveProjectParams ||
    Boolean(projectTitle || firstName || lastName || emailFromQuery || projectDescription || completionDate || clientKey);

  /* --- floating label class --- */
  const floatedLabel =
    "absolute left-11 pointer-events-none transition-all " +
    "px-1 bg-white/90 rounded " +
    "top-0 -translate-y-1/2 text-[12px] text-gray-500 " +
    "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 " +
    "peer-placeholder-shown:text-[14px] peer-placeholder-shown:px-0 peer-placeholder-shown:bg-transparent " +
    "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[12px] peer-focus:px-1 peer-focus:bg-white/90";

  /* --------------------------------- UI ------------------------------------- */
  return (
    <div className="h-screen overflow-hidden bg-white flex antialiased">
      {creating && <CreatingOverlay />}

      {/* Left Panel - Branding/Story */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-gray-900 via-gray-800 to-black p-12 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px'
            }}
          />
        </div>

        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-600 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-purple-600 rounded-full blur-3xl"
        />

        <div className="relative z-10 max-w-lg">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mb-8 inline-flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-purple-400" />
              </div>
              <span className="text-white text-2xl tracking-tight">Loopp</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-[40px] leading-[1.1] text-white mb-4 tracking-tight"
            >
              Transform Ideas<br />Into Reality
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-[18px] text-gray-300 mb-12 leading-relaxed"
            >
              Connect with expert project managers and engineers who bring your vision to life through real-time collaboration.
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-blue-50/30" />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.06, 0.03] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 right-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.02, 0.05, 0.02] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-0 left-0 w-80 h-80 bg-purple-400 rounded-full blur-3xl"
        />

        <div className="relative z-10 w-full max-w-md">
          <AnimatePresence>
            {hasWpParamsBanner && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70"
              >
                After signing in, we’ll {haveProjectParams ? 'create your project and ' : ''}open chat.
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur-xl opacity-10" />
            <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 lg:p-8">
              <div className="mb-6 text-center">
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[26px] font-bold tracking-tight text-gray-900"
                >
                  Welcome back
                </motion.h1>
                <p className="mt-1 text-[13px] text-gray-600">Sign in to continue with Loopp.</p>
              </div>

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

              {/* FORM */}
              <form onSubmit={onSubmit} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder=" "
                      className={`peer w-full h-12 rounded-xl border-2 bg-white/60 pl-11 pr-12 text-[15px] tracking-tight text-gray-900
                        outline-none transition
                        placeholder-transparent
                        focus:border-gray-900 focus:ring-4 focus:ring-gray-900/10
                        ${!validEmail && form.email ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'}
                      `}
                      value={form.email}
                      onChange={onChange}
                      required
                    />
                    <label htmlFor="email" className={floatedLabel}>Email</label>

                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {validEmail && form.email && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                      {!validEmail && form.email && <AlertCircle className="w-5 h-5 text-red-600" />}
                    </div>
                  </div>
                  {!validEmail && form.email && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Please enter a valid email.
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Link to="/forgot" className="ml-auto text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2">
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder=" "
                      className={`peer w-full h-12 rounded-xl border-2 bg-white/60 pl-11 pr-3 text-[15px] tracking-tight text-gray-900
                        outline-none transition
                        placeholder-transparent
                        focus:border-gray-900 focus:ring-4 focus:ring-gray-900/10
                        ${!validPassword && form.password ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'}
                      `}
                      value={form.password}
                      onChange={onChange}
                      required
                    />
                    <label htmlFor="password" className={floatedLabel}>Password</label>
                  </div>
                  {!validPassword && form.password && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Minimum 3 characters.
                    </p>
                  )}
                </div>

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={loading || !formValid}
                  whileHover={!loading && formValid ? { scale: 1.01 } : undefined}
                  whileTap={!loading && formValid ? { scale: 0.99 } : undefined}
                  className="group relative flex w-full items-center justify-center h-12 rounded-xl border border-black bg-black px-4 font-semibold text-white tracking-tight transition disabled:cursor-not-allowed disabled:opacity-80 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-2">
                    {loading ? 'Signing in…' : 'Sign in'}
                    {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  </span>
                </motion.button>

                <p className="text-xs text-gray-600 text-center">
                  No account?{' '}
                  <Link
                    to={`/client-sign-up${(location.search || `?${getSavedWpParams()}`) ? `?${(location.search || `?${getSavedWpParams()}`).replace(/^\?/, '')}` : ''}`}
                    className="underline decoration-black/50 underline-offset-2 hover:decoration-black"
                  >
                    Sign up
                  </Link>
                </p>
              </form>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-5 text-center text-[11px] text-gray-400"
              >
                Protected by enterprise-grade encryption
              </motion.p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
