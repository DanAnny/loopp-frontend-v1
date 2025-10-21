import React, { useEffect, useMemo, useState } from "react";
import userService from "@/services/users.service"; // default export holding all funcs
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Users,
  Loader2,
  Download,
  UserPlus,
} from "lucide-react";

/**
 * Staff Directory
 * - Uses userService.getAll() and filters client-side by role/busy/online/search.
 * - White background, sticky header, crisp table.
 */
export default function StaffDirectory() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [staff, setStaff] = useState([]);

  // UI state
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("All"); // All | PM | Engineer | Admin
  const [busy, setBusy] = useState("All"); // All | Busy | Idle
  const [online, setOnline] = useState("All"); // All | Online | Offline

  const [sortKey, setSortKey] = useState("lastName"); // lastName | role | numberOfTask | lastActive
  const [sortDir, setSortDir] = useState("desc"); // asc | desc
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const { data } = await userService.getAll();
        // Expecting data.users or data; normalize:
        const list = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
        if (!live) return;
        setStaff(list.map(mapUser));
      } catch (e) {
        if (!live) return;
        setErr(e?.response?.data?.message || e?.message || "Failed to load staff");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // derived & filtering
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((u) => {
        if (role !== "All" && u.role !== role) return false;
        if (busy !== "All") {
          if (busy === "Busy" && !u.isBusy) return false;
          if (busy === "Idle" && u.isBusy) return false;
        }
        if (online !== "All") {
          if (online === "Online" && !u.online) return false;
          if (online === "Offline" && u.online) return false;
        }
        if (!q) return true;
        const hay =
          `${u.firstName} ${u.lastName} ${u.email} ${u.phone} ${u.role}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "numberOfTask") {
          return (a.numberOfTask - b.numberOfTask) * dir;
        }
        if (sortKey === "role") {
          return a.role.localeCompare(b.role) * dir;
        }
        if (sortKey === "lastActive") {
          // latest lastActive first (desc) by default
          return (new Date(a.lastActiveISO) - new Date(b.lastActiveISO)) * dir;
        }
        // default lastName, fallback to firstName
        const A = (a.lastName || a.firstName || "").toLowerCase();
        const B = (b.lastName || b.firstName || "").toLowerCase();
        return A.localeCompare(B) * dir;
      });
  }, [staff, role, busy, online, query, sortKey, sortDir]);

  // pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageSafe = Math.min(page, pageCount);
  const from = (pageSafe - 1) * rowsPerPage;
  const to = from + rowsPerPage;
  const pageRows = filtered.slice(from, to);

  // handlers
  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const exportCSV = () => {
    const headers = [
      "First Name",
      "Last Name",
      "Role",
      "Email",
      "Phone",
      "Busy",
      "Online",
      "Active Tasks",
      "Last Active",
    ];
    const rows = filtered.map((u) => [
      safe(u.firstName),
      safe(u.lastName),
      safe(u.role),
      safe(u.email),
      safe(u.phone),
      u.isBusy ? "Yes" : "No",
      u.online ? "Yes" : "No",
      String(u.numberOfTask ?? 0),
      u.lastActive ? new Date(u.lastActiveISO).toLocaleString() : "—",
    ]);
    const csv =
      headers.join(",") +
      "\n" +
      rows.map((r) => r.map(csvEscape).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="pointer-events-none fixed inset-0 -z-10 grid-overlay-light opacity-[.04]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="rounded-2xl border border-black/10 bg-gradient-to-b from-black/[0.03] to-white p-4 shadow-[0_10px_30px_rgba(0,0,0,.06)]">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6" />
              Staff Directory
            </h1>
            <p className="text-xs sm:text-sm text-black/60">
              View & filter all staff across roles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/staffs/new"
              className="inline-flex items-center gap-1 rounded-xl border border-black bg-black px-3 py-2 text-sm text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <UserPlus className="h-4 w-4" /> Add Staff
            </Link>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1 rounded-xl border border-black/60 bg-white px-3 py-2 text-sm transition-colors hover:border-black"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </header>

        {/* Error */}
        {err && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
            {err}
          </div>
        )}

        {/* Controls */}
        <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, phone…"
              className="w-full rounded-xl border border-black/20 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-black/60"
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              className="w-full appearance-none rounded-xl border border-black/20 bg-white pl-9 pr-8 py-2.5 text-sm outline-none focus:border-black/60"
              title="Role"
            >
              <option>All</option>
              <option>PM</option>
              <option>Engineer</option>
              <option>Admin</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
            <select
              value={busy}
              onChange={(e) => {
                setBusy(e.target.value);
                setPage(1);
              }}
              className="w-full appearance-none rounded-xl border border-black/20 bg-white pl-9 pr-8 py-2.5 text-sm outline-none focus:border-black/60"
              title="Busy Status"
            >
              <option>All</option>
              <option>Busy</option>
              <option>Idle</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
            <select
              value={online}
              onChange={(e) => {
                setOnline(e.target.value);
                setPage(1);
              }}
              className="w-full appearance-none rounded-xl border border-black/20 bg-white pl-9 pr-8 py-2.5 text-sm outline-none focus:border-black/60"
              title="Online Status"
            >
              <option>All</option>
              <option>Online</option>
              <option>Offline</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl border border-black/10 bg-white shadow-[0_10px_28px_rgba(0,0,0,.05)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-[1] bg-white/95 backdrop-blur">
                <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide text-black/70">
                  <ThSort
                    label="Name"
                    active={sortKey === "lastName"}
                    dir={sortDir}
                    onClick={() => toggleSort("lastName")}
                  />
                  <ThSort
                    label="Role"
                    active={sortKey === "role"}
                    dir={sortDir}
                    onClick={() => toggleSort("role")}
                  />
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">Email</th>
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">Phone</th>
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">Busy</th>
                  <th className="border-b border-black/20 px-3 sm:px-4 py-3">Online</th>
                  <ThSort
                    label="Active Tasks"
                    active={sortKey === "numberOfTask"}
                    dir={sortDir}
                    onClick={() => toggleSort("numberOfTask")}
                  />
                  <ThSort
                    label="Last Active"
                    active={sortKey === "lastActive"}
                    dir={sortDir}
                    onClick={() => toggleSort("lastActive")}
                  />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoading rows={8} />
                ) : (
                  <>
                    {pageRows.map((u) => (
                      <tr key={u.id} className="group hover:bg-black/[0.02]">
                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar name={`${u.firstName} ${u.lastName}`} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="truncate text-[11px] text-black/50">
                                ID: {u.id.slice(-8)}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          <span className="inline-block rounded-full border border-black/20 bg-white px-2 py-[2px] text-[11px]">
                            {u.role}
                          </span>
                        </td>

                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          <span className="block max-w-[240px] truncate sm:max-w-none" title={u.email}>
                            {u.email || "—"}
                          </span>
                        </td>

                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          {u.phone || "—"}
                        </td>

                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          {u.isBusy ? (
                            <Badge tone="amber">Busy</Badge>
                          ) : (
                            <Badge tone="sky">Idle</Badge>
                          )}
                        </td>

                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          {u.online ? (
                            <Badge tone="emerald">Online</Badge>
                          ) : (
                            <Badge tone="slate">Offline</Badge>
                          )}
                        </td>

                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          {u.numberOfTask ?? 0}
                        </td>

                        <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                          {u.lastActive ? new Date(u.lastActiveISO).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}

                    {!pageRows.length && (
                      <tr>
                        <td className="px-4 py-10 text-center text-black/50" colSpan={8}>
                          No staff match your filters.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-black/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-black/60">
                Showing <strong>{from + 1}</strong>–<strong>{Math.min(to, filtered.length)}</strong>{" "}
                of <strong>{filtered.length}</strong>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-xl border border-black/20 bg-white px-2 py-1.5 text-sm"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>

                <div className="inline-flex overflow-hidden rounded-xl border border-black/20">
                  <button
                    className="px-3 py-1.5 text-sm hover:bg-black/[0.04] disabled:opacity-50"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageSafe === 1}
                  >
                    Prev
                  </button>
                  <div className="px-3 py-1.5 text-sm">
                    {pageSafe} / {pageCount}
                  </div>
                  <button
                    className="px-3 py-1.5 text-sm hover:bg-black/[0.04] disabled:opacity-50"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={pageSafe === pageCount}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* -------------------- UI bits -------------------- */

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

function Badge({ children, tone = "slate" }) {
  const toneMap = {
    emerald: "text-emerald-800 bg-emerald-50 border-emerald-200",
    amber: "text-amber-800 bg-amber-50 border-amber-200",
    sky: "text-sky-800 bg-sky-50 border-sky-200",
    slate: "text-slate-700 bg-slate-50 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] ${toneMap[tone]}`}
    >
      {children}
    </span>
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
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : null}
      </span>
    </th>
  );
}

function TableLoading({ rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td className="border-b border-black/10 px-3 sm:px-4 py-3" colSpan={8}>
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

/* -------------------- helpers -------------------- */
function safe(v) {
  return v == null ? "" : String(v);
}
function csvEscape(s) {
  const needs = /[",\n]/.test(s);
  return needs ? `"${s.replace(/"/g, '""')}"` : s;
}
