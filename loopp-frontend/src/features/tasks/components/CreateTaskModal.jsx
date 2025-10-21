import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Calendar, User, Mail, FileText, Loader2, CheckCircle,
  AlertTriangle, Plus, Users as UsersIcon, Check
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
    // WP-provided string (can be any format) — shown read-only
    completionDeadlineLabel: "",
    // PM-picked yyyy-mm-dd date
    pmDeadline: "",
  });

  const firstFieldRef = useRef(null);
  const dialogRef = useRef(null);

  /* ------------------------ SAFE DATE HELPERS (LOCAL) ------------------------ */
  // Accepts 'YYYY-MM-DD' or ISO-like '2025-10-13T...' → returns 'YYYY-MM-DD' or ''.
  function parseISODateOnly(value) {
    if (!value || typeof value !== "string") return "";
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    const dt = new Date(Date.UTC(y, mo, d));
    return isFinite(dt) ? dt.toISOString().slice(0, 10) : "";
  }

  // For showing the client’s requested deadline as a label:
  // - if it's a valid iso-ish date, show the yyyy-mm-dd
  // - else show the original text as-is
  function normalizeCompletionLabel(v) {
    if (!v) return "";
    const iso = parseISODateOnly(v);
    return iso || String(v);
  }

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
      const uiKey = `reqkey-${realId}-${i}`; // guaranteed non-empty unique
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
    const guessedISO = parseISODateOnly(r?.completionDate); // prefill PM deadline if it was a real date

    setForm((p) => ({
      ...p,
      uiRequestKey: uiKey,
      requestId: realId,
      projectTitle: r?.projectTitle || r?.title || "",
      projectDescription: r?.projectDescription || "",
      firstName: r?.firstName || "",
      lastName: r?.lastName || "",
      email: r?.email || "",
      completionDeadlineLabel: label,   // safe read-only text
      pmDeadline: guessedISO || "",     // yyyy-mm-dd
      title: r?.projectTitle || r?.title || "",
      description: r?.projectDescription || `Task for "${r?.projectTitle || r?.title || "Project"}"`,
    }));
    setError("");
  };

  const onChange = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setError(""); };

  const validate = () => {
    if (!form.requestId) return "Select a project request";
    if (!form.engineerId) return "Select an engineer";
    if (!form.title.trim()) return "Task title is required";
    // Uncomment if you want to hard-require PM deadline:
    // if (!form.pmDeadline) return "Please pick a task deadline";
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

  const reallySubmit = async () => {
    try {
      setLoading(true); setError("");
      await Tasks.createTask({
        requestId: form.requestId,
        engineerId: form.engineerId,
        title: form.title.trim(),
        description: form.description.trim(),
        pmDeadline: form.pmDeadline || null, // NEW
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[90] grid place-items-center p-3 sm:p-4">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-black/10 max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e)=>e.stopPropagation()}
            >
              {/* Top accent */}
              <div className="h-1 bg-gradient-to-r from-black/80 via-black to-black/80" />

              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-black/10">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground truncate">Assign Engineer & Create Task</h2>
                  <p className="text-xs text-muted-foreground">Pick a project request, then select an engineer.</p>
                </div>
                <motion.button
                  onClick={handleClose}
                  disabled={loading}
                  whileHover={{ rotate: 90, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </motion.button>
              </div>

              {/* Body (scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                    >
                      {error}
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Task created successfully!
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Project dropdown */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Project Request</label>
                  <div className="flex gap-2">
                    <select
                      ref={firstFieldRef}
                      value={form.uiRequestKey}
                      onChange={(e) => onPickRequest(e.target.value)}
                      disabled={loadingLists || loading}
                      className="flex-1 field-input pl-3"
                    >
                      <option key="placeholder-option" value="">
                        Select a request…
                      </option>
                      {requests.map((r) => (
                        <option key={`req-${r.__uiKey}`} value={r.__uiKey}>
                          {(r.projectTitle || r.title || "Untitled")}{r.engineerAssigned ? " • (Assigned)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={loadLists}
                      disabled={loadingLists || loading}
                      className="px-3 py-2 rounded-xl border border-black/20 hover:bg-black/[0.02]"
                      title="Reload"
                    >
                      {loadingLists ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 rotate-45" />}
                    </button>
                  </div>

                  {form.requestId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <RO label="Project Title"  icon={FileText} value={form.projectTitle || "—"} />
                      <RO label="Client Deadline (from form)" icon={Calendar} value={form.completionDeadlineLabel || "—"} />
                      <RO label="Client Name"    icon={User}     value={`${form.firstName} ${form.lastName}`.trim() || "—"} />
                      <RO label="Client Email"   icon={Mail}     value={form.email || "—"} />
                    </div>
                  )}
                </div>

                {/* Engineer selector */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!form.requestId || loadingLists || loading}
                    onClick={() => setPickOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-black/20 hover:bg-black/[0.02] transition"
                  >
                    <UsersIcon className="w-4 h-4" />
                    {form.engineerId ? `Change Engineer (${form.engineerName})` : "Select Engineer"}
                  </button>
                  {form.engineerId && (
                    <span className="text-xs text-muted-foreground truncate">
                      Selected: <span className="font-medium">{form.engineerName}</span>
                    </span>
                  )}
                </div>

                {/* Task meta */}
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Task Title" icon={FileText}>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => onChange("title", e.target.value)}
                      placeholder="e.g., Build client onboarding flow"
                      className="field-input pl-10"
                      disabled={loading || success}
                    />
                  </Field>

                  <Field label="Task Description" icon={FileText}>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={(e) => onChange("description", e.target.value)}
                      placeholder="Briefly describe the deliverables…"
                      className="field-input pl-10 resize-none"
                      disabled={loading || success}
                    />
                  </Field>

                  {/* NEW: PM-picked deadline */}
                  <Field label="Task Deadline (PM)" icon={Calendar}>
                    <input
                      type="date"
                      value={form.pmDeadline}
                      onChange={(e) => onChange("pmDeadline", e.target.value)}
                      className="field-input pl-10"
                      disabled={loading || success}
                    />
                  </Field>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-black/10 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="inline-flex justify-center items-center rounded-xl px-4 py-3 border border-black/20 text-foreground hover:bg-black/5 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  onClick={tryWarnOrSubmit}
                  disabled={loading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="inline-flex justify-center items-center gap-2 rounded-xl px-4 py-3 bg-black text-white hover:bg-black/90 shadow-sm transition disabled:opacity-60 sm:ml-auto"
                >
                  {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>Creating…</span></>) : ("Create Task")}
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
                <motion.div className="fixed inset-0 bg-black/50 z-[100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={()=>setWarn(null)} />
                <motion.div
                  className="fixed inset-0 z-[110] grid place-items-center p-3 sm:p-4"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                >
                  <div className="w-full max-w-lg bg-white rounded-2xl border border-black/20 shadow-2xl p-5" onClick={(e)=>e.stopPropagation()}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-foreground font-semibold">Engineer is busy</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {warn.engineer.firstName} {warn.engineer.lastName} is currently {warn.engineer.isBusy ? "busy" : "handling tasks"} ({warn.engineer.numberOfTask || 0} task(s)).
                        </p>
                        {warn.recommend && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Recommendation: <span className="font-medium">{warn.recommend.firstName} {warn.recommend.lastName}</span> ({warn.recommend.numberOfTask || 0} task(s){warn.recommend.isBusy ? ", busy" : ", available"}).
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-5">
                      <button className="px-4 py-3 rounded-xl border border-black/20 hover:bg-black/[0.02]" onClick={()=>setWarn(null)}>Cancel</button>
                      {warn.recommend && (
                        <button
                          className="px-4 py-3 rounded-xl border border-black/20 hover:bg-black/[0.02]"
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
                        </button>
                      )}
                      <button
                        className="px-4 py-3 rounded-xl bg-black text-white hover:bg-black/90 ml-auto"
                        onClick={async () => {
                          setOverrideEngineerId(warn.engineer._id); // allow override once for this engineer
                          setWarn(null);
                          await reallySubmit();
                        }}
                      >
                        Keep Selection
                      </button>
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

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
        {/* inputs/textarea inside should include pl-10 to avoid overlap */}
        {children}
      </div>
    </div>
  );
}

function RO({ label, icon: Icon, value }) {
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="field-input pl-10 bg-black/[0.03] min-h-[44px] flex items-center">{value}</div>
      {Icon && <Icon className="pointer-events-none absolute left-3 top-[42px] w-4 h-4 text-muted-foreground" />}
    </div>
  );
}

function EngineerPicker({ open, onClose, engineers, onPick }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/50 z-[120]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="fixed inset-0 z-[130] grid place-items-center p-3 sm:p-4"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
      >
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-black/20 shadow-2xl overflow-hidden" onClick={(e)=>e.stopPropagation()}>
          <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
            <h3 className="font-semibold">Select Engineer</h3>
            <button className="p-2 rounded-lg hover:bg-black/5" onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 max-h-[60vh] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            {engineers.map((e, i) => (
              <button
                key={`eng-${e._id || `idx-${i}`}`}
                onClick={() => onPick(e)}
                className="group text-left p-4 rounded-xl border border-black/10 hover:border-black/30 hover:shadow transition"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium truncate">{e.firstName} {e.lastName}</p>
                  {e.isBusy
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Busy</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Available</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{e.email}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Check className="w-3 h-3" /> {Number(e.numberOfTask) || 0} active task(s)
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* Tailwind helper (ensure this exists somewhere global):
.field-input { @apply w-full px-3 py-3 rounded-xl border border-black/20 bg-white focus:outline-none focus:border-black transition text-sm; }
*/
