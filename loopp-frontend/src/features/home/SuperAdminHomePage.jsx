// src/pages/SuperAdminHomePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Zap,
  UserCog,
  UserCheck,
  Shield,
  RefreshCcw,
  Sun,
  Moon,
} from "lucide-react";
import dashboard from "@/services/dashboard.service";

/** JAW-DROPPING SuperAdmin Dashboard (now with Dark/Light toggle) */
export default function SuperAdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // --- THEME ---------------------------------------------------------------
  const prefersDark = typeof window !== "undefined"
    ? window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    : true;

  const [isDark, setIsDark] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("sa_theme") : null;
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return prefersDark; // default to system preference
  });

  useEffect(() => {
    localStorage.setItem("sa_theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Design tokens for both themes
  const t = useMemo(
    () =>
      isDark
        ? {
            // dark
            pageBg:
              "bg-gradient-to-b from-[#0B0B0E] via-[#0D0D12] to-[#0B0B0E]",
            text: "text-white",
            subtext: "text-white/70",
            subtextDim: "text-white/60",
            border: "border-white/10",
            cardBg: "bg-white/5",
            cardBgSoft: "bg-white/[.06]",
            hoverRow: "hover:bg-white/5",
            gridOverlay: "opacity-[.08] grid-overlay-dark",
            tickColor: "rgba(255,255,255,.7)",
            gridStroke: "rgba(255,255,255,.08)",
            tooltipBg: "bg-[#0F1115]/95",
            tooltipText: "text-white/90",
            headerGlowA: "rgba(93,95,239,.15)",
            headerGlowB: "rgba(236,72,153,.12)",
            buttonBase: "border-white/10 bg-white/10 hover:bg-white/20",
            selectWrap: "border-white/10 bg-black/30",
            chipBg: "bg-white/10",
            chipBorder: "border-white/10",
          }
        : {
            // light
            pageBg:
              "bg-gradient-to-b from-[#F7F8FA] via-[#FFFFFF] to-[#F7F8FA]",
            text: "text-slate-900",
            subtext: "text-slate-600",
            subtextDim: "text-slate-500",
            border: "border-slate-200",
            cardBg: "bg-white",
            cardBgSoft: "bg-white",
            hoverRow: "hover:bg-slate-50",
            gridOverlay: "opacity-[.12] grid-overlay-light",
            tickColor: "rgba(15,23,42,.7)", // slate-900 ~
            gridStroke: "rgba(2,6,23,.06)", // faint slate grid
            tooltipBg: "bg-white/95",
            tooltipText: "text-slate-900",
            headerGlowA: "rgba(99,102,241,.12)",
            headerGlowB: "rgba(236,72,153,.10)",
            buttonBase:
              "border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800",
            selectWrap:
              "border-slate-200 bg-slate-100 text-slate-800",
            chipBg: "bg-slate-100",
            chipBorder: "border-slate-200",
          },
    [isDark]
  );

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await dashboard.superOverview(range);
      setData(res?.data?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const totals = data?.totals || {};
  const lineSeries = data?.charts?.lineSeries || [];
  const roleBars = data?.charts?.roleBars || [];
  const staffRatings = data?.staff?.ratings || [];
  const idleStaff = data?.staff?.idle || [];

  // Chart palettes (consistent across themes; strokes read well on both)
  const chartColors = {
    requested: "#7c83ff",
    assigned: "#d946ef",
    accepted: "#22c55e",
    completed: "#f59e0b",
    active: "#22c55e",
    idle: "#f43f5e",
    total: "#38bdf8",
  };

  return (
    <main className={`min-h-screen ${t.pageBg} ${t.text}`}>
      {/* subtle grid + noise */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `radial-gradient(1200px 600px at 10% -20%, ${t.headerGlowA}, transparent), radial-gradient(1000px 600px at 90% 0%, ${t.headerGlowB}, transparent)`,
        }}
      />
      <div
        className={`pointer-events-none fixed inset-0 -z-10 ${t.gridOverlay}`}
      />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div
            className={`relative overflow-hidden rounded-3xl ${t.border} ${t.cardBg} backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,.12)]`}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(1000px 400px at 10% 10%, ${t.headerGlowA}, transparent)`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(900px 300px at 90% 10%, ${t.headerGlowB}, transparent)`,
              }}
            />
            <div className="relative flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
                  SuperAdmin Control Room
                </h1>
                <p className={`mt-1 text-sm ${t.subtext}`}>
                  Organization Overview • Requests • Staff Performance
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Range picker */}
                <div className={`rounded-2xl ${t.selectWrap} px-3 py-2`}>
                  <label className={`mr-2 text-xs ${t.subtextDim}`}>Range</label>
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className={`bg-transparent text-sm outline-none ${isDark ? "text-white" : "text-slate-800"}`}
                  >
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                  </select>
                </div>

                {/* Refresh */}
                <button
                  onClick={load}
                  className={`inline-flex items-center gap-2 rounded-2xl ${t.buttonBase} px-3 py-2 text-sm transition active:scale-[.98]`}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>

                {/* THEME TOGGLE (replaces Add Admin) */}
                <button
                  onClick={() => setIsDark((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-2xl ${t.buttonBase} px-3 py-2 text-sm transition active:scale-[.98]`}
                  aria-label="Toggle dark / light mode"
                  title="Toggle theme"
                >
                  {isDark ? (
                    <>
                      <Sun className="h-4 w-4" />
                      Light
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4" />
                      Dark
                    </>
                  )}
                </button>

                {/* Keep existing Manage Staff link */}
                <nav className="hidden md:flex items-center gap-2">
                  <Link
                    to="/sa/staff"
                    className={`rounded-2xl ${t.buttonBase} px-3 py-2 text-sm transition`}
                  >
                    Manage Staff
                  </Link>
                  {/* Rejections (optional)
                  <Link
                    to="/sa/rejections"
                    className={`rounded-2xl ${t.buttonBase} px-3 py-2 text-sm transition`}
                  >
                    Rejections
                  </Link> */}
                </nav>
              </div>
            </div>
          </div>
        </header>

        {/* Error */}
        {err && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 ${
              isDark
                ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {err}
          </div>
        )}

        {/* KPI Row */}
        <section
          className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4"
          aria-label="key performance indicators"
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} isDark={isDark} t={t} />
              ))
            : (
              <>
                <KpiCard
                  isDark={isDark}
                  t={t}
                  icon={<ClipboardList className="h-5 w-5" />}
                  label="Total Project Requests"
                  value={fmt(totals.totalRequests)}
                  accent="from-indigo-500/40 to-blue-500/30"
                />
                <KpiCard
                  isDark={isDark}
                  t={t}
                  icon={<Briefcase className="h-5 w-5" />}
                  label="Assigned (Range)"
                  value={fmt(totals.assignedThisRange)}
                  hint="Engineer assigned"
                  accent="from-violet-500/40 to-fuchsia-500/30"
                />
                <KpiCard
                  isDark={isDark}
                  t={t}
                  icon={<UserCheck className="h-5 w-5" />}
                  label="Accepted by Engineers"
                  value={fmt(totals.acceptedThisRange)}
                  hint="Moved to In-Progress"
                  accent="from-emerald-500/40 to-lime-500/30"
                />
                <KpiCard
                  isDark={isDark}
                  t={t}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  label="Completed (Range)"
                  value={fmt(totals.completedThisRange)}
                  hint="Marked Complete"
                  accent="from-amber-500/40 to-orange-500/30"
                />
              </>
            )}
        </section>

        {/* Staff KPIs */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          {loading ? (
            <>
              <SkeletonCard isDark={isDark} t={t} />
              <SkeletonCard isDark={isDark} t={t} />
              <SkeletonCard isDark={isDark} t={t} />
            </>
          ) : (
            <>
              <KpiCard
                isDark={isDark}
                t={t}
                icon={<Users className="h-5 w-5" />}
                label="Staff (Total)"
                value={fmt(totals?.staff?.total)}
                hint="All roles"
                accent="from-sky-500/40 to-cyan-500/30"
              />
              <KpiCard
                isDark={isDark}
                t={t}
                icon={<UserCog className="h-5 w-5" />}
                label="PM / Engineer / Admin"
                value={`${fmt(totals?.staff?.pm)} / ${fmt(totals?.staff?.engineer)} / ${fmt(totals?.staff?.admin)}`}
                hint="Role breakdown"
                accent="from-fuchsia-500/40 to-pink-500/30"
              />
              <KpiCard
                isDark={isDark}
                t={t}
                icon={<Zap className="h-5 w-5" />}
                label="Active PM / Eng"
                value={`${fmt(roleBars?.[0]?.active)} / ${fmt(roleBars?.[1]?.active)}`}
                hint="Busy or Online"
                accent="from-green-500/40 to-emerald-500/30"
              />
            </>
          )}
        </section>

        {/* Charts */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <ChartCard t={t} title="Pipeline Velocity" subtitle="Requested → Assigned → Accepted → Completed (daily)" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={lineSeries} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={chartColors.requested} stopOpacity={0.8} />
                    <stop offset="90%" stopColor={chartColors.requested} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gAss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={chartColors.assigned} stopOpacity={0.8} />
                    <stop offset="90%" stopColor={chartColors.assigned} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={chartColors.accepted} stopOpacity={0.8} />
                    <stop offset="90%" stopColor={chartColors.accepted} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gCom" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={chartColors.completed} stopOpacity={0.85} />
                    <stop offset="90%" stopColor={chartColors.completed} stopOpacity={0.06} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke={t.gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: t.tickColor, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: t.tickColor, fontSize: 12 }} />
                <Tooltip content={<DarkTooltip isDark={isDark} t={t} />} />
                <Legend wrapperStyle={{ color: isDark ? "rgba(255,255,255,.8)" : "rgba(15,23,42,.8)" }} />

                <Area type="monotone" dataKey="requested" stroke={chartColors.requested} strokeWidth={2} fill="url(#gReq)" activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="assigned"  stroke={chartColors.assigned}  strokeWidth={2} fill="url(#gAss)" activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="accepted"  stroke={chartColors.accepted}  strokeWidth={2} fill="url(#gAcc)" activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="completed" stroke={chartColors.completed} strokeWidth={2} fill="url(#gCom)" activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard t={t} title="Staff by Role" subtitle="Active vs Idle vs Total">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roleBars} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="bActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.active} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={chartColors.active} stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="bIdle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.idle} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={chartColors.idle} stopOpacity={0.25} />
                  </linearGradient>
                  <linearGradient id="bTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.total} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={chartColors.total} stopOpacity={0.3} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke={t.gridStroke} vertical={false} />
                <XAxis dataKey="role" tick={{ fill: t.tickColor, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: t.tickColor, fontSize: 12 }} />
                <Tooltip content={<DarkTooltip isDark={isDark} t={t} />} />
                <Legend wrapperStyle={{ color: isDark ? "rgba(255,255,255,.8)" : "rgba(15,23,42,.8)" }} />
                <Bar dataKey="active" stackId="a" fill="url(#bActive)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="idle"   stackId="a" fill="url(#bIdle)"   radius={[8, 8, 0, 0]} />
                <Bar dataKey="total"             fill="url(#bTotal)"  radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Ratings & Idle Staff */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <div className={`rounded-3xl ${t.border} ${t.cardBg} p-5 backdrop-blur-xl`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Top Staff Ratings (range)</h3>
              <span className={`text-[11px] ${t.subtext}`}>Avg ★ • last {range}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className={`text-left text-[11px] sm:text-xs uppercase tracking-wide ${t.subtext}`}>
                    <th className={`${t.border} border-b px-3 sm:px-4 py-2 sm:py-3`}>Name</th>
                    <th className={`${t.border} border-b px-3 sm:px-4 py-2 sm:py-3`}>Role</th>
                    <th className={`${t.border} border-b px-3 sm:px-4 py-2 sm:py-3`}>Avg ★</th>
                    <th className={`${t.border} border-b px-3 sm:px-4 py-2 sm:py-3`}># Ratings</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRatings.map((s) => (
                    <tr key={s.id} className={`group/row ${t.hoverRow}`}>
                      <td className={`${t.border} border-b px-3 sm:px-4 py-3 text-sm`}>
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar name={s.name} isDark={isDark} t={t} />
                          <span className="truncate" title={s.name}>
                            {s.name}
                          </span>
                        </div>
                      </td>
                      <td className={`${t.border} border-b px-3 sm:px-4 py-3 text-sm`}>
                        <span className={`inline-block rounded-full ${t.chipBorder} ${t.chipBg} px-2 py-[1px] text-[11px]`}>
                          {s.role}
                        </span>
                      </td>
                      <td className={`${t.border} border-b px-3 sm:px-4 py-3 text-sm font-semibold`}>
                        ★{Number(s.avg).toFixed(2)}
                      </td>
                      <td className={`${t.border} border-b px-3 sm:px-4 py-3 text-sm`}>{s.count}</td>
                    </tr>
                  ))}
                  {!staffRatings.length && (
                    <tr>
                      <td className={`px-4 py-6 text-sm ${t.subtext}`} colSpan={4}>
                        No ratings in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`rounded-3xl ${t.border} ${t.cardBg} p-5 backdrop-blur-xl`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Idle Engineers (no accepted tasks)</h3>
              <Link to="/sa/staff" className={`text-xs underline ${isDark ? "text-white/80 hover:text-white" : "text-slate-700 hover:text-slate-900"}`}>
                Manage
              </Link>
            </div>

            <ul className="divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,.1)" : "rgba(2,6,23,.08)" }}>
              {idleStaff.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={u.name} isDark={isDark} t={t} />
                    <div className="min-w-0">
                      <div className="truncate font-medium" title={u.name}>
                        {u.name}
                      </div>
                      <div className={`truncate text-[11px] ${t.subtext}`} title={u.email}>
                        {u.email}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full ${t.chipBorder} ${t.chipBg} px-2 py-[2px] text-[11px]`}>
                    <Shield className="h-3.5 w-3.5 opacity-80" />
                    {u.role}
                  </span>
                </li>
              ))}
              {!idleStaff.length && (
                <li className={`py-3 text-sm ${t.subtext}`}>No idle engineers 🎉</li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ==================== Small UI Atoms ==================== */
function KpiCard({ icon, label, value, hint, accent = "from-indigo-500/40 to-violet-500/30", isDark, t }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl ${t.border} ${t.cardBgSoft} p-5 sm:p-6 shadow-[0_10px_26px_rgba(0,0,0,.12)] backdrop-blur-xl transition-transform hover:-translate-y-0.5`}
    >
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${accent} opacity-60 blur-2xl transition-all group-hover:scale-110`} />
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-2xl ${t.border} ${t.chipBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`truncate text-[11px] sm:text-xs uppercase tracking-wide ${t.subtext}`} title={label}>
            {label}
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">{value}</p>
          {hint && <p className={`mt-1 text-[11px] ${t.subtextDim}`}>{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, className = "", children, t }) {
  return (
    <div
      className={`rounded-3xl ${t.border} ${t.cardBg} p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,.12)] backdrop-blur-xl ${className}`}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className={`text-[11px] ${t.subtext}`}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function SkeletonCard({ isDark, t }) {
  return (
    <div className={`h-28 animate-pulse rounded-3xl ${t.border} ${t.cardBg}`} />
  );
}

function Avatar({ name = "", isDark, t }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className={`grid h-8 w-8 place-items-center rounded-full ${t.border} ${t.chipBg} text-[11px] font-semibold`}>
      {initials || "?"}
    </div>
  );
}

function DarkTooltip({ active, payload, label, isDark, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={`rounded-2xl ${t.border} ${t.tooltipBg} px-3 py-2 text-[11px] ${t.tooltipText} shadow-lg backdrop-blur-md`}>
      <div className={`${isDark ? "text-white/80" : "text-slate-700"} mb-1`}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span className="truncate">{p.name}</span>
          <span className="font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ==================== Utils ==================== */
function fmt(v) {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}
