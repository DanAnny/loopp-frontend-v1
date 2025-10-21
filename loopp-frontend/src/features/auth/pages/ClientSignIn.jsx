// src/features/auth/pages/ClientSignIn.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import authService from '@/services/auth.service';
import { apiClient, setAccessToken } from '@/services/http';
import { useDispatch } from 'react-redux';
import { setAccess } from '@/features/auth/authSlice';
import { hardClientReset } from '@/lib/resetClientState';

// helpers to clean possible placeholders
const isPlaceholder = (v) =>
  typeof v === 'string' && (/%[A-Za-z0-9_]+%/.test(v) || /^\{.*\}$/.test(v));
const safeDecodeTwice = (v) => { try { v = decodeURIComponent(v); } catch {} try { v = decodeURIComponent(v); } catch {} return v; };

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
          alt="" className="w-full h-40 object-cover rounded-2xl shadow"
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
        <p className="mt-4 text-xs text-gray-500">Sit back — this only takes a moment.</p>
      </div>
    </div>
  );
}

export default function ClientSignIn() {
  const nav = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // 🔒 ensure fresh environment on mount (prevents prior account bleed-through)
  useEffect(() => { hardClientReset(); }, []);

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const rawKey   = qs.get('key') || '';
  const rawTitle = qs.get('title') || '';
  const rawFirst = qs.get('firstName') || '';
  const rawLast  = qs.get('lastName') || '';
  const rawEmail = qs.get('email') || '';
  const rawDesc  = qs.get('projectDescription') || '';
  const rawDate  = qs.get('completionDate') || '';

  const clientKey         = isPlaceholder(rawKey)   ? '' : rawKey;
  const projectTitle      = isPlaceholder(rawTitle) ? '' : safeDecodeTwice(rawTitle);
  const firstName         = isPlaceholder(rawFirst) ? '' : rawFirst.trim();
  const lastName          = isPlaceholder(rawLast)  ? '' : rawLast.trim();
  const emailFromQuery    = isPlaceholder(rawEmail) ? '' : rawEmail.trim();
  const projectDescription= isPlaceholder(rawDesc)  ? '' : rawDesc.trim();
  const completionDate    = isPlaceholder(rawDate)  ? '' : rawDate.trim();

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (emailFromQuery && !form.email) {
      setForm((p) => ({ ...p, email: emailFromQuery }));
    }
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
      // 0) ensure all stale state is gone
      await hardClientReset();

      // 1) sign in
      const { data } = await authService.signIn({ email: form.email, password: form.password });
      if (!data?.success) throw new Error(data?.message || 'Failed to sign in');

      const token = data?.accessToken || data?.token;
      if (token) {
        setAccessToken(token);
        dispatch(setAccess(token));
      }

      // 2) interstitial: create project (only if we have a real key)
      const validKey = clientKey && /^[a-f0-9]{64}$/i.test(clientKey);
      if (validKey) {
        setCreating(true);
        try {
          await apiClient.post('/projects/client/create', {
            clientKey,
            projectTitle,
            firstName,
            lastName,
            email: emailFromQuery, // backend trusts authenticated user’s email
            projectDescription,
            completionDate,
          });
        } catch (_) { /* if already exists or soft fail, carry on */ }
      }

      // 3) hard route (no history back to login)
      window.location.replace('/client-chat');
    } catch (eMain) {
      setErr(eMain?.response?.data?.message || eMain?.message || 'Sign in failed');
    } finally {
      setLoading(false);
      setCreating(false);
    }
  }

  const hasWpParams = Boolean(
    clientKey || projectTitle || firstName || lastName || emailFromQuery || projectDescription || completionDate
  );

  return (
    <div className="min-h-[85vh] bg-white text-black">
      {creating && <CreatingOverlay />}

      <div className="mx-auto max-w-md px-6 py-16">
        {hasWpParams && (
          <div className="mb-4 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70">
            After signing in, we’ll create your project and open chat.
          </div>
        )}

        <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-lg hover:shadow-2xl transition-shadow">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to continue with Loopp.</p>
          </div>

          {err && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
              <input id="email" name="email" type="email" inputMode="email" autoComplete="email"
                     placeholder="you@company.com"
                     className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base outline-none transition focus:border-black focus:ring-2 focus:ring-black"
                     value={form.email} onChange={onChange} required />
              {!validEmail && form.email && <p className="mt-1 text-xs text-red-600">Please enter a valid email.</p>}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <Link to="/forgot" className="text-xs underline underline-offset-2">Forgot?</Link>
              </div>
              <input id="password" name="password" type="password" autoComplete="current-password"
                     placeholder="••••••••"
                     className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base outline-none transition focus:border-black focus:ring-2 focus:ring-black"
                     value={form.password} onChange={onChange} required />
              {!validPassword && form.password && <p className="mt-1 text-xs text-red-600">Minimum 3 characters.</p>}
            </div>

            <button
              disabled={loading || !formValid}
              className="group relative flex w-full items-center justify-center rounded-xl border border-black bg-black px-4 py-2 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-80 hover:shadow-lg hover:-translate-y-0.5"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="text-xs text-gray-500">
              No account?{' '}
              <Link
                to={`/client-sign-up${location.search ? `?${location.search.substring(1)}` : ''}`}
                className="underline decoration-black/50 underline-offset-2 hover:decoration-black"
              >
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
