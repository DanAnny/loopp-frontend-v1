import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle, XCircle, Search, Filter, Loader2, X
} from "lucide-react";
import tasksApi from "@/services/tasks.service";

/* ---------- simple skeleton ---------- */
const TableSkeleton = ({ rows = 8 }) => (
  <div className="space-y-3 p-6">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        <div className="h-4 flex-1 bg-black/5 rounded animate-pulse" />
        <div className="h-4 w-28 bg-black/5 rounded animate-pulse" />
        <div className="h-4 w-32 bg-black/5 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

const normalize = (s="") => {
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
  };
}

function StatusBadge({ status }) {
  const base = "inline-flex items-center px-3 py-1 rounded-full border text-xs";
  if (status === "Completed")    return <span className={`${base} bg-black/5 text-black border-black/20`}>Completed</span>;
  if (status === "In Progress")  return <span className={`${base} bg-black/10 text-black border-black/30`}>In&nbsp;Progress</span>;
  if (status === "Assigned")     return <span className={`${base} bg-white text-black border-black/40`}>Assigned</span>;
  return <span className={`${base} bg-black/5 text-black/60 border-black/20`}>{status || "—"}</span>;
}

const RejectTaskModal = ({ task, onClose, onSubmit, reason, setReason, isProcessing }) => (
  <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
    />
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-3xl border border-black/20 shadow-2xl p-8 pointer-events-auto"
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-black mb-2">Decline Task</h3>
            <p className="text-black/60">Please provide a reason for declining</p>
          </div>
          <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5 text-black/60" />
          </motion.button>
        </div>

        <div className="mb-6 p-4 rounded-2xl bg-black/[0.02] border border-black/10">
          <p className="text-black/60 mb-1">Task</p>
          <p className="text-black">{task.title}</p>
        </div>

        <div className="mb-6">
          <label className="block text-black mb-3">Reason for declining</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="E.g., Insufficient time, lacks required expertise, etc."
            rows={4}
            className="w-full px-4 py-3 rounded-2xl border border-black/20 bg-white focus:outline-none focus:border-black transition-colors resize-none"
          />
        </div>

        <div className="flex gap-3">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClose} disabled={isProcessing}
            className="flex-1 px-6 py-3 rounded-2xl border border-black/20 text-black hover:bg-black/[0.02] transition-colors disabled:opacity-50"
          >
            Cancel
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onSubmit} disabled={isProcessing || !reason.trim()}
            className="flex-1 px-6 py-3 rounded-2xl bg-black text-white hover:bg-black/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (<><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>) : ("Decline Task")}
          </motion.button>
        </div>

        <div className="mt-6 p-4 rounded-2xl bg-black/[0.02] border border-black/10">
          <p className="text-black/60">
            Note: Declining will notify your manager for reassignment.
          </p>
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

  // Placeholder decline handler
  const decline = async () => {
    setErr("Decline endpoint not implemented on backend");
    setRejectFor(null);
    setRejectReason("");
  };

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(q);
      const matchesFilter = statusFilter === "all" ? true : task.status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [tasks, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(0,0,0,0.08),transparent),linear-gradient(180deg,rgba(0,0,0,0.02),transparent_150px)]" />
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl sm:text-3xl text-black mb-2">All Tasks</h1>
          <p className="text-black/60">Focused table for fast triage and updates.</p>
        </motion.div>

        {/* Error banner */}
        {!loading && err && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
            {err}
          </div>
        )}

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-3xl border border-black/10 bg-white/70 backdrop-blur-xl p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
        >
          {/* Search + Filter */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-black/70 text-sm">Filter</span>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-11 pr-4 py-2.5 rounded-2xl border border-black/20 bg-white focus:outline-none focus:border-black transition-colors"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-11 pr-8 py-2.5 rounded-2xl border border-black/20 bg-white focus:outline-none focus:border-black transition-colors appearance-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <TableSkeleton rows={8} />
          ) : (
            <div className="overflow-x-auto -mx-8 px-8">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="px-4 py-4 text-left text-black/60 uppercase tracking-wider text-xs">Title</th>
                    <th className="px-4 py-4 text-left text-black/60 uppercase tracking-wider text-xs">Status</th>
                    <th className="px-4 py-4 text-left text-black/60 uppercase tracking-wider text-xs">Actions</th>
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
                        className="group border-b border-black/5 hover:bg-black/[0.02] transition-colors"
                      >
                        <td className="px-4 py-4">
                          <span className="text-black group-hover:translate-x-1 inline-block transition-transform">
                            {t.title}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge status={t.status} />
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {(t.status === "Assigned") && (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                  onClick={() => accept(t._id)}
                                  disabled={processingId === t._id}
                                  className="flex items-center gap-2 rounded-xl border border-black bg-black px-4 py-2 text-white hover:bg-black/90 transition-colors disabled:opacity-50"
                                >
                                  {processingId === t._id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                  Accept
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                  onClick={() => setRejectFor(t)}
                                  disabled={processingId === t._id}
                                  className="flex items-center gap-2 rounded-xl border border-black/30 bg-white px-4 py-2 text-black hover:border-black hover:bg-black/[0.02] transition-colors disabled:opacity-50"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Decline
                                </motion.button>
                              </>
                            )}

                            {t.status === "In Progress" && (
                              <motion.button
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={() => markCompleted(t._id)}
                                disabled={processingId === t._id}
                                className="flex items-center gap-2 rounded-xl border border-black bg-black px-4 py-2 text-white hover:bg-black/90 transition-colors disabled:opacity-50"
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
                      <td className="px-4 py-16 text-center text-black/40" colSpan={3}>
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
