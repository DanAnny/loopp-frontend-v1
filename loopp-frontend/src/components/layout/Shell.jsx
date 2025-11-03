import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/**
 * Shell layout with consistent dark navy background
 * - Matches all dashboard pages (#0f1729)
 * - Modern, minimal design with subtle animations
 * - Performance optimized without glass effects
 * - Responsive sidebar and topbar
 */
export default function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarWidth = useMemo(() => (sidebarOpen ? 280 : 80), [sidebarOpen]);

  const user = useSelector((s) => s.auth.user);
  const role = (user?.role || user?.accountType || "").toString().toLowerCase();

  return (
    <div className="min-h-screen text-white bg-[#0f1729]">
      {/* Topbar + Sidebar */}
      <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Background - Consistent dark navy for all roles */}
      <div className="fixed inset-0 -z-20 bg-[#0f1729]" />
      
      {/* Subtle animated orbs for visual interest */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-24 -left-24 w-[800px] h-[800px] bg-gradient-to-br from-purple-600/10 via-purple-500/5 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-24 -right-24 w-[700px] h-[700px] bg-gradient-to-tl from-pink-600/8 via-pink-500/4 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -30, 0],
            y: [0, -50, 0],
            opacity: [0.08, 0.15, 0.08],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
      </div>

      {/* Main content area */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="pt-16 transition-[padding] duration-300 ease-out"
        style={{ paddingLeft: `${sidebarWidth}px` }}
      >
        <main className="p-6">
          <Outlet />
        </main>
      </motion.div>
    </div>
  );
}
