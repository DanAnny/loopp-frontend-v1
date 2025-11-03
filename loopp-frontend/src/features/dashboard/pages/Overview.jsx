// src/pages/SuperAdminDashboardFull.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Line, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  RefreshCw, Filter, Users, Briefcase, ClipboardList, CheckCircle2, UserCheck, UserCog,
  Zap, Shield, Clock, Activity as ActivityIcon, Star, TrendingUp, Layers,
  Download, AlertTriangle, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import dashboard from "@/services/dashboard.service";

/** Full SuperAdmin Dashboard — "Command Center" (UI upgrade only) */
export default function SuperAdminDashboardFull() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("month");         // month | quarter | year | week
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

  // ---------- Unpack with safe defaults ----------
  const totals     = data?.totals || {};
  const lineSeries = data?.charts?.lineSeries || [];         // [{ date, requested, assigned, accepted, completed }]
  const roleBars   = data?.charts?.roleBars || [];           // [{ role, active, idle, total }]
  const funnel     = data?.charts?.funnel || buildFunnel(lineSeries);

  const sla        = data?.sla || { onTimeRate: null, overdueRate: null, avgCycleDays: null };

  const ratings    = data?.ratings || {};
  const ratingDist = ratings?.distribution || [];            // [{ stars, count }]
  const leaders    = ratings?.leaders || { pm: [], engineer: [] };

  const pmActivity = data?.pmActivity || defaultRadar();     // [{ metric, value }]
  const activity   = data?.activity || [];
  const clients    = data?.clients || [];
  const projects   = data?.projects || [];

  return (
    <main className="min-h-screen bg-[#0f1729] px-6 py-8 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-20%,rgba(93,95,239,.15),transparent),radial-gradient(1000px_600px_at_90%_0%,rgba(236,72,153,.12),transparent)]" />
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl">SuperAdmin Command Center</h1>
            </div>
            <p className="text-slate-300/80 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              End-to-end visibility across pipeline, staff, SLA & satisfaction
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-[#131b2a] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-slate-700/50 cursor-pointer hover:bg-[#172033] transition-colors"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>

            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
              className="bg-[#131b2a] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-slate-700/50 cursor-pointer hover:bg-[#172033] transition-colors"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
            </select>

            <button className="bg-[#131b2a] text-white px-4 py-2.5 rounded-lg text-sm border border-slate-700/50 hover:bg-[#172033] transition-colors inline-flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>

            <button className="bg-[#131b2a] text-white px-4 py-2.5 rounded-lg text-sm border border-slate-700/50 hover:bg-[#172033] transition-colors inline-flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={load}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-lg text-sm hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 inline-flex items-center gap-2 font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </motion.button>
          </div>
        </motion.header>

        {/* Error */}
        {err && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            {err}
          </motion.div>
        )}

        {/* KPI Row (percentages removed) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Total Requests"
            value={fmt(totals.totalRequests)}
            subtitle="All time pipeline"
            icon={<ClipboardList className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-indigo-500 to-blue-600"
            delay={0.05}
            loading={loading}
          />
          <StatCard
            label="Assigned"
            value={fmt(totals.assignedThisRange)}
            subtitle="This period"
            icon={<Briefcase className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-violet-500 to-fuchsia-600"
            delay={0.1}
            loading={loading}
          />
          <StatCard
            label="Accepted"
            value={fmt(totals.acceptedThisRange)}
            subtitle="In progress"
            icon={<UserCheck className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-emerald-500 to-lime-600"
            delay={0.15}
            loading={loading}
          />
          <StatCard
            label="Completed"
            value={fmt(totals.completedThisRange)}
            subtitle="This period"
            icon={<CheckCircle2 className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
            delay={0.2}
            loading={loading}
          />
        </div>

        {/* Staffing KPIs (percentages removed) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <StatCard
            label="Total Staff"
            value={fmt(totals?.staff?.total)}
            subtitle="All roles"
            icon={<Users className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-sky-500 to-cyan-600"
            delay={0.25}
            loading={loading}
          />
          <StatCard
            label="PM / Engineer / Admin"
            value={`${fmt(totals?.staff?.pm)} / ${fmt(totals?.staff?.engineer)} / ${fmt(totals?.staff?.admin)}`}
            subtitle="Role breakdown"
            icon={<UserCog className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-fuchsia-500 to-pink-600"
            delay={0.3}
            loading={loading}
          />
          <StatCard
            label="Active PM / Eng"
            value={`${fmt(roleBars?.[0]?.active || 0)} / ${fmt(roleBars?.[1]?.active || 0)}`}
            subtitle="Currently working"
            icon={<Zap className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-green-500 to-emerald-600"
            delay={0.35}
            loading={loading}
          />
        </div>

        {/* Pipeline + Funnel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
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
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "rgba(226,232,240,0.85)", fontSize: 12 }} stroke="rgba(148,163,184,0.2)" />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(226,232,240,0.85)", fontSize: 12 }} stroke="rgba(148,163,184,0.2)" />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ color: "rgba(226,232,240,0.9)" }} />
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
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="stage" tick={{ fill: "rgba(226,232,240,0.9)", fontSize: 11 }} stroke="rgba(148,163,184,0.2)" />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(226,232,240,0.85)", fontSize: 12 }} stroke="rgba(148,163,184,0.2)" />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" fill="#7c83ff" radius={[10, 10, 0, 0]} />
                <Line dataKey="rate" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Staff Utilization + SLA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <ChartCard title="Staff by Role" subtitle="Active vs Idle vs Total" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={roleBars}>
                <defs>
                  {barGrad("bActive", "#22c55e")}
                  {barGrad("bIdle", "#f43f5e")}
                  {barGrad("bTotal", "#38bdf8")}
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="role" tick={{ fill: "rgba(226,232,240,0.9)" }} stroke="rgba(148,163,184,0.2)" />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(226,232,240,0.85)" }} stroke="rgba(148,163,184,0.2)" />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ color: "rgba(226,232,240,0.9)" }} />
                <Bar dataKey="active" stackId="a" fill="url(#bActive)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="idle"   stackId="a" fill="url(#bIdle)"   radius={[8, 8, 0, 0]} />
                <Bar dataKey="total"  fill="url(#bTotal)"              radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-rows-3 gap-4">
            <MeterCard icon={<Clock className="w-4 h-4" />} label="On-Time Delivery" value={sla.onTimeRate} suffix="%" />
            <MeterCard icon={<Clock className="w-4 h-4" />} label="Overdue Share" value={sla.overdueRate} suffix="%" tone="rose" />
            <MiniStat  icon={<TrendingUp className="w-4 h-4" />} label="Avg Cycle Time" value={fmtDays(sla.avgCycleDays)} hint="Request → Complete" />
          </div>
        </div>

        {/* Ratings + PM Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <ChartCard title="Rating Distribution" subtitle="Customer satisfaction spread (★)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratingDist}>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="stars" tick={{ fill: "rgba(226,232,240,0.9)" }} stroke="rgba(148,163,184,0.2)" />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(226,232,240,0.85)" }} stroke="rgba(148,163,184,0.2)" />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="PM Activity Radar" subtitle="Distribution across actions">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={pmActivity?.length ? pmActivity : defaultRadar()}>
                <PolarGrid stroke="rgba(148,163,184,0.3)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(226,232,240,0.95)", fontSize: 12 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#7c83ff" fill="#7c83ff" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top Leaders" subtitle="Best rated PMs & Engineers">
            <div className="grid grid-cols-1 gap-4">
              <LeaderList title="PM" items={leaders.pm || []} />
              <LeaderList title="Engineer" items={leaders.engineer || []} />
            </div>
          </ChartCard>
        </div>

        {/* Clients + Activity + Projects */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <ChartCard title="Top Clients" subtitle="Volume & recent growth">
            <div className="space-y-2">
              {(clients || []).slice(0, 8).map((c, i) => (
                <motion.div
                  key={String(c.name) + i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-[#131b2a] px-4 py-3 hover:bg-[#172033] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate">{c.name}</div>
                    <div className="text-xs text-slate-300/80">{fmt(c.projects)} projects</div>
                  </div>
                  <span className={`text-xs font-medium ${Number(c.growth) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {Number(c.growth) >= 0 ? <ArrowUpRight className="inline w-4 h-4 mr-1" /> : <ArrowDownRight className="inline w-4 h-4 mr-1" />}
                    {Math.abs(Number(c.growth) || 0)}%
                  </span>
                </motion.div>
              ))}
              {!clients?.length && <EmptyNote>We’ll list your top clients here.</EmptyNote>}
            </div>
          </ChartCard>

          <ChartCard title="Recent Activity" subtitle="Latest org events">
            <ul className="divide-y divide-slate-700/50">
              {(activity || []).slice(0, 10).map((a, idx) => (
                <motion.li
                  key={a.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-start gap-3 py-3"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full border border-slate-700/50 bg-[#131b2a]">
                    <ActivityIcon className="h-4 w-4 text-slate-300/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{a.text}</div>
                    <div className="text-xs text-slate-400">{a.actor} • {a.time}</div>
                  </div>
                </motion.li>
              ))}
              {!activity?.length && <EmptyNote>No activity in this range.</EmptyNote>}
            </ul>
          </ChartCard>

          <ChartCard title="Projects (Compact)" subtitle="Latest requests">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-700/50">
                    <th className="px-3 py-3">Title</th>
                    <th className="px-3 py-3">Client</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(projects || []).slice(0, 8).map((p, idx) => (
                    <motion.tr
                      key={p.id || idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-[#131b2a] border-b border-slate-700/50 transition-colors"
                    >
                      <td className="px-3 py-3 text-sm">{p.title}</td>
                      <td className="px-3 py-3 text-sm text-slate-300">{p.client}</td>
                      <td className="px-3 py-3 text-sm">
                        <StatusPill status={p.status} />
                      </td>
                    </motion.tr>
                  ))}
                  {!projects?.length && (
                    <tr>
                      <td className="px-3 py-4 text-sm text-slate-400" colSpan={3}>
                        No projects to show.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 gap-4"
        >
          <Link to="/sa/add-admin" className="block">
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 p-6 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <UserCog className="w-6 h-6 mb-3" />
              <h3 className="text-sm mb-1">Add Admin</h3>
              <p className="text-xs text-white/80">Create new admin user</p>
            </motion.div>
          </Link>

          <Link to="/sa/staff" className="block">
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Users className="w-6 h-6 mb-3" />
              <h3 className="text-sm mb-1">Manage Staff</h3>
              <p className="text-xs text-white/80">View all team members</p>
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}

/* ==================== UI Components ==================== */
function StatCard({ label, value, subtitle, icon, iconBg, delay = 0, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -3, scale: 1.02 }}
      className="rounded-xl bg-[#131b2a] border border-slate-700/50 p-6 hover:shadow-xl transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconBg} text-white shadow-lg`}>
          {icon}
        </div>
        {/* trend badge removed */}
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-slate-700/30 rounded animate-pulse mb-2" />
      ) : (
        <div className="text-3xl mb-2">{value}</div>
      )}
      <div className="text-xs uppercase tracking-[0.15em] text-slate-400 mb-1">{label}</div>
      {subtitle && <div className="text-xs text-slate-400/80">{subtitle}</div>}
    </motion.div>
  );
}

function ChartCard({ title, subtitle, className = "", children }) {
  return (
    <div className={`rounded-xl border border-slate-700/50 bg-[#131b2a] p-6 shadow-lg ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-300/80 mt-1">{subtitle}</p>}
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <Layers className="h-4 w-4" />
          <span>Live</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700/50 bg-[#131b2a] px-3 py-2 text-xs text-white shadow-lg">
      {label && <div className="mb-1 text-slate-300">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span className="truncate text-slate-400">{p.name || p.dataKey}</span>
          <span className="text-white">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function MeterCard({ icon, label, value, suffix = "", tone = "emerald" }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, Number(value)));
  const color = tone === "rose" ? "#f43f5e" : "#22c55e";
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-[#131b2a] p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-xl border border-slate-700/50 bg-[#172033]">{icon}</div>
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <div
          className="grid h-16 w-16 place-items-center rounded-full"
          style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(148,163,184,.1) 0deg)` }}
        >
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[#0f1729] text-sm">
            {value == null ? "—" : `${Number(value).toFixed(0)}${suffix}`}
          </div>
        </div>
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/30">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-[#131b2a] p-4">
      <div className="mb-1 flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-xl border border-slate-700/50 bg-[#172033]">{icon}</div>
        <div className="text-sm">{label}</div>
      </div>
      <div className="text-xl">{value}</div>
      {hint && <div className="text-xs text-slate-300/80 mt-1">{hint}</div>}
    </div>
  );
}

function LeaderList({ title, items }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-400" />
        <h4 className="text-sm">{title}</h4>
      </div>
      <ul className="space-y-2">
        {(items || []).slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-[#172033] px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm">{p.name}</div>
              <div className="text-xs text-slate-300/80">{p.count} ratings</div>
            </div>
            <div className="text-sm text-amber-400">★{Number(p.avg).toFixed(2)}</div>
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
    pending:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
    review:   "bg-sky-500/20 text-sky-300 border-sky-500/30",
    progress: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    complete: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    closed:   "bg-slate-700/30 text-slate-300 border-slate-600/30",
  };
  const cls = map[s] || "bg-slate-700/30 text-slate-300 border-slate-600/30";
  return <span className={`inline-block rounded-full border px-2 py-1 text-xs ${cls}`}>{status || "—"}</span>;
}

function EmptyNote({ children }) {
  return <div className="rounded-xl border border-slate-700/50 bg-[#172033] px-3 py-4 text-sm text-slate-300/80 text-center">{children}</div>;
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
      { stage: "Assigned",  count: 0, rate: 0 },
      { stage: "Accepted",  count: 0, rate: 0 },
      { stage: "Completed", count: 0, rate: 0 },
    ];
  }
  const sum = (k) => series.reduce((acc, d) => acc + (Number(d[k]) || 0), 0);
  const requested = Math.max(1, sum("requested"));
  const assigned  = sum("assigned");
  const accepted  = sum("accepted");
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
