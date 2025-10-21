import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  User, CheckCircle, XCircle, Clock, AlertCircle, Calendar,
  Filter, Search, Loader2, Plus, RefreshCw
} from "lucide-react";
import tasksApi from "@/services/tasks.service";

/* -------------------- local UI bits -------------------- */
const Section = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-3xl border border-black/10 bg-white/60 backdrop-blur-xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
  >
    {children}
  </motion.div>
);

const Card = ({ icon, label, value, sub }) => (
  <motion.div
    whileHover={{ y: -4 }}
    className="group rounded-2xl border border-black/10 bg-white/70 backdrop-blur-xl p-6 hover:border-black/20 hover:shadow-lg transition-all"
  >
    <div className="flex items-center justify-between">
      <div className="p-3 rounded-xl bg-black/5 text-black group-hover:bg-black group-hover:text-white group-hover:scale-110 transition-all">
        {icon}
      </div>
      {sub ? <span className="text-xs text-black/50">{sub}</span> : null}
    </div>
    <p className="text-black/60 uppercase tracking-wider mt-4">{label}</p>
    <p className="text-3xl text-black mt-1">{value}</p>
  </motion.div>
);

const StatusBadge = ({ status }) => {
  const base = "inline-flex items-center px-3 py-1 rounded-full border text-xs";
  if (status === "Completed")   return <span className={`${base} bg-black/5 text-black border-black/20`}>Completed</span>;
  if (status === "In Progress") return <span className={`${base} bg-black/10 text-black border-black/30`}>In&nbsp;Progress</span>;
  if (status === "Assigned")    return <span className={`${base} bg-white text-black border-black/40`}>Assigned</span>;
  return <span className={`${base} bg-black/5 text-black/60 border-black/20`}>{status || "—"}</span>;
};

