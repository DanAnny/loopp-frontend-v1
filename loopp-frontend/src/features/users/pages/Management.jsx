import React, { useEffect, useMemo, useState } from "react";
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
  UserCog,
  ChevronDown,
  ChevronUp,
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
          ? `${u.firstName} ${u.lastName} ${u.email} ${u.phone} ${u.role}`
              .toLowerCase()
              .includes(q)
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
    if (allSelectedOnPage) {
      filtered.forEach((u) => next.delete(u.id));
    } else {
      filtered.forEach((u) => next.add(u.id));
    }
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
      // apply locally
      setStaff((prev) =>
        prev.map((u) =>
          selected.has(u.id) ? { ...u, ...patch, role: patch.role || u.role } : u
        )
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
    <main className="min-h-screen bg-white text-black">
      <div className="pointer-events-none fixed inset-0 -z-10 grid-overlay-light opacity-[.04]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="rounded-2xl border border-black/10 bg-gradient-to-b from-black/[0.03] to-white p-4 shadow-[0_10px_30px_rgba(0,0,0,.06)]">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Users2 className="h-6 w-6" />
              Management
            </h1>
            <p className="text-xs sm:text-sm text-black/60">
              Control staffing state, roles, and review recent activity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search staff…"
              className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:border-black/60"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:border-black/60"
              title="Role"
            >
              <option>All</option>
              <option>PM</option>
              <option>Engineer</option>
              <option>Admin</option>
            </select>
            <button
              onClick={load}
              className="inline-flex items-center gap-1 rounded-xl border border-black bg-black px-3 py-2 text-sm text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </header>

        {/* Error */}
        {err && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
            {err}
          </div>
        )}

        {/* KPI cards */}
        <section className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
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
        </section>

        {/* Pipeline snapshot */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          <KpiCard title="Requests" value={fmt(proj.open)} meta="New + Assigned" />
          <KpiCard title="In Progress" value={fmt(proj.inProgress)} meta="Build + Review" />
          <KpiCard title="Completed" value={fmt(proj.completed)} meta="Done" />
        </section>

        {/* Bulk actions bar */}
        <section className="mt-6 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_10px_26px_rgba(0,0,0,.05)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              <strong>{selected.size}</strong> selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={selected.size === 0 || busyBulk}
                onClick={() => applyBulk({ isBusy: true })}
                className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm hover:border-black disabled:opacity-50"
              >
                Mark Busy
              </button>
              <button
                disabled={selected.size === 0 || busyBulk}
                onClick={() => applyBulk({ isBusy: false })}
                className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm hover:border-black disabled:opacity-50"
              >
                Mark Idle
              </button>
              <button
                disabled={selected.size === 0 || busyBulk}
                onClick={() => applyBulk({ online: true })}
                className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm hover:border-black disabled:opacity-50"
              >
                Set Online
              </button>
              <button
                disabled={selected.size === 0 || busyBulk}
                onClick={() => applyBulk({ online: false })}
                className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm hover:border-black disabled:opacity-50"
              >
                Set Offline
              </button>

              {/* Bulk role (Admin cannot grant Admin; server enforces) */}
              <div className="flex items-center gap-1">
                <span className="text-sm text-black/60">Bulk role:</span>
                <button
                  disabled={selected.size === 0 || busyBulk}
                  onClick={() => applyBulk({ role: "PM" })}
                  className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm hover:border-black disabled:opacity-50"
                >
                  PM
                </button>
                <button
                  disabled={selected.size === 0 || busyBulk}
                  onClick={() => applyBulk({ role: "Engineer" })}
                  className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm hover:border-black disabled:opacity-50"
                >
                  Engineer
                </button>
                <button
                  disabled={selected.size === 0 || busyBulk}
                  onClick={() => applyBulk({ role: "Admin" })}
                  className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm hover:border-black disabled:opacity-50"
                  title="Only SuperAdmin can grant Admin (server enforced)"
                >
                  Admin
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="mt-4 rounded-2xl border border-black/10 bg-white shadow-[0_10px_28px_rgba(0,0,0,.05)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-[1] bg-white/95 backdrop-blur">
                <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide text-black/70">
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">
                    <button
                      onClick={toggleAll}
                      className="inline-flex items-center gap-2 text-sm"
                      title="Select all on page"
                    >
                      {allSelectedOnPage ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      Select
                    </button>
                  </th>
                  <ThSort label="Name" active={false} />
                  <ThSort
                    label="Role"
                    active={sortKey === "role"}
                    dir={sortDir}
                    onClick={() => toggleSort(setSortKey, setSortDir, "role", sortKey, sortDir)}
                  />
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">Email</th>
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">Phone</th>
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">Busy</th>
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">Online</th>
                  <ThSort
                    label="Active Tasks"
                    active={sortKey === "numberOfTask"}
                    dir={sortDir}
                    onClick={() =>
                      toggleSort(setSortKey, setSortDir, "numberOfTask", sortKey, sortDir)
                    }
                  />
                  <ThSort
                    label="Last Active"
                    active={sortKey === "lastActive"}
                    dir={sortDir}
                    onClick={() =>
                      toggleSort(setSortKey, setSortDir, "lastActive", sortKey, sortDir)
                    }
                  />
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">Quick</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading rows={8} />
                ) : (
                  <>
                    {filtered.map((u) => (
                      <tr key={u.id} className="group hover:bg-black/[0.02]">
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3">
                          <button
                            onClick={() => toggleOne(u.id)}
                            className="inline-flex items-center gap-2"
                            title="Select"
                          >
                            {selected.has(u.id) ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar name={`${u.firstName} ${u.lastName}`} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="truncate text-[11px] text-black/50">ID: {u.id.slice(-8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          <span className="inline-block rounded-full border border-black/20 bg-white px-2 py-[2px] text-[11px]">
                            {u.role}
                          </span>
                        </td>
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          <span className="block max-w-[260px] truncate sm:max-w-none" title={u.email}>
                            {u.email || "—"}
                          </span>
                        </td>
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">{u.phone || "—"}</td>
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          {u.isBusy ? <Badge tone="amber">Busy</Badge> : <Badge tone="sky">Idle</Badge>}
                        </td>
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          {u.online ? <Badge tone="emerald">Online</Badge> : <Badge tone="slate">Offline</Badge>}
                        </td>
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">{u.numberOfTask ?? 0}</td>
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          {u.lastActive ? new Date(u.lastActiveISO).toLocaleString() : "—"}
                        </td>
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3">
                          {/* quick toggles */}
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => quickToggle(u, { isBusy: !u.isBusy })}
                              className="rounded-lg border border-black/20 bg-white px-2 py-1 text-xs hover:border-black"
                              title="Toggle busy"
                            >
                              {u.isBusy ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => quickToggle(u, { online: !u.online })}
                              className="rounded-lg border border-black/20 bg-white px-2 py-1 text-xs hover:border-black"
                              title="Toggle online"
                            >
                              {u.online ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length && !loading && (
                      <tr>
                        <td className="px-4 py-8 text-center text-black/50" colSpan={10}>
                          No staff match your filters.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent activity */}
        {/* <section className="mt-6 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_10px_26px_rgba(0,0,0,.05)]">
          <h3 className="mb-2 text-sm font-semibold tracking-tight">Recent Activity</h3>
          {audits.length === 0 ? (
            <div className="text-sm text-black/60">No audit entries yet.</div>
          ) : (
            <ul className="divide-y divide-black/10">
              {audits.map((a) => (
                <li key={a._id} className="py-2 text-sm">
                  <span className="font-medium">{a.action}</span>{" "}
                  <span className="text-black/60">
                    • {new Date(a.createdAt).toLocaleString()} •{" "}
                    {a.meta ? JSON.stringify(a.meta) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section> */}
      </div>
    </main>
  );
}

/* ---------- UI atoms/helpers ---------- */
function KpiCard({ icon, title, value, meta }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-white/90 p-5 sm:p-6 shadow-[0_10px_26px_rgba(0,0,0,.05)] transition-transform hover:-translate-y-0.5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-black/[0.03] to-white opacity-70 blur-2xl transition-all group-hover:scale-110" />
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-white">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] sm:text-xs uppercase tracking-wide text-black/60">{title}</div>
          <div className="text-xl sm:text-2xl font-extrabold">{value}</div>
          {meta && <div className="text-[11px] text-black/50">{meta}</div>}
        </div>
      </div>
    </div>
  );
}
function Badge({ children, tone = "slate" }) {
  const toneMap = {
    emerald: "text-emerald-800 bg-emerald-50 border-emerald-200",
    amber: "text-amber-800 bg-amber-50 border-amber-200",
    sky: "text-sky-800 bg-sky-50 border-sky-200",
    slate: "text-slate-700 bg-slate-50 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] ${toneMap[tone]}`}>
      {children}
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
    <div className="grid h-8 w-8 place-items-center rounded-full border border-black/20 bg-white text-[11px] font-bold">
      {initials || "?"}
    </div>
  );
}
function ThSort({ label, active, dir, onClick }) {
  return (
    <th
      scope="col"
      className="border-b border-black/20 px-3 sm:px-4 py-3 cursor-pointer select-none"
      onClick={onClick}
      title={`Sort by ${label}`}
    >
      <span className={`inline-flex items-center gap-1 ${active ? "font-semibold" : ""}`}>
        {label}
        {active ? (dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : null}
      </span>
    </th>
  );
}
function TableLoading({ rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td className="border-b border-black/10 px-3 sm:px-4 py-3" colSpan={10}>
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-black/40" />
              <div className="h-3 w-2/3 rounded bg-black/10" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
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
