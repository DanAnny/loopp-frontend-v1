// src/features/projects/pages/Projects.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TriangleAlert,
  RefreshCw,
  Calendar,
  User,
  Search,
  CheckCircle2,
  Clock,
  FolderKanban,
  Hourglass,
  PlayCircle,
  CalendarClock,
  Users as UsersIcon,
  Plus,
  ArrowRight,
  Shield,
} from "lucide-react";

import * as ProjectsApi from "@/services/projects.service";
import * as Users from "@/services/users.service";
import CreateTaskModal from "@/features/tasks/components/CreateTaskModal";

/* -------------------------------- helpers -------------------------------- */
const by = (k) => (a, b) => {
  const av = a?.[k], bv = b?.[k];
  return new Date(bv || 0).getTime() - new Date(av || 0).getTime();
};

const parseISODateOnly = (value) => {
  if (!value || typeof value !== "string") return "";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const dt = new Date(Date.UTC(y, mo, d));
  return Number.isFinite(dt.getTime()) ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

const fmtISODate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (!Number.isFinite(dt.getTime())) return "—";
  return dt.toLocaleDateString();
};

const daysLeftFromISO = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return null;
  const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  const diff = end - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const pickDeadlineISO = (p) =>
  parseISODateOnly(p?.taskDeadline) || parseISODateOnly(p?.completionDate);

// map statuses, include "review"
const normStatus = (s = "") => {
  const t = s.toString().toLowerCase();
  if (t.includes("review")) return "Review";
  if (t.includes("progress")) return "In-Progress";
  if (t.includes("complete")) return "Complete";
  return "Pending";
};

