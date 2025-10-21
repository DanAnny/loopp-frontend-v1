// src/features/auth/pages/ClientSignUp.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import authService from '@/services/auth.service';
import { apiClient, setAccessToken } from '@/services/http';
import { useDispatch } from 'react-redux';
import { setAccess } from '@/features/auth/authSlice';
import { hardClientReset } from '@/lib/resetClientState';

/* ---------- helpers (same as ClientSignIn) ---------- */
const isPlaceholder = (v) =>
  typeof v === 'string' && (/%[A-Za-z0-9_]+%/.test(v) || /^\{.*\}$/.test(v));
const safeDecodeTwice = (v) => { try { v = decodeURIComponent(v); } catch {} try { v = decodeURIComponent(v); } catch {} return v; };

/* ---------- pretty "creating project" overlay ---------- */
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
    <div className="fixed inset-0 z-[100] grid place-items-center bg-white">
      <div className="w-full max-w-md text-center px-6">
        <img
          src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=600&auto=format&fit=crop"
          alt=""
          className="w-full h-40 object-cover rounded-2xl shadow"
        />
        <div className="mt-6">
          <h2 className="text-xl font-bold">{steps[i].title}</h2>
          <p className="text-sm text-gray-600 mt-1">{steps[i].note}</p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:300ms]" />
        </div>
        <p className="mt-4 text-xs text-gray-500">Hang tight — this only takes a moment.</p>
      </div>
    </div>
  );
}

