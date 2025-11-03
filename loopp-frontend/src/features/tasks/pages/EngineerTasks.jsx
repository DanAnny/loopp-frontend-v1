// src/pages/EngineerTasks.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle, XCircle, Search, Filter, Loader2, X, Sparkles,
  Calendar, AlertCircle, ListChecks, Activity, RefreshCw
} from "lucide-react";
import tasksApi from "@/services/tasks.service";

/* ---------- simple skeleton ---------- */
const TableSkeleton = ({ rows = 8 }) => (
  <div className="space-y-3 p-6 bg-[#1a2332]">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        <div className="h-4 flex-1 bg-slate-700/30 rounded animate-pulse" />
        <div className="h-4 w-28 bg-slate-700/30 rounded animate-pulse" />
        <div className="h-4 w-32 bg-slate-700/30 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

const normalize = (s = "") => {
  const t = String(s);
  if (/^in[\s_-]*progress$/i.test(t)) return "In Progress";
  if (/^complete(d)?$/i.test(t))      return "Completed";
  if (/assign|pending/i.test(t))      return "Assigned";
  return t;
};

function mapTask(t) {
  return {
    _id: t?._id || t?.id,
    title: t?.title || t?.name || "Untitled Task",
    status: normalize(t?.status || t?.state || "Assigned"),
    dueDate: t?.dueDate || t?.deadline || null,
  };
}

function StatusBadge({ status }) {
  if (status === "Completed")
    return <span className="inline-flex items-center px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">Completed</span>;
  if (status === "In Progress")
    return <span className="inline-flex items-center px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">In Progress</span>;
  if (status === "Assigned")
    return <span className="inline-flex items-center px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">Assigned</span>;
  return <span className="inline-flex items-center px-3 py-1.5 text-xs rounded-lg bg-slate-700/30 text-slate-300 border border-slate-600/30 font-medium">{status || "—"}</span>;
}

const RejectTaskModal = ({ task, onClose, onSubmit, reason, setReason, isProcessing }) => (
  <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/60 z-50"
    />
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", bounce: 0.3 }}
        className="relative w-full max-w-lg bg-[#1a2332] rounded-2xl border border-slate-700/50 shadow-lg p-8 pointer-events-auto"
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-white mb-2">Decline Task</h3>
            <p className="text-sm text-slate-400">Please provide a reason for declining</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-700/30 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </motion.button>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-[#1f2937] border border-slate-700/50">
          <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Task</p>
          <p className="text-white">{task.title}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-slate-300 mb-3">Reason for declining</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="E.g., Insufficient time, lacks required expertise, etc."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-slate-700/50 bg-[#1f2937] text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-600 transition-colors resize-none text-sm"
          />
        </div>

        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-6 py-3 rounded-xl border border-slate-700/50 text-white hover:bg-slate-700/30 transition-colors disabled:opacity-50"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSubmit}
            disabled={isProcessing || !reason.trim()}
            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-600 text-white hover:from-red-500 hover:to-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Decline Task"
            )}
          </motion.button>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">
              Declining will notify your manager for reassignment.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  </>
);

