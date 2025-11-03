// src/pages/AdminHomePage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion"; // v11
import {
  Users2,
  ClipboardList,
  CheckCircle2,
  Wrench,
  RefreshCw,
  Award,
  BarChart3,
  Settings,
  ArrowRight,
  Shield,
  Clock,
  Download,
  Briefcase,
  Zap,
  Activity,
} from "lucide-react";
import dashboard from "@/services/dashboard.service";
import userService from "@/services/users.service";

function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setErr("");

      const [{ data: d }, { data: u }] = await Promise.all([
        dashboard.overview(range),
        userService.getAll(),
      ]);

      setData(d?.data ?? null);
      const list = Array.isArray(u?.users) ? u.users : Array.isArray(u) ? u : [];
      setUsers(list);
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
  const staffRatings = data?.staff?.ratings || [];

  const bestRating = staffRatings.length
    ? [...staffRatings].sort((a, b) => b.avg - a.avg || b.count - a.count)[0]
    : null;

  // Split users → clients vs staff
  const { staff, clients } = useMemo(() => {
    const roleOf = (x) => (x?.role || x?.Role || "").toString();
    const STAFF_ROLES = new Set(["SuperAdmin", "Admin", "PM", "Engineer"]);
    const _clients = [];
    const _staff = [];
    for (const u of users) {
      const r = roleOf(u);
      if (r === "Client") _clients.push(u);
      else if (STAFF_ROLES.has(r)) _staff.push(u);
    }
    return { staff: _staff, clients: _clients };
  }, [users]);

  // Counts for KPI
  const staffCounts = useMemo(() => {
    const roleOf = (x) => (x?.role || x?.Role || "").toString();
    const pms = staff.filter((s) => roleOf(s) === "PM").length;
    const eng = staff.filter((s) => roleOf(s) === "Engineer").length;
    const admins = staff.filter((s) => roleOf(s) === "Admin").length;
    const superAdmins = staff.filter((s) => roleOf(s) === "SuperAdmin").length;
    return { total: staff.length, pms, eng, admins, superAdmins };
  }, [staff]);

  return (
    <div className="min-h-screen bg-[#0f1729] px-6 py-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl text-white">Admin Dashboard</h1>
            </div>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Requests • Staffing • Day-to-day operations
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-[#1a2332] text-white px-3 py-2.5 rounded-lg border border-slate-700/50">
              <label className="text-xs text-slate-400 mr-2">Range</label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="bg-transparent outline-none text-sm cursor-pointer"
              >
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>

            <button className="bg-[#1a2332] text-white px-4 py-2.5 rounded-lg text-sm border border-slate-700/50 hover:bg-[#1f2937] transition-colors inline-flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={load}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2.5 rounded-lg text-sm hover:from-blue-500 hover:to-cyan-500 transition-all disabled:opacity-50 inline-flex items-center gap-2 font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </motion.button>
          </div>
        </motion.div>

        {/* Error */}
        {err && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm"
          >
            {err}
          </motion.div>
        )}

        {/* Project Stats KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Total Requests"
            value={fmt(totals?.totalRequests)}
            subtitle="All time"
            icon={<ClipboardList className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-purple-500 to-purple-600"
            delay={0.1}
            loading={loading}
          />
          <StatCard
            label="Assigned"
            value={fmt(totals?.assignedThisRange)}
            subtitle="This range"
            icon={<Briefcase className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-amber-500 to-amber-600"
            delay={0.15}
            loading={loading}
          />
          <StatCard
            label="Accepted"
            value={fmt(totals?.acceptedThisRange)}
            subtitle="In progress"
            icon={<Activity className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
            delay={0.2}
            loading={loading}
          />
          <StatCard
            label="Completed"
            value={fmt(totals?.completedThisRange)}
            subtitle="This range"
            icon={<CheckCircle2 className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
            delay={0.25}
            loading={loading}
          />
        </div>

        {/* Staffing KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <StatCard
            label="Total Staff"
            value={fmt(staffCounts.total)}
            subtitle={`${fmt(staffCounts.superAdmins)} SA • ${fmt(staffCounts.admins)} Admin • ${fmt(staffCounts.pms)} PM • ${fmt(staffCounts.eng)} Eng`}
            icon={<Users2 className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-sky-500 to-sky-600"
            delay={0.3}
            loading={loading}
          />
          <StatCard
            label="Active PMs"
            value={fmt(totals?.activePMs)}
            subtitle={`${fmt(totals?.idlePMs)} idle`}
            icon={<Wrench className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-indigo-500 to-indigo-600"
            delay={0.35}
            loading={loading}
          />
          <StatCard
            label="Active Engineers"
            value={fmt(totals?.activeEngineers)}
            subtitle={`${fmt(totals?.idleEngineers)} idle`}
            icon={<Zap className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-teal-500 to-teal-600"
            delay={0.4}
            loading={loading}
          />
        </div>

        {/* Spotlight */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-8 rounded-2xl bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-slate-600" />
              <h3 className="text-sm uppercase tracking-[0.2em] text-slate-600 font-semibold">
                Spotlight
              </h3>
            </div>
            <div className="flex gap-2">
              <Link
                to="/analytics"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-black/90 rounded-lg text-sm"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <InfoTile
              title="Best Performer"
              value={bestRating ? `★ ${Number(bestRating.avg).toFixed(2)}` : "—"}
              desc={
                bestRating
                  ? `${bestRating.name} • ${bestRating.role} • ${bestRating.count} rating(s)`
                  : "No ratings in this range"
              }
              icon={<Award className="w-4 h-4 text-amber-600" />}
              highlight
            />
            <InfoTile
              title="Staff Mix"
              value={`${fmt(staffCounts.pms)} PM / ${fmt(staffCounts.eng)} Eng`}
              desc={`${fmt(staffCounts.admins)} Admin • ${fmt(staffCounts.superAdmins)} SuperAdmin`}
              icon={<Users2 className="w-4 h-4 text-blue-600" />}
            />
          </div>
        </motion.div>

        {/* Clients Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="rounded-2xl bg-white shadow-sm overflow-hidden mb-8"
        >
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-[0.2em] text-slate-600 font-semibold">
              Clients
            </h3>
            <Link to="/clients" className="text-xs text-slate-600 hover:text-slate-900 underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900 text-white">
                <tr className="text-left">
                  <Th>Name</Th>
                  <Th>Email</Th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <SkeletonRows rows={6} cols={2} />
                ) : clients.length ? (
                  clients.slice(0, 6).map((c, idx) => (
                    <motion.tr
                      key={c._id || idx}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <Td>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            name={`${c.firstName || c.first_name || ""} ${c.lastName || c.last_name || ""}`}
                          />
                          <span className="font-medium text-slate-900 truncate">
                            {(c.firstName || c.first_name || "")} {(c.lastName || c.last_name || "")}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-slate-600 block max-w-[320px] truncate sm:max-w-none">
                          {c.email || "—"}
                        </span>
                      </Td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-12 text-center text-slate-400" colSpan={2}>
                      No clients yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Staff Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl bg-white shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-[0.2em] text-slate-600 font-semibold">
              Staff (SuperAdmin • Admin • PM • Engineer)
            </h3>
            <Link to="/staff" className="text-xs text-slate-600 hover:text-slate-900 underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900 text-white">
                <tr className="text-left">
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Email</Th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <SkeletonRows rows={6} cols={3} />
                ) : staff.length ? (
                  staff.slice(0, 8).map((s, idx) => (
                    <motion.tr
                      key={s._id || idx}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <Td>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            name={`${s.firstName || s.first_name || ""} ${s.lastName || s.last_name || ""}`}
                          />
                          <span className="font-medium text-slate-900 truncate">
                            {(s.firstName || s.first_name || "")} {(s.lastName || s.last_name || "")}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <RoleBadge role={s.role || s.Role} />
                      </Td>
                      <Td>
                        <span className="text-slate-600 block max-w-[320px] truncate sm:max-w-none">
                          {s.email || "—"}
                        </span>
                      </Td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-12 text-center text-slate-400" colSpan={3}>
                      No staff yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="h-32 rounded-xl bg-[#1a2332] animate-pulse"
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
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
    </motion.div>
  );
}

function InfoTile({ title, value, desc, icon, highlight }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`rounded-xl border p-5 transition-all ${
        highlight ? "bg-gradient-to-br from-amber-50 to-white border-amber-200" : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="text-xs uppercase tracking-[0.15em] text-slate-600 font-semibold">{title}</div>
      </div>
      <div className="text-2xl mb-2 text-slate-900 font-bold">{value}</div>
      <div className="text-xs text-slate-600">{desc}</div>
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
  const colorIndex = (name || "?").length % colors.length;

  return (
    <div className={`w-9 h-9 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white text-xs font-semibold shadow-md`}>
      {initials || "?"}
    </div>
  );
}

function RoleBadge({ role }) {
  const r = (role || "").toString();
  const colors = {
    SuperAdmin: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300",
    Admin: "bg-red-100 text-red-700 border-red-300",
    PM: "bg-blue-100 text-blue-700 border-blue-300",
    Engineer: "bg-emerald-100 text-emerald-700 border-emerald-300",
    Client: "bg-slate-100 text-slate-700 border-slate-300",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 text-xs rounded-lg border font-medium ${
        colors[r] || "bg-gray-100 text-gray-700 border-gray-300"
      }`}
    >
      {r || "—"}
    </span>
  );
}

function Th({ children }) {
  return <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.15em]">{children}</th>;
}

function Td({ children }) {
  return <td className="px-5 py-4 align-middle">{children}</td>;
}

function SkeletonRows({ rows = 6, cols = 3 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {Array.from({ length: cols }).map((__, j) => (
            <Td key={j}>
              <div className="h-4 bg-slate-100 rounded animate-pulse" />
            </Td>
          ))}
        </tr>
      ))}
    </>
  );
}

function fmt(v) {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}

export default AdminHomePage; // ⬅️ remove this line if you truly want *no* export
