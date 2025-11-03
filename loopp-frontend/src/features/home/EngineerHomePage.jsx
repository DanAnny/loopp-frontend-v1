// src/pages/EngineerHome.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle, Clock, AlertCircle, Calendar,
  Filter, Search, Loader2, RefreshCw, Sparkles, ArrowRight,
  Activity, Zap, ListChecks
} from "lucide-react";
import tasksApi from "@/services/tasks.service";

/* -------------------- helpers -------------------- */
const normalize = (s = "") => {
  const t = String(s);
  if (/^in[\s_-]*progress$/i.test(t)) return "In Progress";
  if (/^complete(d)?$/i.test(t)) return "Completed";
  if (/assign|pending/i.test(t)) return "Assigned";
  return t;
};

function mapTask(t) {
  return {
    _id: t?._id || t?.id,
    title: t?.title || t?.name || "Untitled Task",
    dueDate: t?.dueDate || t?.deadline || t?.completionDeadline || null,
    status: normalize(t?.status || t?.state || "Assigned"),
  };
}

const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : "0");

/* -------------------- page -------------------- */
export default function EngineerHome() {
  const user = useSelector((s) => s.auth.user);
  const engineerId = user?._id || user?.id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [err, setErr] = useState("");

  const [summary, setSummary] = useState({
    Assigned: 0, "In Progress": 0, Completed: 0, total: 0
  });

  const [tasks, setTasks] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadSummary = async () => {
    try {
      const res = await tasksApi.getSummary(engineerId);
      const s = res?.data?.summary || {};
      setSummary({ Assigned: 0, "In Progress": 0, Completed: 0, total: 0, ...s });
    } catch {
      // keep cards at zero if summary fails
    }
  };

  const loadTasks = async () => {
    try {
      setListLoading(true);
      setErr("");
      const res = await tasksApi.getByEngineer(engineerId);
      const list = Array.isArray(res?.data?.tasks)
        ? res.data.tasks
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setTasks(list.map(mapTask));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setListLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadSummary(), loadTasks()]);
    setLoading(false);
  };

  useEffect(() => {
    if (engineerId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineerId]);

  const accept = async (taskId) => {
    setProcessingId(taskId);
    try {
      const res = await tasksApi.accept({ taskId });
      const roomKey = res?.data?.roomKey || null;
      await loadAll();
      if (roomKey) {
        localStorage.setItem("openRoomKey", roomKey);
        navigate("/chat");
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to accept task");
    } finally {
      setProcessingId(null);
    }
  };

  const complete = async (taskId) => {
    setProcessingId(taskId);
    try {
      await tasksApi.complete({ taskId });
      await loadAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to complete task");
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tasks.filter((t) => {
      const matchesQ = t.title.toLowerCase().includes(q);
      const matchesS = statusFilter === "all" ? true : t.status === statusFilter;
      return matchesQ && matchesS;
    });
  }, [tasks, searchQuery, statusFilter]);

  const lanes = useMemo(
    () => ({
      Assigned: filtered.filter((t) => t.status === "Assigned"),
      "In Progress": filtered.filter((t) => t.status === "In Progress"),
      Completed: filtered.filter((t) => t.status === "Completed"),
    }),
    [filtered]
  );

  const upcoming = useMemo(() => {
    return [...tasks]
      .filter((t) => !!t.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);
  }, [tasks]);

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl text-white">Engineer Dashboard</h1>
            </div>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Welcome back, {user?.firstName || "Engineer"}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={loadAll}
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
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {err}
          </motion.div>
        )}

        {/* Top Stats - 4 cards (percentages removed) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Total Assigned"
            value={fmt(summary.total)}
            subtitle="All time"
            icon={<ListChecks className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-purple-500 to-purple-600"
            delay={0.1}
            loading={loading}
          />
          <StatCard
            label="Assigned"
            value={fmt(summary.Assigned)}
            subtitle="Pending tasks"
            icon={<Sparkles className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-orange-500 to-orange-600"
            delay={0.15}
            loading={loading}
          />
          <StatCard
            label="In Progress"
            value={fmt(summary["In Progress"])}
            subtitle="Active work"
            icon={<Activity className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-teal-500 to-teal-600"
            delay={0.2}
            loading={loading}
          />
          <StatCard
            label="Completed"
            value={fmt(summary.Completed)}
            subtitle="Finished"
            icon={<CheckCircle className="w-5 h-5" />}
            iconBg="bg-gradient-to-br from-pink-500 to-pink-600"
            delay={0.25}
            loading={loading}
          />
        </div>

        {/* Kanban Lanes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <Lane title="Assigned" count={lanes.Assigned.length}>
            {lanes.Assigned.map((t) => (
              <TaskCard
                key={t._id}
                task={t}
                processing={processingId === t._id}
                actions={
                  <button
                    onClick={() => accept(t._id)}
                    disabled={processingId === t._id}
                    className="w-full text-xs px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 transition-all rounded-lg shadow-sm hover:shadow-md"
                  >
                    {processingId === t._id ? <Loader2 className="w-3 h-3 mx-auto animate-spin" /> : "Accept Task"}
                  </button>
                }
              />
            ))}
          </Lane>

          <Lane title="In Progress" count={lanes["In Progress"].length}>
            {lanes["In Progress"].map((t) => (
              <TaskCard
                key={t._id}
                task={t}
                processing={processingId === t._id}
                actions={
                  <button
                    onClick={() => complete(t._id)}
                    disabled={processingId === t._id}
                    className="w-full text-xs px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-600 text-white hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 transition-all rounded-lg shadow-sm hover:shadow-md"
                  >
                    {processingId === t._id ? <Loader2 className="w-3 h-3 mx-auto animate-spin" /> : "Mark Complete"}
                  </button>
                }
              />
            ))}
          </Lane>

          <Lane title="Completed" count={lanes.Completed.length}>
            {lanes.Completed.map((t) => (
              <TaskCard key={t._id} task={t} />
            ))}
          </Lane>
        </motion.div>

        {/* Upcoming Deadlines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl bg-[#1a2332] border border-slate-700/50 shadow-lg mb-8 overflow-hidden"
        >
          <div className="px-6 py-4 bg-[#1a2332] border-b border-slate-700/50">
            <h3 className="text-sm uppercase tracking-[0.15em] flex items-center gap-2 text-white">
              <Calendar className="w-4 h-4" />
              Upcoming Deadlines
            </h3>
          </div>
          <div className="p-6 bg-[#1a2332]">
            {upcoming.length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-8 border-2 border-dashed border-slate-700/50 rounded-xl">
                No upcoming deadlines
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((t, idx) => (
                  <motion.div
                    key={t._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ x: 4, scale: 1.01 }}
                    className="bg-[#1f2937] px-5 py-4 flex items-center justify-between hover:bg-[#252f3f] transition-all rounded-xl border border-slate-700/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white line-clamp-1 mb-2">{t.title}</p>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="text-sm text-slate-300 ml-4 font-medium">
                      {new Date(t.dueDate).toLocaleDateString()}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* All Tasks Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl bg-[#1a2332] border border-slate-700/50 shadow-lg overflow-hidden"
        >
          <div className="px-6 py-5 bg-[#1a2332] border-b border-slate-700/50">
            <h3 className="text-sm uppercase tracking-[0.15em] mb-5 text-white">All Tasks</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-300 transition-colors z-10" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full pl-11 pr-4 py-2.5 bg-[#1f2937] border border-slate-700/50 rounded-lg focus:outline-none focus:bg-[#252f3f] focus:border-slate-600 transition-all text-white placeholder:text-slate-400"
                />
              </div>
              <div className="relative sm:w-48">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-11 pr-8 py-2.5 bg-[#1f2937] border border-slate-700/50 rounded-lg focus:outline-none focus:bg-[#252f3f] focus:border-slate-600 transition-all appearance-none cursor-pointer text-white"
                >
                  <option value="all">All Status</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {listLoading ? (
            <TableSkeleton rows={8} />
          ) : (
            <div className="overflow-x-auto bg-[#1a2332]">
              <table className="w-full">
                <thead className="bg-[#1f2937] border-b border-slate-700/50">
                  <tr className="text-left">
                    <th className="px-6 py-4 text-xs uppercase tracking-[0.15em] text-slate-400">Title</th>
                    <th className="px-6 py-4 text-xs uppercase tracking-[0.15em] text-slate-400">Deadline</th>
                    <th className="px-6 py-4 text-xs uppercase tracking-[0.15em] text-slate-400">Status</th>
                    <th className="px-6 py-4 text-xs uppercase tracking-[0.15em] text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((t, i) => (
                      <motion.tr
                        key={t._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-slate-700/50 hover:bg-[#1f2937] transition-all"
                      >
                        <td className="px-6 py-4">
                          <span className="text-white">{t.title}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-2 text-slate-300">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-6 py-4">
                          {t.status === "Assigned" && (
                            <button
                              onClick={() => accept(t._id)}
                              disabled={processingId === t._id}
                              className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-sm rounded-lg shadow-sm hover:shadow-md transition-all"
                            >
                              {processingId === t._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  Accept
                                  <ArrowRight className="w-3 h-3" />
                                </>
                              )}
                            </button>
                          )}
                          {t.status === "In Progress" && (
                            <button
                              onClick={() => complete(t._id)}
                              disabled={processingId === t._id}
                              className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-600 text-white hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-sm rounded-lg shadow-sm hover:shadow-md transition-all"
                            >
                              {processingId === t._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  Complete
                                  <CheckCircle className="w-3 h-3" />
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-slate-400">
                        {searchQuery || statusFilter !== "all" ? "No tasks match your filters" : "No tasks found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/* -------------------- UI Components -------------------- */
function StatCard({ label, value, subtitle, icon, iconBg, delay, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="rounded-xl bg-[#1a2332] border border-slate-700/50 p-6 hover:shadow-xl transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconBg} text-white shadow-lg`}>{icon}</div>
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-slate-700/30 rounded animate-pulse mb-2" />
      ) : (
        <div className="text-3xl text-white mb-2">{value}</div>
      )}
      <div className="text-xs uppercase tracking-[0.15em] text-slate-400 mb-1">{label}</div>
      {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
    </motion.div>
  );
}