export default function EngineerTasks() {
  const user = useSelector((s) => s.auth.user);
  const engineerId = user?._id || user?.id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks]     = useState([]);
  const [err, setErr]         = useState("");

  const [rejectFor, setRejectFor]       = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const [searchQuery, setSearchQuery]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const res  = await tasksApi.getByEngineer(engineerId);
      const list = Array.isArray(res?.data?.tasks) ? res.data.tasks : Array.isArray(res?.data) ? res.data : [];
      setTasks(list.map(mapTask));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (engineerId) load();
  }, [engineerId]);

  const accept = async (taskId) => {
    setProcessingId(taskId);
    try {
      const res = await tasksApi.accept({ taskId });
      const roomKey = res?.data?.roomKey || null;
      await load();
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

  const markCompleted = async (taskId) => {
    setProcessingId(taskId);
    try {
      await tasksApi.complete({ taskId });
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to complete task");
    } finally {
      setProcessingId(null);
    }
  };

  // keep logic as requested
  const decline = async () => {
    setProcessingId(rejectFor._id);
    try {
      // Placeholder - backend endpoint not implemented
      await new Promise(resolve => setTimeout(resolve, 1000));
      setErr("Decline endpoint not implemented on backend");
      setRejectFor(null);
      setRejectReason("");
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to decline task");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(q);
      const matchesFilter = statusFilter === "all" ? true : task.status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [tasks, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      assigned: tasks.filter(t => t.status === "Assigned").length,
      inProgress: tasks.filter(t => t.status === "In Progress").length,
      completed: tasks.filter(t => t.status === "Completed").length,
    };
  }, [tasks]);

  const fmt = (n) => {
    if (typeof n !== "number") return "0";
    return n.toLocaleString();
  };

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                <ListChecks className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl text-white">Task Management</h1>
            </div>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Manage assignments and track your progress
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={load}
              disabled={loading}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-2.5 rounded-lg text-sm hover:from-teal-500 hover:to-cyan-500 transition-all disabled:opacity-50 inline-flex items-center gap-2 font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </motion.button>
          </div>
        </motion.div>

        {/* Error banner */}
        {!loading && err && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {err}
          </motion.div>
        )}

        {/* Stats Cards (no percentages) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8"
        >
          <StatCard
            icon={<ListChecks className="w-5 h-5" />}
            label="Total Tasks"
            value={fmt(stats.total)}
            iconBg="bg-gradient-to-br from-purple-500 to-purple-600"
            delay={0.1}
            loading={loading}
          />
          <StatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Assigned"
            value={fmt(stats.assigned)}
            iconBg="bg-gradient-to-br from-orange-500 to-orange-600"
            delay={0.15}
            loading={loading}
          />
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label="In Progress"
            value={fmt(stats.inProgress)}
            iconBg="bg-gradient-to-br from-teal-500 to-teal-600"
            delay={0.2}
            loading={loading}
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Completed"
            value={fmt(stats.completed)}
            iconBg="bg-gradient-to-br from-pink-500 to-pink-600"
            delay={0.25}
            loading={loading}
          />
        </motion.div>

        {/* Main Table Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-slate-700/50 bg-[#1a2332] shadow-lg overflow-hidden"
        >
          {/* Search + Filter Bar */}
          <div className="px-6 py-5 border-b border-slate-700/50 bg-[#1a2332]">
            <h3 className="text-sm uppercase tracking-[0.15em] mb-5 text-white">All Tasks</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-300 transition-colors z-10" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-[#1f2937] border border-slate-700/50 text-white placeholder:text-slate-400 focus:outline-none focus:bg-[#252f3f] focus:border-slate-600 transition-all text-sm"
                />
              </div>
              <div className="relative sm:w-48">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-11 pr-8 py-2.5 rounded-lg bg-[#1f2937] border border-slate-700/50 text-white focus:outline-none focus:bg-[#252f3f] focus:border-slate-600 transition-all appearance-none cursor-pointer text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Content */}
          {loading ? (
            <TableSkeleton rows={8} />
          ) : (
            <div className="overflow-x-auto bg-[#1a2332]">
              <table className="min-w-full">
                <thead className="bg-[#1f2937] border-b border-slate-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-slate-400 uppercase tracking-wider text-xs">Task</th>
                    <th className="px-6 py-4 text-left text-slate-400 uppercase tracking-wider text-xs">Due Date</th>
                    <th className="px-6 py-4 text-left text-slate-400 uppercase tracking-wider text-xs">Status</th>
                    <th className="px-6 py-4 text-left text-slate-400 uppercase tracking-wider text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filteredTasks.map((t, index) => (
                      <motion.tr
                        key={t._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.03 }}
                        className="group border-b border-slate-700/50 hover:bg-[#1f2937] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="text-white group-hover:translate-x-1 inline-block transition-transform">
                            {t.title}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-300">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span className="text-sm">
                              {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <StatusBadge status={t.status} />
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {t.status === "Assigned" && (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => accept(t._id)}
                                  disabled={processingId === t._id}
                                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-sm text-white hover:from-blue-500 hover:to-cyan-500 transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  {processingId === t._id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                  Accept
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => setRejectFor(t)}
                                  disabled={processingId === t._id}
                                  className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-[#1f2937] px-4 py-2 text-sm text-white hover:bg-[#252f3f] hover:border-slate-600 transition-colors disabled:opacity-50"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Decline
                                </motion.button>
                              </>
                            )}

                            {t.status === "In Progress" && (
                              <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => markCompleted(t._id)}
                                disabled={processingId === t._id}
                                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-600 px-4 py-2 text-sm text-white hover:from-emerald-500 hover:to-emerald-500 transition-colors disabled:opacity-50 shadow-sm"
                              >
                                {processingId === t._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                                Mark Completed
                              </motion.button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>

                  {filteredTasks.length === 0 && (
                    <tr>
                      <td className="px-6 py-16 text-center text-slate-400" colSpan={4}>
                        {searchQuery || statusFilter !== "all"
                          ? "No tasks match your filters"
                          : "No tasks assigned"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Reject Task Modal */}
      <AnimatePresence>
        {rejectFor && (
          <RejectTaskModal
            task={rejectFor}
            onClose={() => { setRejectFor(null); setRejectReason(""); }}
            onSubmit={() => decline()}
            reason={rejectReason}
            setReason={setRejectReason}
            isProcessing={processingId === rejectFor._id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------- UI Components -------------------- */
function StatCard({ icon, label, value, iconBg, delay = 0, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="rounded-xl bg-[#1a2332] border border-slate-700/50 p-6 hover:shadow-xl transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconBg} text-white shadow-lg`}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-slate-700/30 rounded animate-pulse mb-2" />
      ) : (
        <div className="text-3xl text-white mb-2">{value}</div>
      )}
      <div className="text-xs uppercase tracking-[0.15em] text-slate-400">{label}</div>
    </motion.div>
  );
}