/* ----------------------------- main component ---------------------------- */
export default function PMProjects() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [engMap, setEngMap] = useState({});
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [showCreateTask, setShowCreateTask] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [pRes, eRes] = await Promise.all([
        ProjectsApi.getAll(),
        Users.getEngineers(),
      ]);

      const list = Array.isArray(pRes?.data?.projects)
        ? pRes.data.projects
        : Array.isArray(pRes?.data)
        ? pRes.data
        : [];

      const engineers = Array.isArray(eRes?.data?.engineers)
        ? eRes.data.engineers
        : Array.isArray(eRes?.data?.users)
        ? eRes.data.users
        : [];

      const map = {};
      engineers.forEach((u) => {
        map[String(u._id)] =
          `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() ||
          u.email ||
          "Engineer";
      });
      setEngMap(map);

      setItems([...list].sort(by("updatedAt")));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load projects");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    let pending = 0,
      inprog = 0,
      complete = 0,
      review = 0,
      dueSoon = 0,
      overdue = 0,
      withEng = 0,
      noEng = 0;

    for (const p of items) {
      const st = normStatus(p.status);

      // status tallies
      if (st === "Pending") pending++;
      else if (st === "In-Progress") inprog++;
      else if (st === "Complete") complete++;
      else if (st === "Review") review++;

      // Due Soon / Overdue must ignore completed
      if (st !== "Complete") {
        const deadlineISO = pickDeadlineISO(p);
        const dleft = daysLeftFromISO(deadlineISO);
        if (dleft != null) {
          if (dleft < 0) overdue++;
          else if (dleft <= 5) dueSoon++;
        }
      }

      // engineer assignment counts (kept for Unassigned card)
      if (p.engineerAssigned) withEng++;
      else noEng++;
    }

    return {
      total,
      pending,
      inprog,
      complete,
      review,     // NEW
      dueSoon,    // updated rule
      overdue,    // updated rule
      withEng,
      noEng,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const base = items.filter((p) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      const hay = [
        p.projectTitle,
        p.projectDescription,
        p.firstName,
        p.lastName,
        p.email,
        p.status,
        engMap[String(p.engineerAssigned)] || "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });

    if (tab === "pending") return base.filter((p) => normStatus(p.status) === "Pending");
    if (tab === "inprogress") return base.filter((p) => normStatus(p.status) === "In-Progress");
    if (tab === "complete") return base.filter((p) => normStatus(p.status) === "Complete");
    return base;
  }, [items, q, tab, engMap]);

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
              <h1 className="text-3xl text-white">Projects</h1>
            </div>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Manage requests, assignments, and deliverables
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={load}
              disabled={loading}
              className="bg-[#1a2332] text-white px-4 py-2.5 rounded-lg text-sm border border-slate-700/50 hover:bg-[#1f2937] transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateTask(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-lg text-sm hover:from-purple-500 hover:to-pink-500 transition-all inline-flex items-center gap-2 font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Task
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
            <TriangleAlert className="w-4 h-4" />
            {err}
          </motion.div>
        )}

        {/* Top Stats - 4 cards (no percentages) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Total Projects"
            value={stats.total}
            subtitle="All time"
            icon={<FolderKanban className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-purple-500 to-purple-600"
            delay={0.1}
            loading={loading}
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            subtitle="Awaiting action"
            icon={<Hourglass className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-amber-500 to-amber-600"
            delay={0.15}
            loading={loading}
          />
          <StatCard
            label="In Progress"
            value={stats.inprog}
            subtitle="Active projects"
            icon={<PlayCircle className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
            delay={0.2}
            loading={loading}
          />
          <StatCard
            label="Complete"
            value={stats.complete}
            subtitle="Finished projects"
            icon={<CheckCircle2 className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
            delay={0.25}
            loading={loading}
          />
        </div>

        {/* Additional Stats — Overdue/Due Soon ignore Complete, Assigned -> Review */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Due Soon"
            value={stats.dueSoon}
            subtitle="≤5 days (open)"
            icon={<CalendarClock className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-orange-500 to-orange-600"
            delay={0.3}
            loading={loading}
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            subtitle="Past deadline (open)"
            icon={<TriangleAlert className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-red-500 to-red-600"
            delay={0.35}
            loading={loading}
          />
          <StatCard
            label="Review"
            value={stats.review}
            subtitle="Awaiting approval"
            icon={<UsersIcon className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-teal-500 to-teal-600"
            delay={0.4}
            loading={loading}
          />
          <StatCard
            label="Unassigned"
            value={stats.noEng}
            subtitle="Need assignment"
            icon={<User className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-slate-500 to-slate-600"
            delay={0.45}
            loading={loading}
          />
        </div>

        {/* Search & Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-6 space-y-4"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects, clients, engineers..."
              className="w-full pl-12 pr-6 py-3 bg-[#1a2332] border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-slate-600 transition-colors"
            />
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            <Tab label="All" active={tab === "all"} onClick={() => setTab("all")} count={stats.total} />
            <Tab label="Pending" active={tab === "pending"} onClick={() => setTab("pending")} count={stats.pending} />
            <Tab label="In Progress" active={tab === "inprogress"} onClick={() => setTab("inprogress")} count={stats.inprog} />
            <Tab label="Complete" active={tab === "complete"} onClick={() => setTab("complete")} count={stats.complete} />
          </div>
        </motion.div>

        {/* Projects Table/List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-sm overflow-hidden"
        >
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <div className="max-h-[65vh] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-900 text-white z-10">
                  <tr className="text-left">
                    <Th>Project</Th>
                    <Th>Client</Th>
                    <Th>Engineer</Th>
                    <Th>Status</Th>
                    <Th>Deadline</Th>
                    <Th>Updated</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {loading ? (
                    <SkeletonRows rows={8} cols={7} />
                  ) : filtered.length ? (
                    <AnimatePresence mode="popLayout">
                      {filtered.map((p, idx) => {
                        const engName =
                          (p.engineerAssigned && engMap[String(p.engineerAssigned)]) || "Unassigned";
                        const st = normStatus(p.status);
                        const deadlineISO = pickDeadlineISO(p);

                        // 🔒 STOP COUNTING when Complete
                        const dleftRaw = daysLeftFromISO(deadlineISO);
                        const dleft = st === "Complete" ? null : dleftRaw;
                        const isOverdue = dleft !== null && dleft < 0;
                        const dlSoon = dleft !== null && dleft <= 5 && dleft >= 0;

                        return (
                          <motion.tr
                            key={p._id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: idx * 0.03 }}
                            className="border-b border-slate-100 hover:bg-slate-50 transition-all"
                          >
                            <Td>
                              <div className="font-medium text-slate-900">{p.projectTitle || "Untitled"}</div>
                              <div className="text-sm text-slate-500 truncate max-w-xs">{p.projectDescription || "—"}</div>
                            </Td>
                            <Td>
                              <div className="text-slate-900">{`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—"}</div>
                              <div className="text-sm text-slate-500">{p.email || "—"}</div>
                            </Td>
                            <Td>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-slate-400" />
                                <span className={p.engineerAssigned ? "text-slate-900" : "text-slate-400 italic"}>{engName}</span>
                              </div>
                            </Td>
                            <Td>
                              <StatusBadge status={st} />
                            </Td>
                            <Td>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span
                                  className={`${
                                    st === "Complete"
                                      ? "text-slate-900"
                                      : isOverdue
                                      ? "text-red-600 font-medium"
                                      : dlSoon
                                      ? "text-orange-600 font-medium"
                                      : "text-slate-900"
                                  }`}
                                >
                                  {fmtISODate(deadlineISO)}
                                </span>
                              </div>
                              {/* Only show countdown if NOT complete */}
                              {typeof dleft === "number" && (
                                <div
                                  className={`text-xs ${
                                    isOverdue
                                      ? "text-red-600 font-medium"
                                      : dlSoon
                                      ? "text-orange-600"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {isOverdue ? `${Math.abs(dleft)}d overdue` : `${dleft}d left`}
                                </div>
                              )}
                            </Td>
                            <Td>
                              <div className="flex items-center gap-2 text-slate-600">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {fmtISODate(parseISODateOnly(p.updatedAt || p.createdAt))}
                              </div>
                            </Td>
                            <Td align="right">
                              <Link
                                to="/chat"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 transition-all text-sm rounded-lg group shadow-sm"
                              >
                                Open
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </Link>
                            </Td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-slate-400">
                        No projects match your filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden p-4 space-y-4 max-h-[65vh] overflow-y-auto">
            {loading ? (
              <CardSkeleton count={5} />
            ) : filtered.length ? (
              <AnimatePresence mode="popLayout">
                {filtered.map((p, idx) => {
                  const engName =
                    (p.engineerAssigned && engMap[String(p.engineerAssigned)]) || "Unassigned";
                  const status = normStatus(p.status);
                  const deadlineISO = pickDeadlineISO(p);

                  // 🔒 STOP COUNTING when Complete
                  const dleftRaw = daysLeftFromISO(deadlineISO);
                  const dleft = status === "Complete" ? null : dleftRaw;
                  const isOverdue = dleft !== null && dleft < 0;
                  const dlSoon = dleft !== null && dleft <= 5 && dleft >= 0;

                  return (
                    <motion.div
                      key={p._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: idx * 0.05 }}
                      className="rounded-xl bg-slate-50 border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900 mb-1">{p.projectTitle || "Untitled"}</div>
                          <div className="text-sm text-slate-500 line-clamp-2">{p.projectDescription || "—"}</div>
                        </div>
                        <StatusBadge status={status} />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                        <Info label="Client" value={`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—"} />
                        <Info label="Engineer" value={engName} />
                        <Info
                          label="Deadline"
                          value={
                            <span
                              className={`${
                                status === "Complete"
                                  ? ""
                                  : isOverdue
                                  ? "text-red-600 font-medium"
                                  : dlSoon
                                  ? "text-orange-600 font-medium"
                                  : ""
                              }`}
                            >
                              {fmtISODate(deadlineISO)}
                              {/* Only append countdown when NOT complete */}
                              {typeof dleft === "number" &&
                                ` · ${isOverdue ? `${Math.abs(dleft)}d over` : `${dleft}d left`}`}
                            </span>
                          }
                        />
                        <Info label="Updated" value={fmtISODate(parseISODateOnly(p.updatedAt || p.createdAt))} />
                      </div>

                      <Link
                        to="/chat"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 transition-all rounded-lg group"
                      >
                        Open Project
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                No projects match your filters
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <CreateTaskModal open={showCreateTask} onClose={() => setShowCreateTask(false)} onCreated={load} />
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
    </motion.div>
  );
}

function Tab({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-6 py-3 rounded-lg text-sm transition-all whitespace-nowrap ${
        active
          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm"
          : "bg-[#1a2332] border border-slate-700/50 text-slate-300 hover:text-white hover:bg-[#1f2937]"
      }`}
    >
      {label}
      {count !== undefined && <span className={`ml-2 text-xs ${active ? "opacity-80" : "opacity-60"}`}>({count})</span>}
    </button>
  );
}

function StatusBadge({ status }) {
  if (status === "Complete")
    return <span className="inline-flex items-center px-3 py-1.5 text-xs rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium">Complete</span>;
  if (status === "In-Progress")
    return <span className="inline-flex items-center px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 border border-blue-300 font-medium">In Progress</span>;
  if (status === "Review")
    return <span className="inline-flex items-center px-3 py-1.5 text-xs rounded-lg bg-teal-100 text-teal-700 border border-teal-300 font-medium">Review</span>;
  return <span className="inline-flex items-center px-3 py-1.5 text-xs rounded-lg bg-amber-100 text-amber-700 border border-amber-300 font-medium">Pending</span>;
}

function Th({ children }) {
  return <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.15em] text-white">{children}</th>;
}

function Td({ children, align = "left" }) {
  return <td className={`px-5 py-4 align-middle ${align === "right" ? "text-right" : ""}`}>{children}</td>;
}

function SkeletonRows({ rows = 6, cols = 6 }) {
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

function CardSkeleton({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div className="h-6 bg-slate-200 rounded mb-4 animate-pulse" />
          <div className="h-4 bg-slate-200 rounded mb-6 animate-pulse" />
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="h-4 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-10 bg-slate-200 rounded animate-pulse" />
        </div>
      ))}
    </>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-slate-900">{value}</div>
    </div>
  );
}
