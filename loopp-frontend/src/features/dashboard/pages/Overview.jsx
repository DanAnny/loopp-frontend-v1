// src/pages/SuperAdminDashboardFull.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  RefreshCcw, Filter, Users, Briefcase, ClipboardList, CheckCircle2, UserCheck, UserCog,
  Zap, Shield, Clock, Activity as ActivityIcon, Star, TrendingUp, Target, Layers
} from "lucide-react";
import dashboard from "@/services/dashboard.service";

/** Full SuperAdmin Dashboard — “Command Center” */
export default function SuperAdminDashboardFull() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("month");         // month | quarter
  const [granularity, setGranularity] = useState("day"); // day | week
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await dashboard.superOverview(range, granularity);
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
  }, [range, granularity]);

  // Unpack (with safe defaults)
  const totals = data?.totals || {};
  const lineSeries = data?.charts?.lineSeries || [];     // [{ date, requested, assigned, accepted, completed }]
  const roleBars = data?.charts?.roleBars || [];         // [{ role, active, idle, total }]
  const funnel = data?.charts?.funnel || buildFunnel(lineSeries);
  const sla = data?.sla || { onTimeRate: null, overdueRate: null, avgCycleDays: null };
  const ratings = data?.ratings || {};
  const ratingDist = ratings?.distribution || [];        // [{ stars: 5, count: 12 }, ...]
  const leaders = ratings?.leaders || { pm: [], engineer: [] }; // [{ id, name, avg, count }]
  const activity = data?.activity || [];                 // [{ id, time, text, actor }]
  const clients = data?.clients || [];                   // [{ name, projects, growth }]
  const pmActivity = data?.pmActivity || [];             // for radar [{ metric, value }]
  const projects = data?.projects || [];                 // compact table

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0B0B0E] via-[#0D0D12] to-[#0B0B0E] text-white">
      {/* Ambient glow + grid */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-20%,rgba(93,95,239,.15),transparent),radial-gradient(1000px_600px_at_90%_0%,rgba(236,72,153,.12),transparent)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-overlay-dark opacity-[.08]" />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,.35)]">
            <div className="absolute inset-0 bg-[radial-gradient(850px_380px_at_8%_0%,rgba(93,95,239,.18),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(850px_380px_at_92%_0%,rgba(236,72,153,.14),transparent)]" />
            <div className="relative flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
                  SuperAdmin Command Center
                </h1>
                <p className="mt-1 text-sm text-white/70">
                  End-to-end visibility across pipeline, staff, SLA & satisfaction
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                  <Filter className="h-4 w-4 opacity-80" />
                  <label className="text-xs text-white/60">Range</label>
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className="bg-transparent text-sm outline-none"
                  >
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                  </select>
                  <div className="mx-1 h-4 w-px bg-white/10" />
                  <label className="text-xs text-white/60">Granularity</label>
                  <select
                    value={granularity}
                    onChange={(e) => setGranularity(e.target.value)}
                    className="bg-transparent text-sm outline-none"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                  </select>
                </div>

                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/20 active:scale-[.98]"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>

                <nav className="hidden md:flex items-center gap-2">
                  <NavLink to="/sa/add-admin">Add Admin</NavLink>
                  <NavLink to="/sa/staff">Manage Staff</NavLink>
                  <NavLink to="/sa/rejections">Rejections</NavLink>
                </nav>
              </div>
            </div>
          </div>
        </header>

        {/* Error */}
        {err && (
          <div className="mb-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-rose-200">
            {err}
          </div>
        )}

        {/* KPI Row */}
        <section className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <KpiCard
                icon={<ClipboardList className="h-5 w-5" />}
                label="Total Project Requests"
                value={fmt(totals.totalRequests)}
                hint="All time pipeline intake"
                accent="from-indigo-500/40 to-blue-500/30"
              />
              <KpiCard
                icon={<Briefcase className="h-5 w-5" />}
                label="Assigned (Range)"
                value={fmt(totals.assignedThisRange)}
                hint="Engineer assigned"
                accent="from-violet-500/40 to-fuchsia-500/30"
              />
              <KpiCard
                icon={<UserCheck className="h-5 w-5" />}
                label="Accepted by Engineers"
                value={fmt(totals.acceptedThisRange)}
                hint="Moved to In-Progress"
                accent="from-emerald-500/40 to-lime-500/30"
              />
              <KpiCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Completed (Range)"
                value={fmt(totals.completedThisRange)}
                hint="Marked Complete"
                accent="from-amber-500/40 to-orange-500/30"
              />
            </>
          )}
        </section>

        {/* Staffing KPIs */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <KpiCard
                icon={<Users className="h-5 w-5" />}
                label="Staff (Total)"
                value={fmt(totals?.staff?.total)}
                hint="All roles"
                accent="from-sky-500/40 to-cyan-500/30"
              />
              <KpiCard
                icon={<UserCog className="h-5 w-5" />}
                label="PM / Engineer / Admin"
                value={`${fmt(totals?.staff?.pm)} / ${fmt(totals?.staff?.engineer)} / ${fmt(totals?.staff?.admin)}`}
                hint="Role breakdown"
                accent="from-fuchsia-500/40 to-pink-500/30"
              />
              <KpiCard
                icon={<Zap className="h-5 w-5" />}
                label="Active PM / Eng"
                value={`${fmt((roleBars?.[0]?.active))} / ${fmt((roleBars?.[1]?.active))}`}
                hint="Busy or Online"
                accent="from-green-500/40 to-emerald-500/30"
              />
            </>
          )}
        </section>

        {/* Pipeline + Funnel */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <ChartCard
            title="Pipeline Velocity"
            subtitle="Requested → Assigned → Accepted → Completed"
            className="lg:col-span-2"
          >
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={lineSeries}>
                <defs>
                  {grad("gReq", "#7c83ff")}
                  {grad("gAss", "#d946ef")}
                  {grad("gAcc", "#22c55e")}
                  {grad("gCom", "#f59e0b")}
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,.7)", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,.7)", fontSize: 12 }} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ color: "rgba(255,255,255,.8)" }} />
                <Area type="monotone" dataKey="requested" stroke="#7c83ff" strokeWidth={2} fill="url(#gReq)" activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="assigned"  stroke="#d946ef" strokeWidth={2} fill="url(#gAss)" activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="accepted"  stroke="#22c55e" strokeWidth={2} fill="url(#gAcc)" activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="completed" stroke="#f59e0b" strokeWidth={2} fill="url(#gCom)" activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Conversion Funnel" subtitle="From intake to done">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={funnel}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="stage" tick={{ fill: "rgba(255,255,255,.8)" }} />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,.8)" }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" fill="#7c83ff" radius={[10, 10, 0, 0]} />
                <Line dataKey="rate" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Staff Utilization + SLA */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <ChartCard title="Staff by Role" subtitle="Active vs Idle vs Total" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={roleBars}>
                <defs>
                  {barGrad("bActive", "#22c55e")}
                  {barGrad("bIdle", "#f43f5e")}
                  {barGrad("bTotal", "#38bdf8")}
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="role" tick={{ fill: "rgba(255,255,255,.8)" }} />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,.8)" }} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ color: "rgba(255,255,255,.8)" }} />
                <Bar dataKey="active" stackId="a" fill="url(#bActive)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="idle" stackId="a" fill="url(#bIdle)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="total" fill="url(#bTotal)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-rows-3 gap-4">
            <MeterCard icon={<Clock className="h-4 w-4" />} label="On-Time Delivery" value={sla.onTimeRate} suffix="%" />
            <MeterCard icon={<Clock className="h-4 w-4" />} label="Overdue Share" value={sla.overdueRate} suffix="%" tone="rose" />
            <MiniStat icon={<TrendingUp className="h-4 w-4" />} label="Avg Cycle Time" value={fmtDays(sla.avgCycleDays)} hint="Request → Complete" />
          </div>
        </section>

        {/* Ratings + PM Radar */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <ChartCard title="Rating Distribution" subtitle="Customer satisfaction spread (★)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratingDist}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="stars" tick={{ fill: "rgba(255,255,255,.8)" }} />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,.8)" }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="PM Activity Radar" subtitle="Distribution across actions">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={pmActivity.length ? pmActivity : defaultRadar()}>
                <PolarGrid stroke="rgba(255,255,255,.2)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,.85)" }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#7c83ff" fill="#7c83ff" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top Leaders" subtitle="Best rated PMs & Engineers">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <LeaderList title="PM" items={leaders.pm || []} />
              <LeaderList title="Engineer" items={leaders.engineer || []} />
            </div>
          </ChartCard>
        </section>

        {/* Clients + Activity + Projects */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
          <ChartCard title="Top Clients" subtitle="Volume & recent growth">
            <div className="space-y-2">
              {(clients || []).slice(0, 8).map((c, i) => (
                <div key={c.name + i} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="text-[11px] text-white/70">{fmt(c.projects)} projects</div>
                  </div>
                  <span className={`text-xs ${Number(c.growth) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {Number(c.growth) >= 0 ? "▲" : "▼"} {Math.abs(Number(c.growth) || 0)}%
                  </span>
                </div>
              ))}
              {!clients?.length && <EmptyNote>We’ll list your top clients here.</EmptyNote>}
            </div>
          </ChartCard>

          <ChartCard title="Recent Activity" subtitle="Latest org events">
            <ul className="divide-y divide-white/10">
              {(activity || []).slice(0, 10).map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2">
                  <div className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/10">
                    <ActivityIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate">{a.text}</div>
                    <div className="text-[11px] text-white/70">{a.actor} • {a.time}</div>
                  </div>
                </li>
              ))}
              {!activity?.length && <EmptyNote>No activity in this range.</EmptyNote>}
            </ul>
          </ChartCard>

          <ChartCard title="Projects (Compact)" subtitle="Latest requests">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide text-white/70">
                    <th className="border-b border-white/10 px-3 py-2">Title</th>
                    <th className="border-b border-white/10 px-3 py-2">Client</th>
                    <th className="border-b border-white/10 px-3 py-2">PM</th>
                    <th className="border-b border-white/10 px-3 py-2">Engineer</th>
                    <th className="border-b border-white/10 px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(projects || []).slice(0, 8).map((p) => (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="border-b border-white/10 px-3 py-2 text-sm">{p.title}</td>
                      <td className="border-b border-white/10 px-3 py-2 text-sm">{p.client}</td>
                      <td className="border-b border-white/10 px-3 py-2 text-sm">{p.pm || "—"}</td>
                      <td className="border-b border-white/10 px-3 py-2 text-sm">{p.engineer || "—"}</td>
                      <td className="border-b border-white/10 px-3 py-2 text-sm">
                        <StatusPill status={p.status} />
                      </td>
                    </tr>
                  ))}
                  {!projects?.length && (
                    <tr>
                      <td className="px-3 py-4 text-sm text-white/70" colSpan={5}>
                        No projects to show.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </section>
      </div>
    </main>
  );
}

/* ==================== UI Bits ==================== */
function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/20"
    >
      {children}
    </Link>
  );
}

function KpiCard({ icon, label, value, hint, accent = "from-indigo-500/40 to-violet-500/30" }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[.06] p-5 sm:p-6 shadow-[0_10px_26px_rgba(0,0,0,.35)] backdrop-blur-xl transition-transform hover:-translate-y-0.5">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${accent} opacity-60 blur-2xl transition-all group-hover:scale-110`} />
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/10">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] sm:text-xs uppercase tracking-wide text-white/70" title={label}>
            {label}
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-white/60">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, className = "", children }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,.35)] backdrop-blur-xl ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-white/70">{subtitle}</p>}
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-white/60">
          <Layers className="h-4 w-4 opacity-70" />
          <span>Live</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl" />;
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1115]/95 px-3 py-2 text-[11px] text-white/90 shadow-lg backdrop-blur-md">
      {label && <div className="mb-1 text-white/80">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span className="truncate">{p.name || p.dataKey}</span>
          <span className="font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function MeterCard({ icon, label, value, suffix = "", tone = "emerald" }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, Number(value)));
  const color = tone === "rose" ? "#f43f5e" : "#22c55e";
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-white/80">
        <div className="grid h-7 w-7 place-items-center rounded-xl border border-white/10 bg-white/10">{icon}</div>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <div
          className="grid h-16 w-16 place-items-center rounded-full"
          style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,.06) 0deg)` }}
        >
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[#0F1115] text-sm font-bold">
            {value == null ? "—" : `${Number(value).toFixed(0)}${suffix}`}
          </div>
        </div>
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, hint }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-1 flex items-center gap-2 text-white/80">
        <div className="grid h-7 w-7 place-items-center rounded-xl border border-white/10 bg-white/10">{icon}</div>
        <div className="text-sm font-semibold">{label}</div>
      </div>
      <div className="text-xl font-black">{value}</div>
      {hint && <div className="text-[11px] text-white/60">{hint}</div>}
    </div>
  );
}

function LeaderList({ title, items }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-300" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <ul className="space-y-2">
        {(items || []).slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{p.name}</div>
              <div className="text-[11px] text-white/70">{p.count} ratings</div>
            </div>
            <div className="text-sm font-bold">★{Number(p.avg).toFixed(2)}</div>
          </li>
        ))}
        {!items?.length && <EmptyNote>No leaders yet.</EmptyNote>}
      </ul>
    </div>
  );
}

function StatusPill({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    pending: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
    review: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    progress: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
    complete: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    closed: "bg-white/10 text-white/80 border-white/20",
  };
  const cls = map[s] || "bg-white/10 text-white/80 border-white/20";
  return <span className={`inline-block rounded-full border px-2 py-[2px] text-[11px] ${cls}`}>{status || "—"}</span>;
}

function EmptyNote({ children }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">{children}</div>;
}

/* ==================== Helpers ==================== */
function fmt(v) {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}
function fmtDays(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}d`;
}
function grad(id, color) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1" key={id}>
      <stop offset="10%" stopColor={color} stopOpacity={0.8} />
      <stop offset="90%" stopColor={color} stopOpacity={0.06} />
    </linearGradient>
  );
}
function barGrad(id, color) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1" key={id}>
      <stop offset="0%" stopColor={color} stopOpacity={0.9} />
      <stop offset="100%" stopColor={color} stopOpacity={0.3} />
    </linearGradient>
  );
}
function buildFunnel(series = []) {
  if (!series.length) {
    return [
      { stage: "Requested", count: 0, rate: 100 },
      { stage: "Assigned", count: 0, rate: 0 },
      { stage: "Accepted", count: 0, rate: 0 },
      { stage: "Completed", count: 0, rate: 0 },
    ];
  }
  const sum = (k) => series.reduce((acc, d) => acc + (Number(d[k]) || 0), 0);
  const requested = Math.max(1, sum("requested"));
  const assigned = sum("assigned");
  const accepted = sum("accepted");
  const completed = sum("completed");
  return [
    { stage: "Requested", count: requested, rate: 100 },
    { stage: "Assigned",  count: assigned,  rate: Math.round((assigned / requested) * 100) },
    { stage: "Accepted",  count: accepted,  rate: Math.round((accepted / requested) * 100) },
    { stage: "Completed", count: completed, rate: Math.round((completed / requested) * 100) },
  ];
}
function defaultRadar() {
  return [
    { metric: "Assign", value: 0 },
    { metric: "Reopen", value: 0 },
    { metric: "Review", value: 0 },
    { metric: "Follow-ups", value: 0 },
    { metric: "Close", value: 0 },
  ];
}