function Lane({ title, count, children }) {
  return (
    <div className="rounded-xl bg-[#1a2332] border border-slate-700/50 shadow-lg overflow-hidden">
      <div className="px-5 py-4 bg-[#1a2332] border-b border-slate-700/50 flex items-center justify-between">
        <span className="text-sm uppercase tracking-[0.15em] text-white">{title}</span>
        <span className="text-xs bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full">{count}</span>
      </div>
      <div className="p-5 space-y-3 min-h-[200px] bg-[#1a2332]">
        {count === 0 ? (
          <div className="text-slate-400 text-sm text-center py-8 border-2 border-dashed border-slate-700/50 rounded-xl">
            No tasks
          </div>
        ) : (
          <AnimatePresence mode="popLayout">{children}</AnimatePresence>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, processing, actions }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl bg-[#1f2937] border border-slate-700/50 p-4 hover:bg-[#252f3f] hover:shadow-md transition-all"
    >
      <div className="mb-3">
        <p className="text-sm text-white mb-2 line-clamp-2">{task.title}</p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <StatusBadge status={task.status} />
          {task.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      {actions && <div>{actions}</div>}
    </motion.div>
  );
}

function StatusBadge({ status }) {
  if (status === "Completed")
    return (
      <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
        Completed
      </span>
    );
  if (status === "In Progress")
    return (
      <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
        In Progress
      </span>
    );
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
      Assigned
    </span>
  );
}

function TableSkeleton({ rows = 6 }) {
  return (
    <div className="p-6 space-y-3 bg-[#1a2332]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 flex-1 bg-slate-700/30 rounded animate-pulse" />
          <div className="h-4 w-28 bg-slate-700/30 rounded animate-pulse" />
          <div className="h-4 w-32 bg-slate-700/30 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