export default function ClientSignUp() {
  const nav = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // 🔒 ensure we start from a clean slate on first mount
  useEffect(() => { hardClientReset(); }, []);

  // Read + normalize URL params
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const rawKey   = qs.get('key') || '';
  const rawTitle = qs.get('title') || '';
  const rawFirst = qs.get('firstName') || '';
  const rawLast  = qs.get('lastName') || '';
  const rawEmail = qs.get('email') || '';
  const rawDesc  = qs.get('projectDescription') || '';
  const rawDate  = qs.get('completionDate') || '';

  const clientKey          = isPlaceholder(rawKey)   ? '' : rawKey.trim();
  const projectTitle       = isPlaceholder(rawTitle) ? '' : safeDecodeTwice(rawTitle).trim();
  const firstNameFromURL   = isPlaceholder(rawFirst) ? '' : rawFirst.trim();
  const lastNameFromURL    = isPlaceholder(rawLast)  ? '' : rawLast.trim();
  const emailFromURL       = isPlaceholder(rawEmail) ? '' : rawEmail.trim();
  const projectDescription = isPlaceholder(rawDesc)  ? '' : rawDesc.trim();
  const completionDate     = isPlaceholder(rawDate)  ? '' : rawDate.trim();

  const hasProjectParams = Boolean(clientKey);
  const missingCritical  = !clientKey;

  const [form, setForm] = useState({
    firstName: firstNameFromURL,
    lastName: lastNameFromURL,
    email: emailFromURL,
    password: '',
    phone: '',
    gender: 'Male',
  });
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  const mismatch = confirm && form.password !== confirm;

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
    setErr('');
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (loading || mismatch) return;

    if (missingCritical) {
      setErr('No project was selected. Please go back and request a project before creating an account.');
      return;
    }

    setLoading(true);
    setErr('');
    try {
      // 0) ensure clean state (in case the tab had background refresh cookie)
      await hardClientReset();

      // 1) Create account (ignore "already exists")
      try {
        if (typeof authService.signUpClient === 'function') {
          await authService.signUpClient(form);
        }
      } catch {}

      // 2) Sign in
      const { data } = await authService.signIn({ email: form.email, password: form.password });
      if (!data?.success) throw new Error(data?.message || 'Authentication failed after sign up');

      const token = data?.accessToken || data?.token || '';
      if (token) {
        setAccessToken(token);
        dispatch(setAccess(token));
      }

      // 3) Create project (show overlay while creating)
      setCreating(true);
      try {
        await apiClient.post('/projects/client/create', {
          clientKey,
          projectTitle,
          firstName: form.firstName || firstNameFromURL,
          lastName: form.lastName || lastNameFromURL,
          email: form.email || emailFromURL,
          projectDescription,
          completionDate,
        });
      } catch {}

      // 4) Hard route to client chat
      window.location.replace('/client-chat');
    } catch (eMain) {
      setErr(eMain?.response?.data?.message || eMain?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white text-black">
      {creating && <CreatingOverlay />}

      <div className="w-full max-w-md px-6 py-10">
        {!hasProjectParams && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-base font-semibold text-amber-900">No project was selected</h2>
            <p className="mt-1 text-sm text-amber-800">
              Please go back and request a project before creating an account.
            </p>
            <div className="mt-3">
              <a
                href="https://angelmap.foundryradar.com/"
                className="inline-flex items-center gap-2 rounded-xl border border-black bg-black px-4 py-2 text-sm font-semibold text-white hover:-translate-y-0.5 hover:shadow-lg transition"
              >
                ← Go back
              </a>
            </div>
          </div>
        )}

        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-lg transition-shadow hover:shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
            <p className="mt-1 text-sm text-gray-500">Join Loopp and bring your ideas to life.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="mb-1 block text-sm font-medium">First name</label>
                <input
                  id="firstName"
                  name="firstName"
                  value={form.firstName}
                  onChange={onChange}
                  placeholder="John"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-base outline-none transition focus:border-black focus:ring-2 focus:ring-black"
                  required
                  disabled={!hasProjectParams || creating}
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-1 block text-sm font-medium">Last name</label>
                <input
                  id="lastName"
                  name="lastName"
                  value={form.lastName}
                  onChange={onChange}
                  placeholder="Doe"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-base outline-none transition focus:border-black focus:ring-2 focus:ring-black"
                  required
                  disabled={!hasProjectParams || creating}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={onChange}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-base outline-none transition focus:border-black focus:ring-2 focus:ring-black"
                required
                disabled={!hasProjectParams || creating}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium">Phone</label>
                <input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={onChange}
                  placeholder="+1 555 123 4567"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-base outline-none transition focus:border-black focus:ring-2 focus:ring-black"
                  required
                  disabled={!hasProjectParams || creating}
                />
              </div>
              <div>
                <label htmlFor="gender" className="mb-1 block text-sm font-medium">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  value={form.gender}
                  onChange={onChange}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base outline-none transition focus:border-black focus:ring-2 focus:ring-black"
                  required
                  disabled={!hasProjectParams || creating}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={onChange}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-base outline-none transition focus:border-black focus:ring-2 focus:ring-black"
                required
                disabled={!hasProjectParams || creating}
              />
            </div>

            <div>
              <label htmlFor="confirm" className="mb-1 block text-sm font-medium">Confirm password</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className={`w-full rounded-xl border px-3 py-2 text-base outline-none transition focus:ring-2 ${
                  mismatch ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-black focus:ring-black'
                }`}
                required
                disabled={!hasProjectParams || creating}
              />
              {mismatch && <p className="mt-1 text-xs font-medium text-red-600">Passwords do not match.</p>}
            </div>

            <button
              disabled={loading || mismatch || !hasProjectParams || creating}
              className="group relative flex w-full items-center justify-center rounded-xl border border-black bg-black px-4 py-2 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 hover:shadow-lg hover:-translate-y-0.5"
            >
              {loading ? 'Loading…' : 'Sign up'}
            </button>

            <p className="text-xs text-gray-500">
              Already have an account?{' '}
              <Link
                to={`/client-sign-in${location.search ? `?${location.search.substring(1)}` : ''}`}
                className="underline decoration-black/50 underline-offset-2 hover:decoration-black"
              >
                Sign in
              </Link>
            </p>
          </form>

          {hasProjectParams && !creating && (
            <div className="mt-4 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70">
              After signing up, we’ll create your project and open chat.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
