import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Calendar, User, Mail, FileText, Loader2, CheckCircle,
  AlertTriangle, Plus, Users as UsersIcon, Check, Sparkles, ArrowRight, Inbox
} from "lucide-react";
import * as Projects from "@/services/projects.service";
import * as Users from "@/services/users.service";
import * as Tasks from "@/services/tasks.service";

export default function CreateTaskModal({ open, onClose, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [requests, setRequests] = useState([]);
  const [engineers, setEngineers] = useState([]);

  const [pickOpen, setPickOpen] = useState(false);
  const [warn, setWarn] = useState(null);
  const [overrideEngineerId, setOverrideEngineerId] = useState(null);

  const [form, setForm] = useState({
    requestId: "",
    uiRequestKey: "",
    engineerId: "",
    engineerName: "",
    title: "",
    description: "",
    projectTitle: "",
    projectDescription: "",
    firstName: "",
    lastName: "",
    email: "",
    completionDeadlineLabel: "",
    pmDeadline: "", // YYYY-MM-DD
  });

  const firstFieldRef = useRef(null);
  const dialogRef = useRef(null);
  const deadlineRef = useRef(null);

  /* ------------------------ SAFE DATE HELPERS (LOCAL) ------------------------ */
  function parseISODateOnly(value) {
    if (!value || typeof value !== "string") return "";
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    const dt = new Date(Date.UTC(y, mo, d));
    return isFinite(dt) ? dt.toISOString().slice(0, 10) : "";
  }

  function normalizeCompletionLabel(v) {
    if (!v) return "";
    const iso = parseISODateOnly(v);
    return iso || String(v);
  }

  // Today in local time as YYYY-MM-DD (for <input type="date" min>)
  function todayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const minDate = todayISO();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => firstFieldRef.current?.focus(), 50);
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose?.();
  };

  const reset = () => {
    setForm({
      requestId: "",
      uiRequestKey: "",
      engineerId: "",
      engineerName: "",
      title: "",
      description: "",
      projectTitle: "",
      projectDescription: "",
      firstName: "",
      lastName: "",
      email: "",
      completionDeadlineLabel: "",
      pmDeadline: "",
    });
    setError("");
    setSuccess(false);
    setWarn(null);
    setOverrideEngineerId(null);
    setRequests([]);
    setEngineers([]);
  };

  const parseProjectsResponse = (payload) => {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.projects)
      ? payload.projects
      : Array.isArray(payload?.data?.projects)
      ? payload.data.projects
      : [];
    return Array.isArray(list) ? list : [];
  };

  const normalizeRequests = (list) =>
    list.map((r, i) => {
      const realId = String(r._id || r.id || r.requestId || `noid-${i}`);
      const uiKey = `reqkey-${realId}-${i}`;
      return { ...r, __uiKey: uiKey, __realId: realId };
    });

  const loadLists = async () => {
    try {
      setLoadingLists(true);
      setError("");

      const reqRes = await Projects.getAll();
      const parsed = parseProjectsResponse(reqRes?.data);
      const sorted = [...parsed].sort((a, b) => {
        const aAssigned = a?.engineerAssigned ? 1 : 0;
        const bAssigned = b?.engineerAssigned ? 1 : 0;
        if (aAssigned !== bAssigned) return aAssigned - bAssigned;
        return new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0);
      });
      setRequests(normalizeRequests(sorted));

      const engRes = await Users.getEngineers();
      const engs = Array.isArray(engRes?.data?.engineers) ? engRes.data.engineers : [];
      setEngineers(engs);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load data");
      setRequests([]);
      setEngineers([]);
    } finally {
      setLoadingLists(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadLists();
  }, [open]);

  const onPickRequest = (uiKey) => {
    const r = requests.find((x) => String(x.__uiKey) === String(uiKey));
    if (!r) return;
    const realId = r.__realId;

    const label = normalizeCompletionLabel(r?.completionDate);
    const guessedISO = parseISODateOnly(r?.completionDate);

    setForm((p) => ({
      ...p,
      uiRequestKey: uiKey,
      requestId: realId,
      projectTitle: r?.projectTitle || r?.title || "",
      projectDescription: r?.projectDescription || "",
      firstName: r?.firstName || "",
      lastName: r?.lastName || "",
      email: r?.email || "",
      completionDeadlineLabel: label,
      pmDeadline: guessedISO || "",
      title: r?.projectTitle || r?.title || "",
      description: r?.projectDescription || `Task for "${r?.projectTitle || r?.title || "Project"}"`,
    }));
    setError("");
  };

  const onChange = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setError(""); };

  // ✅ include deadline requirement
  const validate = () => {
    if (!form.requestId) return "Select a project request";
    if (!form.engineerId) return "Select an engineer";
    if (!form.title.trim()) return "Task title is required";
    if (!form.pmDeadline) return "Select a task deadline";
    return null;
  };

  const recommendEngineer = () => {
    const L = engineers || [];
    const sorted = [...L].sort((a, b) => {
      if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
      return (a.numberOfTask || 0) - (b.numberOfTask || 0);
    });
    return sorted[0] || null;
  };

  const tryWarnOrSubmit = async () => {
    const v = validate();
    if (v) { setError(v); return; }

    const eng = engineers.find((e) => String(e._id) === String(form.engineerId));

    if (eng && String(overrideEngineerId) === String(eng._id)) {
      await reallySubmit();
      return;
    }

    if (eng && (eng.isBusy || (eng.numberOfTask || 0) >= 2)) {
      const rec = recommendEngineer();
      setWarn({ engineer: eng, recommend: rec && rec._id !== eng._id ? rec : null });
      return;
    }
    await reallySubmit();
  };

  // ✅ send BOTH "deadline" and "pmDeadline" so backend always fills taskDeadline
  const reallySubmit = async () => {
    try {
      setLoading(true); setError("");
      const iso = form.pmDeadline; // already YYYY-MM-DD
      await Tasks.createTask({
        requestId: form.requestId,
        engineerId: form.engineerId,
        title: form.title.trim(),
        description: form.description.trim(),
        deadline: iso,
        pmDeadline: iso,
      });
      setSuccess(true);
      setTimeout(() => {
        onCreated?.();
        handleClose();
      }, 800);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to create task");
    } finally {
      setLoading(false);
      setWarn(null);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.button
            aria-label="Close modal"
            onClick={handleClose}
            className="fixed inset-0 bg-black/70 z-[80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[90] grid place-items-center p-3 sm:p-4 overscroll-contain">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-[min(42rem,calc(100vw-24px))] max-w-none bg-[#0f1729] rounded-2xl shadow-2xl border border-slate-700/50 max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e)=>e.stopPropagation()}
            >
              {/* Top accent bar */}
              <motion.div
                className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.05, duration: 0.3 }}
              />

              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-700/50 bg-[#1a2332]">
                <div className="min-w-0">
                  <h2 className="text-xl text-white tracking-tight mb-1">Create Task Assignment</h2>
                  <p className="text-xs text-slate-400 uppercase tracking-[0.15em]">Project • Engineer • Details</p>
                </div>
                <motion.button
                  onClick={handleClose}
                  disabled={loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-slate-700/50 disabled:opacity-50 transition-all"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-white" />
                </motion.button>
              </div>

              {/* Body (scrollable) */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-5 bg-[#0f1729]">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3.5 flex items-center gap-3"
                    >
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3.5 flex items-center gap-3"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Task created successfully!</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Project request block */}
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="bg-[#1a2332] border border-slate-700/50 rounded-xl p-4 overflow-x-hidden"
                >
                  <label className="block text-xs uppercase tracking-[0.15em] text-slate-400 mb-3">Project Request</label>

                  {/* Empty state */}
                  {!loadingLists && requests.length === 0 ? (
                    <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#0f1729] border border-slate-700/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-white/5 border border-slate-700/50 shrink-0">
                          <Inbox className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-300 text-sm font-medium truncate">No requests found</p>
                          <p className="text-slate-500 text-xs">There are no project requests to assign yet.</p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ rotate: 180, scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={loadLists}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-slate-700/50 transition shrink-0"
                      >
                        <Plus className="w-4 h-4 rotate-45 text-white" />
                      </motion.button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-stretch min-w-0">
                      {/* Constrained select wrapper */}
                      <div className="relative flex-1 min-w-0">
                        <select
                          ref={firstFieldRef}
                          value={form.uiRequestKey}
                          onChange={(e) => onPickRequest(e.target.value)}
                          disabled={loadingLists || loading || requests.length === 0}
                          className="block w-full min-w-0 max-w-full px-4 py-3 pr-10 rounded-xl bg-[#0f1729] border border-slate-700/50 focus:outline-none focus:border-slate-600 transition-all text-white disabled:opacity-50 appearance-none overflow-hidden truncate"
                          style={{ whiteSpace: "nowrap", textOverflow: "ellipsis" }}
                        >
                          <option key="placeholder-option" value="">
                            {loadingLists ? "Loading…" : "Select a request…"}
                          </option>
                          {requests.map((r) => (
                            <option key={`req-${r.__uiKey}`} value={r.__uiKey}>
                              {(r.projectTitle || r.title || "Untitled")}{r.engineerAssigned ? " • (Assigned)" : ""}
                            </option>
                          ))}
                        </select>
                        {/* Custom caret to avoid native overflow quirks */}
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                          ▼
                        </div>
                      </div>

                      <motion.button
                        whileHover={{ rotate: 180, scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={loadLists}
                        disabled={loadingLists || loading}
                        className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-slate-700/50 disabled:opacity-50 transition-all shrink-0"
                        title="Reload"
                      >
                        {loadingLists ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Plus className="w-5 h-5 rotate-45 text-white" />}
                      </motion.button>
                    </div>
                  )}

                  {form.requestId && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-700/50"
                    >
                      <RO label="Project Title"  icon={FileText} value={form.projectTitle || "—"} />
                      <RO label="Client Deadline" icon={Calendar} value={form.completionDeadlineLabel || "—"} />
                      <RO label="Client Name"    icon={User}     value={`${form.firstName} ${form.lastName}`.trim() || "—"} />
                      <RO label="Client Email"   icon={Mail}     value={form.email || "—"} />
                    </motion.div>
                  )}
                </motion.div>

                {/* Engineer selector */}
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                  className="bg-[#1a2332] border border-slate-700/50 rounded-xl p-4 overflow-x-hidden"
                >
                  <label className="block text-xs uppercase tracking-[0.15em] text-slate-400 mb-3">Engineer Assignment</label>
                  <div className="flex items-center gap-3 min-w-0">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      disabled={!form.requestId || loadingLists || loading}
                      onClick={() => setPickOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 bg-white/5 hover:bg-white/10 border border-slate-700/50 disabled:opacity-50 transition-all shrink-0"
                    >
                      <UsersIcon className="w-5 h-5 text-white" />
                      <span className="text-white">{form.engineerId ? `Change (${form.engineerName})` : "Select Engineer"}</span>
                    </motion.button>
                    {form.engineerId && (
                      <motion.div
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 min-w-0"
                      >
                        <Check className="w-4 h-4 shrink-0" />
                        <span className="font-medium truncate">{form.engineerName}</span>
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                {/* Task meta */}
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.2 }}
                  className="bg-[#1a2332] border border-slate-700/50 rounded-xl p-4 space-y-4 overflow-x-hidden"
                >
                  <label className="block text-xs uppercase tracking-[0.15em] text-slate-400 mb-3">Task Details</label>

                  <Field label="Task Title" icon={FileText}>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => onChange("title", e.target.value)}
                      placeholder="e.g., Build client onboarding flow"
                      className="w-full px-4 py-3 pl-11 rounded-xl bg-[#0f1729] border border-slate-700/50 focus:outline-none focus:border-slate-600 transition text-sm text-white placeholder-slate-400"
                      disabled={loading || success}
                    />
                  </Field>

                  <Field label="Task Description" icon={FileText}>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={(e) => onChange("description", e.target.value)}
                      placeholder="Briefly describe the deliverables…"
                      className="w-full px-4 py-3 pl-11 rounded-xl bg-[#0f1729] border border-slate-700/50 focus:outline-none focus:border-slate-600 transition text-sm text-white placeholder-slate-400 resize-none"
                      disabled={loading || success}
                    />
                  </Field>

                  <Field label="Task Deadline" icon={Calendar} onIconClick={() => deadlineRef.current?.showPicker?.()}>
                    <input
                      ref={deadlineRef}
                      type="date"
                      value={form.pmDeadline}
                      min={minDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && v < minDate) {
                          setForm((p) => ({ ...p, pmDeadline: minDate }));
                        } else {
                          onChange("pmDeadline", v);
                        }
                      }}
                      onFocus={(e) => e.target.showPicker?.()}
                      className="w-full px-4 py-3 pl-11 rounded-xl bg-[#0f1729] border border-slate-700/50 focus:outline-none focus:border-slate-600 transition text-sm text-white placeholder-slate-400"
                      disabled={loading || success}
                      aria-label="Select task deadline"
                    />
                  </Field>
                </motion.div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-700/50 bg-[#1a2332] flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="inline-flex justify-center items-center rounded-xl px-5 py-3 bg-white/5 hover:bg-white/10 border border-slate-700/50 text-white transition-all disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={tryWarnOrSubmit}
                  disabled={loading}
                  className="inline-flex justify-center items-center gap-2 rounded-xl px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg transition-all disabled:opacity-60 sm:ml-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating…</span>
                    </>
                  ) : (
                    <>
                      <span>Create Task</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Engineer Picker Modal */}
          <EngineerPicker
            open={pickOpen}
            onClose={() => setPickOpen(false)}
            engineers={engineers}
            onPick={(eng) => {
              setPickOpen(false);
              setWarn(null);
              setOverrideEngineerId(null);
              setForm((p) => ({
                ...p,
                engineerId: eng._id,
                engineerName: `${eng.firstName} ${eng.lastName}`.trim(),
              }));
            }}
          />

          {/* Busy warning & recommendation */}
          <AnimatePresence>
            {warn && (
              <>
                <motion.div
                  className="fixed inset-0 bg-black/70 z-[100]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={()=>setWarn(null)}
                />
                <motion.div
                  className="fixed inset-0 z-[110] grid place-items-center p-3 sm:p-4"
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <div className="w-[min(36rem,calc(100vw-24px))] bg-[#1a2332] rounded-2xl border border-slate-700/50 shadow-2xl p-6 overflow-x-hidden" onClick={(e)=>e.stopPropagation()}>
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white mb-2">Engineer Capacity Warning</h4>
                        <p className="text-sm text-slate-300 mb-3">
                          <span className="font-medium">{warn.engineer.firstName} {warn.engineer.lastName}</span> is currently {warn.engineer.isBusy ? "busy" : "handling tasks"} with <span className="font-medium">{warn.engineer.numberOfTask || 0} active task(s)</span>.
                        </p>
                        {warn.recommend && (
                          <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
                            <p className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              <span>Recommended: <span className="font-medium">{warn.recommend.firstName} {warn.recommend.lastName}</span> ({warn.recommend.numberOfTask || 0} tasks)</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-slate-700/50 text-white transition-all"
                        onClick={()=>setWarn(null)}
                      >
                        Cancel
                      </motion.button>
                      {warn.recommend && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                          onClick={() => {
                            setWarn(null);
                            setOverrideEngineerId(null);
                            setForm((p)=>({
                              ...p,
                              engineerId: warn.recommend._id,
                              engineerName: `${warn.recommend.firstName} ${warn.recommend.lastName}`.trim(),
                            }));
                          }}
                        >
                          Use Recommended
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 ml-auto transition-all"
                        onClick={async () => {
                          setOverrideEngineerId(warn.engineer._id);
                          setWarn(null);
                          await reallySubmit();
                        }}
                      >
                        Keep Selection
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------- UI Helpers ------------------------------- */

function Field({ label, icon: Icon, children, onIconClick }) {
  const isTextarea = children?.type === 'textarea';
  return (
    <div className="min-w-0">
      <label className="block text-xs uppercase tracking-[0.15em] text-slate-400 mb-2">{label}</label>
      <div className="relative min-w-0 overflow-x-hidden">
        {Icon && (
          <button
            type="button"
            onClick={onIconClick}
            className={`absolute left-3 ${isTextarea ? "top-3" : "top-1/2 -translate-y-1/2"} p-1 rounded-md hover:bg-white/5 focus:outline-none`}
            aria-label={`${label} icon`}
          >
            <Icon className="w-4 h-4 text-slate-500" />
          </button>
        )}
        <div className={`${Icon ? "pl-8" : ""} min-w-0`}>{children}</div>
      </div>
    </div>
  );
}

function RO({ label, icon: Icon, value }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs uppercase tracking-[0.15em] text-slate-500 mb-2">{label}</label>
      <div className="relative">
        <div className="px-4 py-2.5 pl-11 rounded-xl bg-[#0f1729] border border-slate-700/50 text-slate-300 text-sm min-h-[44px] flex items-center overflow-hidden">
          <span className="truncate">{value}</span>
        </div>
        {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />}
      </div>
    </div>
  );
}

function EngineerPicker({ open, onClose, engineers, onPick }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 z-[120]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-0 z-[130] grid place-items-center p-3 sm:p-4"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="w-[min(42rem,calc(100vw-24px))] bg-[#0f1729] rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden" onClick={(e)=>e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-slate-700/50 bg-[#1a2332] flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="text-white">Select Engineer</h3>
              <p className="text-xs text-slate-400 uppercase tracking-[0.15em] mt-0.5">Available team members</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-slate-700/50 transition-all"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-white" />
            </motion.button>
          </div>
          <div className="p-5 max-h-[60vh] overflow-auto bg-[#0f1729] grid grid-cols-1 sm:grid-cols-2 gap-3">
            {engineers.map((e, i) => (
              <motion.button
                key={`eng-${e._id || `idx-${i}`}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.15 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onPick(e)}
                className="group text-left p-4 rounded-xl bg-[#1a2332] border border-slate-700/50 hover:border-slate-600 hover:shadow-lg transition-all min-w-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium truncate text-white">{e.firstName} {e.lastName}</p>
                  {e.isBusy
                    ? <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium">Busy</span>
                    : <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">Available</span>}
                </div>
                <p className="text-xs text-slate-400 truncate mb-2">{e.email}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Check className="w-3 h-3" />
                  <span>{Number(e.numberOfTask) || 0} active task(s)</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
