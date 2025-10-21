// src/pages/AdminHomePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dashboard from "@/services/dashboard.service";
import userService from "@/services/users.service";
import {
  Users2, ClipboardList, CheckCircle2, Wrench, RefreshCw, Loader2,
} from "lucide-react";

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);
  const [staff, setStaff] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const [{ data: d }, { data: u }] = await Promise.all([
        dashboard.overview(range),   // <-- returns { success, data }
        userService.getAll(),        // users list
      ]);
      // d is axios.data -> { success, data }
      setData(d?.data ?? null);
      const list = Array.isArray(u?.users) ? u.users : Array.isArray(u) ? u : [];
      setStaff(list);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  const totals = data?.totals || {};
  const staffRatings = data?.staff?.ratings || [];

  // Compute a simple “best project (range)” proxy from staff ratings
  // (If you later add bestProject to the API, swap to that.)
  const bestRating = staffRatings.length
    ? [...staffRatings].sort((a,b)=> (b.avg - a.avg) || (b.count - a.count))[0]
    : null;

  const staffCounts = useMemo(() => {
    const pms = staff.filter((s) => (s.role || "").toString() === "PM").length;
    const eng = staff.filter((s) => (s.role || "").toString() === "Engineer").length;
    const admins = staff.filter((s) => (s.role || "").toString() === "Admin").length;
    return { total: staff.length, pms, eng, admins };
  }, [staff]);

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="pointer-events-none fixed inset-0 -z-10 grid-overlay-light opacity-[.04]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <header className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="rounded-2xl border border-black/10 bg-gradient-to-b from-black/[0.03] to-white p-4 shadow-[0_10px_30px_rgba(0,0,0,.06)]">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Wrench className="h-6 w-6" /> Admin Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-black/60">
              Requests • Staffing • Day-to-day operations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-black/60">Range</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:border-black/60"
            >
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
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

        {/* KPI row (use keys that actually exist) */}
        <section className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                icon={<ClipboardList className="h-4 w-4" />}
                label="Total Project Requests"
                value={fmt(totals?.totalRequests)}
                hint="All time"
              />
              <StatCard
                icon={<ClipboardList className="h-4 w-4" />}
                label="Assigned (Range)"
                value={fmt(totals?.assignedThisRange)}
                hint="Engineer assigned"
              />
              <StatCard
                icon={<ClipboardList className="h-4 w-4" />}
                label="Accepted by Engineers"
                value={fmt(totals?.acceptedThisRange)}
                hint="Moved to In-Progress"
              />
              <StatCard
                icon={<ClipboardList className="h-4 w-4" />}
                label="Completed (Range)"
                value={fmt(totals?.completedThisRange)}
                hint="Marked Complete"
              />
            </>
          )}
        </section>

        {/* Activity / staffing */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                icon={<Users2 className="h-4 w-4" />}
                label="Staff (Total)"
                value={fmt(staffCounts.total)}
                hint={`${fmt(staffCounts.pms)} PM • ${fmt(staffCounts.eng)} Eng • ${fmt(staffCounts.admins)} Admin`}
              />
              <StatCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Active PMs"
                value={fmt(totals?.activePMs)}
                hint={`${fmt(totals?.idlePMs)} idle`}
              />
              <StatCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Active Engineers"
                value={fmt(totals?.activeEngineers)}
                hint={`${fmt(totals?.idleEngineers)} idle`}
              />
            </>
          )}
        </section>

        {/* Spotlight */}
        {!loading && (
          <section className="mt-6 rounded-2xl border border-black/10 bg-white/90 p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,.06)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Spotlight</h3>
              <div className="flex gap-2">
                <Link
                  to="/management"
                  className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm hover:border-black"
                >
                  Manage Staff
                </Link>
                <Link
                  to="/admin/analytics"
                  className="rounded-xl border border-black bg-black px-3 py-2 text-sm text-white hover:-translate-y-0.5 hover:shadow-md"
                >
                  View Analytics
                </Link>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <InfoTile
                title="Best Performer (Range)"
                value={bestRating ? `★ ${Number(bestRating.avg).toFixed(2)}` : "—"}
                desc={
                  bestRating
                    ? `${bestRating.name} • ${bestRating.role} • ${bestRating.count} rating(s)`
                    : "No ratings in this range"
                }
              />
              <InfoTile
                title="Staff Mix"
                value={`${fmt(staffCounts.pms)} PM / ${fmt(staffCounts.eng)} Eng / ${fmt(staffCounts.admins)} Admin`}
                desc="Based on current directory"
              />
            </div>
          </section>
        )}

        {/* Recent staff (compact) */}
        <section className="mt-6 rounded-2xl border border-black/10 bg-white/90 p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,.06)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">Recent Staff</h3>
            <Link to="/staff" className="text-xs underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] sm:text-xs uppercase tracking-wide text-black/70">
                  <th className="border-b border-black/20 px-3 sm:px-4 py-2 sm:py-3">Name</th>
                  <th className="border-b border-black/20 px-3 sm:px-4 py-2 sm:py-3">Role</th>
                  <th className="border-b border-black/20 px-3 sm:px-4 py-2 sm:py-3">Email</th>
                  <th className="border-b border-black/20 px-3 sm:px-4 py-2 sm:py-3">Phone</th>
                </tr>
              </thead>
              <tbody>
                {(staff || []).slice(0, 6).map((s) => (
                  <tr key={s._id} className="group">
                    <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar name={`${s.firstName || s.first_name || ""} ${s.lastName || s.last_name || ""}`} />
                        <span className="truncate">
                          {(s.firstName || s.first_name || "")} {(s.lastName || s.last_name || "")}
                        </span>
                      </div>
                    </td>
                    <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                      <span className="inline-block rounded-full border border-black/20 bg-white px-2 py-[1px] text-[11px]">
                        {s.role}
                      </span>
                    </td>
                    <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">
                      <span className="block max-w-[260px] truncate sm:max-w-none" title={s.email}>
                        {s.email || "—"}
                      </span>
                    </td>
                    <td className="border-b border-black/10 px-3 sm:px-4 py-3 text-sm">{s.phone || "—"}</td>
                  </tr>
                ))}
                {!staff?.length && !loading && (
                  <tr><td className="px-4 py-6 text-sm text-black/60" colSpan={4}>No staff yet.</td></tr>
                )}
                {loading && (
                  <tr><td className="px-4 py-6 text-sm text-black/60" colSpan={4}>
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2"/> Loading…
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------- UI atoms ---------- */
function StatCard({ icon, label, value, hint }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-white/90 p-5 sm:p-6 shadow-[0_10px_26px_rgba(0,0,0,.05)] transition-transform hover:-translate-y-0.5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-black/[0.03] to-white opacity-70 blur-2xl transition-all group-hover:scale-110" />
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs uppercase tracking-wide text-black/60">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 bg-white">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <p className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-[11px] text-black/50">{hint}</p>}
      </div>
    </div>
  );
}
function InfoTile({ title, value, desc }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-black/60">{title}</div>
      <div className="mt-1 text-xl font-extrabold">{value}</div>
      <div className="mt-1 text-[12px] text-black/60">{desc}</div>
    </div>
  );
}
function Avatar({ name = "" }) {
  const initials = name.trim().split(/\s+/).map((n) => n[0]).filter(Boolean).slice(0,2).join("").toUpperCase();
  return (
    <div className="grid h-7 w-7 place-items-center rounded-full border border-black/20 bg-white text-[11px] font-semibold">
      {initials || "?"}
    </div>
  );
}
function SkeletonCard() {
  return <div className="h-24 sm:h-28 animate-pulse rounded-2xl border border-black/10 bg-gradient-to-b from-black/[0.04] to-white" />;
}
function fmt(v) {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}
