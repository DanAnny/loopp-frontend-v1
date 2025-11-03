import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import mgt from "@/services/management.service";
import userService from "@/services/users.service";
import {
  Users2,
  Activity,
  Loader2,
  CheckSquare,
  Square,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Shield,
  ShieldOff,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from "lucide-react";

export default function Management() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [kpi, setKpi] = useState(null);

  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [roleFilter, setRoleFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("lastActive");
  const [sortDir, setSortDir] = useState("desc");

  const [audits, setAudits] = useState([]);
  const [busyBulk, setBusyBulk] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const [{ data: o }, { data: all }, { data: aud }] = await Promise.all([
        mgt.getOverview(),
        userService.getAll(),
        mgt.getAudits(20),
      ]);
      setKpi(o?.data || null);
      const list = Array.isArray(all?.users) ? all.users : Array.isArray(all) ? all : [];
      setStaff(list.map(mapUser));
      setAudits(Array.isArray(aud?.audits) ? aud.audits : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((u) => (roleFilter === "All" ? true : u.role === roleFilter))
      .filter((u) =>
        q
          ? `${u.firstName} ${u.lastName} ${u.email} ${u.phone} ${u.role}`.toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "role") return a.role.localeCompare(b.role) * dir;
        if (sortKey === "numberOfTask") return (a.numberOfTask - b.numberOfTask) * dir;
        const A = new Date(a.lastActiveISO || 0).getTime();
        const B = new Date(b.lastActiveISO || 0).getTime();
        return (A - B) * dir;
      });
  }, [staff, roleFilter, query, sortKey, sortDir]);

  const allSelectedOnPage = filtered.every((u) => selected.has(u.id)) && filtered.length > 0;
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelectedOnPage) filtered.forEach((u) => next.delete(u.id));
    else filtered.forEach((u) => next.add(u.id));
    setSelected(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const applyBulk = async (patch) => {
    if (selected.size === 0) return;
    try {
      setBusyBulk(true);
      await mgt.bulkUpdate(Array.from(selected), patch);
      setStaff((prev) =>
        prev.map((u) => (selected.has(u.id) ? { ...u, ...patch, role: patch.role || u.role } : u))
      );
      setSelected(new Set());
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "Bulk update failed");
    } finally {
      setBusyBulk(false);
    }
  };

  const quickToggle = async (user, patch) => {
    try {
      await mgt.toggleUser(user.id, patch);
      setStaff((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...patch } : u)));
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "Update failed");
    }
  };

  const stats = kpi?.staff || {};
  const proj = kpi?.projects || {};

  return (
    <main className="min-h-screen bg-[#0f1729] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            {/* Title */}
            <div className="bg-[#1a2332] border border-slate-700/50 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Users2 className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl text-white">Staff Management</h1>
              </div>
              <p className="text-sm text-slate-400">
                Control staffing state, roles, and review recent activity
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search staff…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/50 bg-[#1a2332] text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-600 transition-all text-sm"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="pl-10 pr-8 py-2.5 rounded-xl border border-slate-700/50 bg-[#1a2332] text-white focus:outline-none focus:border-slate-600 transition-all text-sm appearance-none cursor-pointer"
                  title="Role"
                >
                  <option>All</option>
                  <option>PM</option>
                  <option>Engineer</option>
                  <option>Admin</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={load}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm text-white shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </motion.button>
            </div>
          </div>
        </motion.header>

        {/* Error */}
        {err && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm"
          >
            {err}
          </motion.div>
        )}

        {/* KPI cards (no percentages anywhere) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 mb-6"
        >
          <KpiCard
            icon={<Users2 className="h-4 w-4" />}
            title="Staff"
            value={`${fmt(stats.total)} total`}
            meta={`${fmt(stats.pms)} PM • ${fmt(stats.engs)} Eng • ${fmt(stats.admins)} Admin`}
          />
          <KpiCard
            icon={<Activity className="h-4 w-4" />}
            title="PM Load"
            value={`${fmt(stats.pmActive)} active`}
            meta={`${fmt(stats.pmIdle)} idle`}
          />
          <KpiCard
            icon={<Activity className="h-4 w-4" />}
            title="Engineer Load"
            value={`${fmt(stats.engActive)} active`}
            meta={`${fmt(stats.engIdle)} idle`}
          />
        </motion.section>

        {/* Pipeline snapshot */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 mb-6"
        >
          <KpiCard title="Requests" value={fmt(proj.open)} meta="New + Assigned" />
          <KpiCard title="In Progress" value={fmt(proj.inProgress)} meta="Build + Review" />
          <KpiCard title="Completed" value={fmt(proj.completed)} meta="Done" />
        </motion.section>

        {/* Bulk actions */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-4 rounded-xl border border-slate-700/50 bg-[#1a2332] p-4 shadow-lg"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-300">
              <strong className="text-white">{selected.size}</strong> selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BulkButton disabled={selected.size === 0 || busyBulk} onClick={() => applyBulk({ isBusy: true })}>
                Mark Busy
              </BulkButton>
              <BulkButton disabled={selected.size === 0 || busyBulk} onClick={() => applyBulk({ isBusy: false })}>
                Mark Idle
              </BulkButton>
              <BulkButton disabled={selected.size === 0 || busyBulk} onClick={() => applyBulk({ online: true })}>
                Set Online
              </BulkButton>
              <BulkButton disabled={selected.size === 0 || busyBulk} onClick={() => applyBulk({ online: false })}>
                Set Offline
              </BulkButton>

              <div className="hidden lg:block w-px h-6 bg-slate-700/50" />

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Bulk role:</span>
                <BulkButton disabled={selected.size === 0 || busyBulk} onClick={() => applyBulk({ role: "PM" })}>
                  PM
                </BulkButton>
                <BulkButton disabled={selected.size === 0 || busyBulk} onClick={() => applyBulk({ role: "Engineer" })}>
                  Engineer
                </BulkButton>
                <BulkButton
                  disabled={selected.size === 0 || busyBulk}
                  onClick={() => applyBulk({ role: "Admin" })}
                  title="Only SuperAdmin can grant Admin (server enforced)"
                >
                  Admin
                </BulkButton>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Table */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-slate-700/50 bg-[#1a2332] shadow-lg overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-[1] bg-[#1a2332] border-b border-slate-700/50">
                <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 sm:px-4 py-3">
                    <button
                      onClick={toggleAll}
                      className="inline-flex items-center gap-2 text-sm hover:text-white transition-colors"
                      title="Select all on page"
                    >
                      {allSelectedOnPage ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      <span className="hidden sm:inline">Select</span>
                    </button>
                  </th>
                  <ThSort label="Name" active={false} />
                  <ThSort
                    label="Role"
                    active={sortKey === "role"}
                    dir={sortDir}
                    onClick={() => toggleSort(setSortKey, setSortDir, "role", sortKey, sortDir)}
                  />
                  <th className="px-3 sm:px-4 py-3">Email</th>
                  <th className="px-3 sm:px-4 py-3 hidden lg:table-cell">Phone</th>
                  <th className="px-3 sm:px-4 py-3">Status</th>
                  <ThSort
                    label="Tasks"
                    active={sortKey === "numberOfTask"}
                    dir={sortDir}
                    onClick={() => toggleSort(setSortKey, setSortDir, "numberOfTask", sortKey, sortDir)}
                  />
                  <ThSort
                    label="Last Active"
                    active={sortKey === "lastActive"}
                    dir={sortDir}
                    onClick={() => toggleSort(setSortKey, setSortDir, "lastActive", sortKey, sortDir)}
                  />
                  <th className="px-3 sm:px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading rows={8} />
                ) : (
                  <>
                    {filtered.map((u, idx) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        className="group hover:bg-white/5 border-b border-slate-700/30 transition-colors"
                      >
                        <td className="px-3 sm:px-4 py-3">
                          <button
                            onClick={() => toggleOne(u.id)}
                            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                            title="Select"
                          >
                            {selected.has(u.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-sm">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={`${u.firstName} ${u.lastName}`} />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-white">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="truncate text-[11px] text-slate-500">ID: {u.id.slice(-8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-sm">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-sm">
                          <span className="block max-w-[260px] truncate sm:max-w-none text-slate-300" title={u.email}>
                            {u.email || "—"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-sm hidden lg:table-cell text-slate-300">
                          {u.phone || "—"}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-sm">
                          <div className="flex flex-col gap-1">
                            {u.isBusy ? <Badge tone="amber">Busy</Badge> : <Badge tone="sky">Idle</Badge>}
                            {u.online ? <Badge tone="emerald">Online</Badge> : <Badge tone="slate">Offline</Badge>}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-sm text-white">{u.numberOfTask ?? 0}</td>
                        <td className="px-3 sm:px-4 py-3 text-sm text-slate-300">
                          {u.lastActive ? new Date(u.lastActiveISO).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => quickToggle(u, { isBusy: !u.isBusy })}
                              className="rounded-lg border border-slate-700/50 bg-white/5 hover:bg-white/10 p-2 text-white transition-all"
                              title="Toggle busy"
                            >
                              {u.isBusy ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => quickToggle(u, { online: !u.online })}
                              className="rounded-lg border border-slate-700/50 bg-white/5 hover:bg-white/10 p-2 text-white transition-all"
                              title="Toggle online"
                            >
                              {u.online ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                    {!filtered.length && !loading && (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-400" colSpan={9}>
                          No staff match your filters.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>
    </main>
  );
}

/* ---------- UI Components ---------- */

function KpiCard({ icon, title, value, meta }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-[#1a2332] p-5 sm:p-6 shadow-lg transition-all"
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] sm:text-xs uppercase tracking-wide text-slate-400 mb-1">{title}</div>
          <div className="text-xl sm:text-2xl text-white mb-1">{value}</div>
          {meta && <div className="text-[11px] text-slate-500">{meta}</div>}
        </div>
      </div>
    </motion.div>
  );
}

function Badge({ children, tone = "slate" }) {
  const toneMap = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    slate: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] ${toneMap[tone]}`}>
      {children}
    </span>
  );
}

function RoleBadge({ role }) {
  const roleMap = {
    PM: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400",
    Engineer: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400",
  };
  const colors = roleMap[role] || "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] bg-gradient-to-r ${colors}`}>
      {role}
    </span>
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
  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-[11px] text-white shadow-lg">
      {initials || "?"}
    </div>
  );
}

function ThSort({ label, active, dir, onClick }) {
  return (
    <th
      scope="col"
      className="px-3 sm:px-4 py-3 cursor-pointer select-none hover:text-white transition-colors"
      onClick={onClick}
      title={`Sort by ${label}`}
    >
      <span className={`inline-flex items-center gap-1 ${active ? "text-white" : ""}`}>
        {label}
        {active ? (dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : null}
      </span>
    </th>
  );
}

function BulkButton({ children, disabled, onClick, title }) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="rounded-lg border border-slate-700/50 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      {children}
    </motion.button>
  );
}

function TableLoading({ rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td className="border-b border-slate-700/30 px-3 sm:px-4 py-3" colSpan={9}>
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <div className="h-3 w-2/3 rounded bg-slate-700/30 animate-pulse" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

/* ---------- Helpers ---------- */
function toggleSort(setKey, setDir, key, curKey, curDir) {
  if (curKey === key) setDir(curDir === "asc" ? "desc" : "asc");
  else {
    setKey(key);
    setDir("asc");
  }
}
function mapUser(u) {
  return {
    id: u?._id || u?.id,
    firstName: u?.firstName || u?.first_name || "",
    lastName: u?.lastName || u?.last_name || "",
    email: u?.email || "",
    phone: u?.phone || "",
    role: (u?.role || "").toString(),
    isBusy: !!u?.isBusy,
    online: !!u?.online,
    numberOfTask: Number(u?.numberOfTask || 0),
    lastActive: u?.lastActive || u?.updatedAt || null,
    lastActiveISO: u?.lastActive || u?.updatedAt || null,
  };
}
function fmt(v) {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}