const TableSkeleton = ({ rows = 6 }) => (
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

/* -------------------- helpers -------------------- */
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
    dueDate: t?.dueDate || t?.deadline || t?.completionDeadline || null,
    status: normalize(t?.status || t?.state || "Assigned"),
  };
}

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
      const list = Array.isArray(res?.data?.tasks) ? res.data.tasks : Array.isArray(res?.data) ? res.data : [];
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
    return tasks.filter(t => {
      const matchesQ = t.title.toLowerCase().includes(q);
      const matchesS = statusFilter === "all" ? true : t.status === statusFilter;
      return matchesQ && matchesS;
    });
  }, [tasks, searchQuery, statusFilter]);

  const lanes = useMemo(() => ({
    Assigned: filtered.filter(t => t.status === "Assigned"),
    "In Progress": filtered.filter(t => t.status === "In Progress"),
    Completed: filtered.filter(t => t.status === "Completed"),
  }), [filtered]);

  const upcoming = useMemo(() => {
    return [...tasks]
      .filter(t => !!t.dueDate)
      .sort((a,b)=> new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);
  }, [tasks]);

  return (
    <div className="min-h-screen relative">
      {/* Soft gradient header */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_80%_-10%,rgba(0,0,0,0.08),transparent),linear-gradient(180deg,rgba(0,0,0,0.02),transparent_150px)]" />
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Hero / top strip */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-3xl border border-black/10 bg-white/70 backdrop-blur-xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-black/5 flex items-center justify-center">
                <User className="w-7 h-7 text-black/70" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl text-black font-medium">
                  Hey {user?.firstName || "Engineer"}, let’s ship.
                </h1>
                <p className="text-black/60 text-sm mt-1">
                  Prioritized view of your workload — quick actions, upcoming deadlines, and a clean table.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={loadAll}
                className="inline-flex items-center gap-2 rounded-xl border border-black/20 px-4 py-2 bg-white hover:bg-black/[0.03] transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              {/* <button
                onClick={()=>navigate("/chat")}
                className="inline-flex items-center gap-2 rounded-xl bg-black text-white px-4 py-2 hover:bg-black/90"
              >
                <Plus className="w-4 h-4" /> Open Team Chat
              </button> */}
            </div>
          </div>
        </motion.div>

        {/* Errors */}
        {!loading && err && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
            {err}
          </div>
        )}

        {/* Summary cards: Lifetime assigned + WIP + Done */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <Card icon={<Clock className="w-5 h-5" />}      label="Total Assigned" value={summary.total || 0} sub="All-time" />
          <Card icon={<AlertCircle className="w-5 h-5" />} label="In Progress"   value={summary["In Progress"] || 0} />
          <Card icon={<CheckCircle className="w-5 h-5" />} label="Completed"     value={summary.Completed || 0} />
        </div>

        {/* Kanban lanes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {["Assigned","In Progress","Completed"].map((col) => (
            <Section key={col}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-black/70 text-sm">{col}</span>
                <span className="text-xs text-black/40">{lanes[col].length}</span>
              </div>
              <div className="space-y-3">
                {lanes[col].length === 0 && (
                  <div className="text-black/40 text-sm px-2 py-6 text-center border border-dashed border-black/10 rounded-xl">
                    Nothing here.
                  </div>
                )}
                {lanes[col].map((t) => (
                  <motion.div
                    key={t._id}
                    layout
                    className="rounded-xl border border-black/10 bg-white/80 backdrop-blur-sm p-4 hover:border-black/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-black line-clamp-2">{t.title}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-black/60">
                          <StatusBadge status={t.status} />
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 flex gap-2">
                        {col === "Assigned" && (
                          <>
                            <button
                              onClick={()=>accept(t._id)}
                              disabled={processingId===t._id}
                              className="text-xs rounded-lg bg-black text-white px-3 py-1.5 hover:bg-black/90 disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {processingId===t._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              Accept
                            </button>
                            <button
                              onClick={()=>alert("Decline not implemented")}
                              className="text-xs rounded-lg border border-black/30 px-3 py-1.5 hover:border-black/60"
                            >
                              <XCircle className="w-3.5 h-3.5 inline mr-1" />
                              Decline
                            </button>
                          </>
                        )}
                        {col === "In Progress" && (
                          <button
                            onClick={()=>complete(t._id)}
                            disabled={processingId===t._id}
                            className="text-xs rounded-lg bg-black text-white px-3 py-1.5 hover:bg-black/90 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {processingId===t._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Section>
          ))}
        </div>

        {/* Upcoming deadlines */}
        <Section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-black font-medium">Upcoming Deadlines</h3>
            <div className="text-sm text-black/50">{upcoming.length} next</div>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-black/40">No upcoming deadlines.</div>
          ) : (
            <ul className="divide-y divide-black/10">
              {upcoming.map((t)=>(
                <li key={t._id} className="py-3 flex items-center justify-between">
                  <div className="min-w-0 pr-3">
                    <p className="text-sm text-black line-clamp-1">{t.title}</p>
                    <div className="text-xs text-black/60 mt-1">
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                  <div className="text-sm text-black/70">{new Date(t.dueDate).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Table + filters */}
        <Section>
          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h3 className="text-black font-medium">All Tasks</h3>
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                <input
                  value={searchQuery}
                  onChange={(e)=>setSearchQuery(e.target.value)}
                  placeholder="Search tasks…"
                  className="w-full sm:w-64 pl-11 pr-4 py-2.5 rounded-2xl border border-black/20 bg-white focus:outline-none focus:border-black transition-colors"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e)=>setStatusFilter(e.target.value)}
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

          {listLoading ? (
            <TableSkeleton rows={8} />
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="px-4 py-4 text-left text-black/60 uppercase tracking-wider text-xs">Title</th>
                    <th className="px-4 py-4 text-left text-black/60 uppercase tracking-wider text-xs">Deadline</th>
                    <th className="px-4 py-4 text-left text-black/60 uppercase tracking-wider text-xs">Status</th>
                    <th className="px-4 py-4 text-left text-black/60 uppercase tracking-wider text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((t, i) => (
                      <motion.tr
                        key={t._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: i * 0.03 }}
                        className="group border-b border-black/5 hover:bg-black/[0.02] transition-colors"
                      >
                        <td className="px-4 py-4">
                          <span className="text-black group-hover:translate-x-1 inline-block transition-transform">
                            {t.title}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="flex items-center gap-2 text-black">
                            <Calendar className="w-4 h-4 text-black/40" />
                            {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-4"><StatusBadge status={t.status} /></td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {t.status === "Assigned" && (
                              <>
                                <button
                                  onClick={()=>accept(t._id)}
                                  disabled={processingId===t._id}
                                  className="flex items-center gap-2 rounded-xl border border-black bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-50"
                                >
                                  {processingId===t._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                  Accept
                                </button>
                                <button
                                  onClick={()=>alert("Decline not implemented")}
                                  className="flex items-center gap-2 rounded-xl border border-black/30 bg-white px-4 py-2 hover:border-black"
                                >
                                  <XCircle className="w-4 h-4" /> Decline
                                </button>
                              </>
                            )}
                            {t.status === "In Progress" && (
                              <button
                                onClick={()=>complete(t._id)}
                                disabled={processingId===t._id}
                                className="flex items-center gap-2 rounded-xl border border-black bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-50"
                              >
                                {processingId===t._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Mark Completed
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-16 text-center text-black/40">
                        {searchQuery || statusFilter !== "all" ? "No tasks match your filters" : "No tasks found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
