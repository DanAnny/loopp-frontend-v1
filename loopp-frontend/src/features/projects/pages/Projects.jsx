// src/features/projects/pages/Projects.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";

import * as ProjectsApi from "@/services/projects.service";
import * as Users from "@/services/users.service";
import CreateTaskModal from "@/features/tasks/components/CreateTaskModal";

/* -------------------------------- helpers -------------------------------- */
const by = (k) => (a, b) => {
  const av = a?.[k], bv = b?.[k];
  return new Date(bv || 0) - new Date(av || 0);
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const normStatus = (s = "") => {
  const t = s.toString().toLowerCase();
  if (t.includes("progress")) return "In-Progress";
  if (t.includes("complete")) return "Complete";
  return "Pending";
};

const statusBadge = (s) => {
  const st = normStatus(s);
  if (st === "Pending") return "bg-yellow-500 text-white";
  if (st === "In-Progress") return "bg-emerald-100 text-emerald-900";
  return "bg-emerald-600/90 text-white";
};
const statusDot = (s) => {
  const st = normStatus(s);
  if (st === "Pending") return "bg-yellow-100";
  if (st === "In-Progress") return "bg-emerald-500";
  return "bg-emerald-700";
};

const daysLeft = (deadline) => {
  if (!deadline) return null;
  const end = new Date(deadline).setHours(23, 59, 59, 999);
  const diff = end - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};
const closeToDeadline = (deadline, withinDays = 5) => {
  const d = daysLeft(deadline);
  return d != null && d <= withinDays && d >= 0;
};

/* ----------------------------- main component ---------------------------- */
export default function Projects() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  // engineers map for name lookup
  const [engMap, setEngMap] = useState({});

  // filters
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all"); // all | pending | inprogress | complete

  // modal
  const [showCreateTask, setShowCreateTask] = useState(false);

  // load data
  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [pRes, eRes] = await Promise.all([
        ProjectsApi.getAll(),     // { success, projects: [...] } where each project now has taskDeadline
        Users.getEngineers(),     // { success, engineers: [...] }
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
        map[String(u._id)] = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "Engineer";
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
    let pending = 0, inprog = 0, complete = 0, dueSoon = 0, overdue = 0, withEng = 0, noEng = 0;
    const seenEng = new Set();

    for (const p of items) {
      const st = normStatus(p.status);
      if (st === "Pending") pending++;
      else if (st === "In-Progress") inprog++;
      else complete++;

      // ————————————— KEY CHANGE: derive all deadline math from taskDeadline
      const deadline = p.taskDeadline || null; // NEVER from completionDate any more
      const dl = daysLeft(deadline);
      if (dl != null) {
        if (dl < 0) overdue++;
        else if (dl <= 5) dueSoon++;
      }

      if (p.engineerAssigned) {
        withEng++;
        seenEng.add(String(p.engineerAssigned));
      } else {
        noEng++;
      }
    }

    return {
      total,
      pending,
      inprog,
      complete,
      dueSoon,
      overdue,
      withEng,
      noEng,
      uniqueEngineers: seenEng.size,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const base = items.filter((p) => {
      // text search
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      const hay =
        [
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
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-6 text-foreground">
      {/* title + actions */}
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-end gap-3 justify-between">
        <div>
          <div className="inline-flex items-center gap-2 bg-black text-white px-3 py-1 rounded-full text-xs mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PM Projects
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Your assigned requests, status, task deadlines, and engineers.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects…"
              className="pl-9 pr-3 py-2.5 rounded-xl border border-black/20 bg-white outline-none focus:border-black"
            />
          </div>

          {/* Create Task button */}
          <button
            onClick={() => setShowCreateTask(true)}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-black text-white hover:bg-black/90"
            title="Create Task"
          >
            <Plus className="w-4 h-4" />
            Create Task
          </button>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-black/20 hover:bg-black/[0.03]"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KPICard title="Total Projects" value={stats.total} icon={<FolderKanban className="w-4 h-4" />} />
        <KPICard title="Pending" value={stats.pending} chip="Pending" chipClass="bg-yellow-500 text-white" icon={<Hourglass className="w-4 h-4" />} />
        <KPICard title="In-Progress" value={stats.inprog} chip="Active" chipClass="bg-emerald-100 text-emerald-900" icon={<PlayCircle className="w-4 h-4" />} />
        <KPICard title="Complete" value={stats.complete} chip="Done" chipClass="bg-emerald-600/90 text-white" icon={<CheckCircle2 className="w-4 h-4" />} />
        <KPICard title="Due Soon (≤5d)" value={stats.dueSoon} icon={<CalendarClock className="w-4 h-4" />} />
        <KPICard title="Overdue" value={stats.overdue} chip="Attention" chipClass="bg-red-800 text-white" icon={<TriangleAlert className="w-4 h-4" />} />
        <KPICard title="With Engineer" value={stats.withEng} sub={`${stats.uniqueEngineers} unique`} icon={<UsersIcon className="w-4 h-4" />} />
        <KPICard title="Unassigned" value={stats.noEng} icon={<User className="w-4 h-4" />} />
      </div>

      {/* filter tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Tab label="All" active={tab === "all"} onClick={() => setTab("all")} />
        <Tab label="Pending" active={tab === "pending"} onClick={() => setTab("pending")} />
        <Tab label="In-Progress" active={tab === "inprogress"} onClick={() => setTab("inprogress")} />
        <Tab label="Complete" active={tab === "complete"} />
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block">
        <div className="rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
                  <tr className="text-left text-neutral-500">
                    <Th w="24%">Project</Th>
                    <Th w="18%">Client</Th>
                    <Th w="18%">Engineer</Th>
                    <Th w="14%">Status</Th>
                    <Th w="14%">
                      <div className="inline-flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Deadline
                      </div>
                    </Th>
                    <Th w="12%">Updated</Th>
                    <Th w="8%"></Th>
                  </tr>
                </thead>

                <tbody className="[&>tr:nth-child(even)]:bg-neutral-50/50">
                  {loading ? (
                    <SkeletonRows rows={8} cols={7} />
                  ) : filtered.length ? (
                    filtered.map((p) => {
                      const engName =
                        (p.engineerAssigned && engMap[String(p.engineerAssigned)]) ||
                        (p.engineerAssigned ? "Unknown engineer" : "Unassigned");
                      const st = normStatus(p.status);

                      // ————————————— KEY CHANGE: use taskDeadline
                      const deadline = p.taskDeadline || null;
                      const dleft = daysLeft(deadline);
                      const dlSoon = closeToDeadline(deadline, 5);

                      return (
                        <tr key={p._id} className="border-b last:border-0 border-black/10 hover:bg-black/[0.02] transition-colors">
                          {/* Project */}
                          <Td>
                            <div className="font-medium text-foreground truncate">
                              {p.projectTitle || "Untitled Project"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.projectDescription || "—"}
                            </div>
                          </Td>

                          {/* Client */}
                          <Td>
                            <div className="truncate">
                              {`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.email || "—"}
                            </div>
                          </Td>

                          {/* Engineer */}
                          <Td>
                            <div className="inline-flex items-center gap-2 min-w-0">
                              <User className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="truncate">{engName}</span>
                            </div>
                          </Td>

                          {/* Status */}
                          <Td>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${statusBadge(st)}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusDot(st)}`} />
                              {st}
                            </span>
                          </Td>

                          {/* Deadline */}
                          <Td>
                            <div className="inline-flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className={`truncate ${dlSoon ? "font-semibold" : ""}`}>
                                {fmtDate(deadline)}
                              </span>
                            </div>
                            {typeof dleft === "number" && (
                              <div className={`text-[11px] ${dleft < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                {dleft < 0 ? `${Math.abs(dleft)} day(s) overdue` : `${dleft} day(s) left`}
                              </div>
                            )}
                          </Td>

                          {/* Updated */}
                          <Td>
                            <div className="inline-flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="truncate">{fmtDate(p.updatedAt || p.createdAt)}</span>
                            </div>
                          </Td>

                          {/* Actions */}
                          <Td align="right">
                            <Link
                              to="/chat"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-black/20 hover:bg-black/[0.03]"
                            >
                              Open
                            </Link>
                          </Td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                        No projects match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / tablet cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <CardSkeleton count={5} />
        ) : filtered.length ? (
          filtered.map((p) => {
            const engName =
              (p.engineerAssigned && engMap[String(p.engineerAssigned)]) ||
              (p.engineerAssigned ? "Unknown engineer" : "Unassigned");
            const status = normStatus(p.status);

            // ————————————— KEY CHANGE (mobile): use taskDeadline
            const deadline = p.taskDeadline || null;
            const dlSoon = closeToDeadline(deadline, 5);
            const dleft = daysLeft(deadline);

            return (
              <div key={p._id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{p.projectTitle || "Untitled Project"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.projectDescription || "—"}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[11px] inline-flex items-center gap-1.5 ${statusBadge(status)}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />
                    {status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Client" value={`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—"} />
                  <Info label="Engineer" value={engName} />
                  <Info
                    label="Deadline"
                    value={
                      <span className={dlSoon ? "font-semibold" : ""}>
                        {fmtDate(deadline)}
                        {typeof dleft === "number"
                          ? ` · ${dleft < 0 ? `${Math.abs(dleft)}d overdue` : `${dleft}d left`}`
                          : ""}
                      </span>
                    }
                  />
                  <Info label="Updated" value={fmtDate(p.updatedAt || p.createdAt)} />
                </div>

                <div className="mt-3 flex justify-end">
                  <Link
                    to="/chat"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-black/20 hover:bg-black/[0.03]"
                  >
                    Open
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No projects match your filters.
          </div>
        )}
      </div>

      {/* errors */}
      {err && (
        <div className="mt-4 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-center gap-2">
          <TriangleAlert className="w-4 h-4" /> {err}
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onCreated={load}
      />
    </div>
  );
}

/* --------------------------------- atoms --------------------------------- */
function KPICard({ title, value, sub, icon, chip, chipClass }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">{title}</div>
          <div className="mt-1 text-2xl font-semibold leading-none truncate">{value ?? 0}</div>
          {chip && (
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] ${chipClass || "bg-black text-white"}`}
              >
                {chip}
              </span>
            </div>
          )}
          {sub && <div className="mt-1 text-[11px] text-muted-foreground truncate">{sub}</div>}
        </div>
        <div className="h-9 w-9 rounded-xl bg-black/5 grid place-items-center text-black shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl text-sm transition ${
        active ? "bg-black text-white shadow-sm" : "border border-black/15 hover:bg-black/[0.03]"
      }`}
    >
      {label}
    </button>
  );
}

function Th({ children, w }) {
  return (
    <th style={w ? { width: w } : undefined} className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
      {children}
    </th>
  );
}
function Td({ children, align = "left" }) {
  return (
    <td className={`px-4 py-4 align-middle ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}

function SkeletonRows({ rows = 6, cols = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-black/10">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-4">
              <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function CardSkeleton({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </>
  );
}

function Info({ label, value, warn }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-sm ${warn ? "font-semibold" : ""}`}>{value}</div>
    </div>
  );
}
