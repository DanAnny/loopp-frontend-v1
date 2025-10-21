// frontend/src/components/layout/Shell.jsx
import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/**
 * Shell layout
 * - SuperAdmin => dark gradient + glow
 * - Others     => light splash background
 */
export default function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarWidth = useMemo(() => (sidebarOpen ? 280 : 80), [sidebarOpen]);

  const user = useSelector((s) => s.auth.user);
  const role = (user?.role || user?.accountType || "").toString().toLowerCase();
  const isSuperAdmin = role === "superadmin";

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isSuperAdmin ? "text-white" : "text-gray-900"}`}>
      {/* Topbar + Sidebar */}
      <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Background layers */}
      {isSuperAdmin ? (
        <>
          {/* Dark gradient with glow */}
          <div className="fixed inset-0 -z-20 bg-gradient-to-b from-[#0B0B0E] via-[#0D0D12] to-[#0B0B0E]" />
          <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-20%,rgba(93,95,239,.15),transparent),radial-gradient(1000px_600px_at_90%_0%,rgba(236,72,153,.12),transparent)]" />
          {/* grid overlay (no file) */}
          <div className="pointer-events-none fixed inset-0 -z-10 grid-overlay-dark opacity-[.08]" />
        </>
      ) : (
        <>
          {/* Light splashy gradient */}
          <div className="fixed inset-0 -z-20 bg-gradient-to-br from-[#f9fafb] via-[#f3f4f6] to-[#e5e7eb]" />
          {/* Accent radial splash */}
          <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(800px_500px_at_5%_10%,rgba(59,130,246,.15),transparent),radial-gradient(700px_500px_at_95%_90%,rgba(236,72,153,.15),transparent)]" />
          {/* grid overlay (no file) */}
          <div className="pointer-events-none fixed inset-0 -z-10 grid-overlay-light opacity-[.06]" />
        </>
      )}

      {/* Main content area */}
      <div
        className="pt-16 transition-[padding] duration-300 ease-out"
        style={{ paddingLeft: `${sidebarWidth}px` }}
      >
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
