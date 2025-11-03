// src/pages/SuperAdminHomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion"; // v11
import {
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  UserCheck,
  RefreshCcw,
  Award,
  AlertCircle,
  TrendingUp,
  Activity,
  Clock,
  Download,
  Filter,
  Calendar,
  Shield,
  Zap,
  BarChart3,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import dashboard from "@/services/dashboard.service";

export default function SuperAdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

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
  const recentActivity = data?.recentActivity || [];
  const projectStatus = data?.charts?.projectStatus || [];

  return (
    <div className="min-h-screen bg-[#0f1729] px-6 py-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl text-white">SuperAdmin Dashboard</h1>
            </div>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Real-time organization overview and analytics
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-[#1a2332] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-slate-700/50 cursor-pointer hover:bg-[#1f2937] transition-colors"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>

            <button className="bg-[#1a2332] text-white px-4 py-2.5 rounded-lg text-sm border border-slate-700/50 hover:bg-[#1f2937] transition-colors inline-flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={load}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-lg text-sm hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 inline-flex items-center gap-2 font-medium"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </motion.button>
          </div>
        </motion.div>

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

        {/* Top Stats - 4 cards (no percentages) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Total Requests"
            value={fmt(totals.totalRequests)}
            subtitle="All time"
            icon={<ClipboardList className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-purple-500 to-purple-600"
            delay={0.1}
            loading={loading}
          />
          <StatCard
            label="Assigned"
            value={fmt(totals.assignedThisRange)}
            subtitle="This period"
            icon={<Activity className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-orange-500 to-orange-600"
            delay={0.15}
            loading={loading}
          />
          <StatCard
            label="In Progress"
            value={fmt(totals.acceptedThisRange)}
            subtitle="Active tasks"
            icon={<TrendingUp className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-teal-500 to-teal-600"
            delay={0.2}
            loading={loading}
          />
          <StatCard
            label="Completed"
            value={fmt(totals.completedThisRange)}
            subtitle="This period"
            icon={<CheckCircle2 className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-pink-500 to-pink-600"
            delay={0.25}
            loading={loading}
          />
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          <Link to="/staffs/new">
            <QuickActionButton icon={<UserPlus className="w-5 h-5" />} label="Add Staff" />
          </Link>
          <Link to="/dashboard">
            <QuickActionButton icon={<BarChart3 className="w-5 h-5" />} label="Dashboard" />
          </Link>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Pipeline Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-slate-900 font-semibold mb-1">Pipeline Velocity</h3>
                <p className="text-slate-500 text-sm">Daily progress tracking over time</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                  <Calendar className="w-4 h-4" />
                </button>
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-[320px] bg-slate-50 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={lineSeries} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gAss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gCom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} stroke="#e2e8f0" />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} stroke="#e2e8f0" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
                  <Area type="monotone" dataKey="requested" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gReq)" name="Requested" />
                  <Area type="monotone" dataKey="assigned"  stroke="#f97316" strokeWidth={2.5} fill="url(#gAss)" name="Assigned" />
                  <Area type="monotone" dataKey="accepted"  stroke="#14b8a6" strokeWidth={2.5} fill="url(#gAcc)" name="Accepted" />
                  <Area type="monotone" dataKey="completed" stroke="#ec4899" strokeWidth={2.5} fill="url(#gCom)" name="Completed" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Staff by Role */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="text-slate-900 font-semibold mb-1">Staff Distribution</h3>
              <p className="text-slate-500 text-sm">By role and status</p>
            </div>

            {loading ? (
              <div className="h-[320px] bg-slate-50 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={roleBars} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="role" tick={{ fill: "#64748b", fontSize: 11 }} stroke="#e2e8f0" />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} stroke="#e2e8f0" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                  <Bar dataKey="active" fill="#22c55e" radius={[6, 6, 0, 0]} name="Active" />
                  <Bar dataKey="idle"   fill="#ef4444" radius={[6, 6, 0, 0]} name="Idle" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* Bottom Grid - Top Performers & Idle Staff */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Performers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-slate-900 font-semibold mb-1 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Top Performers
                </h3>
                <p className="text-slate-500 text-sm">Highest rated staff members</p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                Last {range}
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : staffRatings.length ? (
              <div className="space-y-3">
                {staffRatings.map((s, idx) => (
                  <motion.div
                    key={s.id || idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + idx * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <Avatar name={s.name} />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center border-2 border-white">
                          <span className="text-xs">#{idx + 1}</span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-slate-900 text-sm font-medium truncate">{s.name}</div>
                        <div className="text-slate-500 text-xs">{s.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-amber-600">
                        <Award className="w-4 h-4" />
                        <span className="text-sm font-semibold">{Number(s.avg).toFixed(1)}</span>
                      </div>
                      <div className="text-xs text-slate-400">{s.count} reviews</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">No ratings in this range</div>
            )}
          </motion.div>

          {/* Idle Engineers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-slate-900 font-semibold mb-1 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  Idle Engineers
                </h3>
                <p className="text-slate-500 text-sm">Staff with no active tasks</p>
              </div>
              <Link to="/staffs" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Manage →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : idleStaff.length ? (
              <div className="space-y-3">
                {idleStaff.map((u, idx) => (
                  <motion.div
                    key={u.id || idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.65 + idx * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.name} />
                      <div className="min-w-0">
                        <div className="text-slate-900 text-sm font-medium truncate">{u.name}</div>
                        <div className="text-slate-500 text-xs truncate">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status="idle" />
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-700">
                        <UserCheck className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-slate-900 font-medium mb-1">All engineers active!</p>
                <p className="text-slate-500 text-sm">Everyone is assigned to tasks 🎉</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Staff Overview Stats (no “+3 this month”) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5"
        >
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-2xl text-slate-900 font-semibold">{fmt(totals?.staff?.total)}</div>
                <div className="text-sm text-slate-500">Total Staff</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>All roles</span>
              <TrendingUp className="w-3 h-3 opacity-50" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-lg text-slate-900 font-semibold">
                  {fmt(totals?.staff?.pm)} / {fmt(totals?.staff?.engineer)} / {fmt(totals?.staff?.admin)}
                </div>
                <div className="text-sm text-slate-500">PM / Eng / Admin</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Role distribution</span>
              <Zap className="w-3 h-3 opacity-50" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-lg text-slate-900 font-semibold">
                  {fmt(roleBars?.[0]?.active || 0)} / {fmt(roleBars?.[1]?.active || 0)}
                </div>
                <div className="text-sm text-slate-500">PM / Eng Active</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Currently working</span>
              <Activity className="w-3 h-3 opacity-50" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* --------------------------------- Components --------------------------------- */
function StatCard({ label, value, subtitle, icon, iconBg, delay, loading }) {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="h-32 rounded-xl bg-[#1a2332] animate-pulse"
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="bg-[#1a2332] rounded-xl p-5 border border-slate-700/30 shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/10 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="text-slate-400 text-sm mb-1">{label}</div>
          <div className="text-white text-3xl mb-1">{value ?? 0}</div>
          <div className="text-slate-500 text-xs">{subtitle}</div>
        </div>
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
      </div>
      {/* trend/percentage removed */}
    </motion.div>
  );
}

function QuickActionButton({ icon, label }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className="bg-[#1a2332] border border-slate-700/30 text-white px-4 py-3 rounded-xl hover:bg-[#1f2937] transition-all inline-flex items-center justify-center gap-2 text-sm font-medium w-full cursor-pointer"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </motion.div>
  );
}

function Avatar({ name = "" }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const colors = [
    "bg-gradient-to-br from-blue-500 to-blue-600",
    "bg-gradient-to-br from-purple-500 to-purple-600",
    "bg-gradient-to-br from-pink-500 to-pink-600",
    "bg-gradient-to-br from-teal-500 to-teal-600",
    "bg-gradient-to-br from-orange-500 to-orange-600",
  ];
  const colorIndex = name.length % colors.length;

  return (
    <div className={`w-10 h-10 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white text-sm font-semibold shadow-md`}>
      {initials || "?"}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    idle: "bg-orange-100 text-orange-700 border-orange-200",
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${styles[status] || styles.idle}`}>
      {status === "idle" ? "Idle" : "Active"}
    </span>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 shadow-xl text-xs">
      <div className="text-slate-900 mb-2 font-semibold">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-6 mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-600">{p.name}</span>
          </div>
          <span className="text-slate-900 font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function fmt(v) {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}
