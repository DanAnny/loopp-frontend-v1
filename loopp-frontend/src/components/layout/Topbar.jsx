import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, MessageSquare, Search, ChevronDown, User, Settings, LogOut, Menu, CheckCheck,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import ConfirmSignOutModal from "@/components/auth/ConfirmSignOutModal";
import { logoutThunk } from "@/features/auth/authSlice";
import { connectSocket } from "@/lib/socket";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/services/notifications.service";

/* -------------------- helper: compute total unread messages -------------------- */
function totalChatUnread(userId) {
  let sum = 0;
  try {
    const staffRaw = userId ? localStorage.getItem(`CHAT_UNREAD:${userId}`) : null;
    if (staffRaw) {
      const m = JSON.parse(staffRaw);
      for (const k of Object.keys(m || {})) sum += Number(m[k]?.count || 0);
    }
  } catch {}
  try {
    const clientRaw = localStorage.getItem("CHAT_UNREAD:CLIENT");
    if (clientRaw) {
      const m = JSON.parse(clientRaw);
      for (const k of Object.keys(m || {})) sum += Number(m[k]?.count || 0);
    }
  } catch {}
  return sum;
}

export default function Topbar({ sidebarOpen, setSidebarOpen }) {
  const user = useSelector((s) => s.auth.user);
  const userId = user?._id || user?.id;
  const role = (user?.role || user?.accountType || "").toString();
  const normRole = role.toLowerCase();
  const isSuperAdmin = normRole === "superadmin";
  const isEngineer = normRole === "engineer";
  const isPM = normRole === "pm" || normRole === "project manager" || normRole === "project_manager" || normRole === "projectmanager";
  const isAdmin = normRole === "admin";

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSignout, setShowSignout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  const first = user?.firstName || user?.first_name || "";
  const last  = user?.lastName  || user?.last_name  || "";
  const name = [first, last].filter(Boolean).join(" ") || "User";
  const initials = `${(first[0] || "").toUpperCase()}${(last[0] || "").toUpperCase()}` || "U";

  /* Close popovers on outside click */
  useEffect(() => {
    function handleClickOutside(e) {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) setNotificationOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Socket: message badge ping for /chat icon — recompute from storage */
  useEffect(() => {
    if (!userId) return;
    const s = connectSocket(userId);
    if (!s) return;
    const recalc = () => setUnreadMsgs(totalChatUnread(userId));
    s.on("notify:message", recalc);
    recalc();
    return () => s.off("notify:message", recalc);
  }, [userId]);

  /* Listen to cross-tab + in-app unread updates */
  useEffect(() => {
    if (!userId) return;
    const recalc = () => setUnreadMsgs(totalChatUnread(userId));
    window.addEventListener("chat-unread-update", recalc);
    window.addEventListener("storage", recalc);
    recalc();
    return () => {
      window.removeEventListener("chat-unread-update", recalc);
      window.removeEventListener("storage", recalc);
    };
  }, [userId]);

  /* Socket: persistent notifications stream (single source of truth) */
  useEffect(() => {
    if (!userId) return;
    const s = connectSocket(userId);

    const onNotifyEvent = (n) => {
      setItems((prev) => {
        const id = n._id || n.id;
        if (id && prev.some((x) => (x._id || x.id) === id)) return prev; // de-dupe
        return [{ ...n }, ...prev].slice(0, 50);
      });
      if (!n.readAt) setUnreadCount((c) => c + 1);
    };

    s.on("notify:event", onNotifyEvent);
    return () => s.off("notify:event", onNotifyEvent);
  }, [userId]);

  /* INIT unread count on mount (notifications) */
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const data = await fetchNotifications({ limit: 50 });
        const list = Array.isArray(data?.notifications) ? data.notifications : [];
        setUnreadCount(list.filter((n) => !n.readAt).length);
      } catch {
        // ignore
      }
    })();
  }, [userId]);

  /* Load list the first time dropdown opens */
  useEffect(() => {
    if (!notificationOpen || !userId) return;
    if (items.length > 0) return;

    (async () => {
      try {
        setLoadingNotifs(true);
        const data = await fetchNotifications({ limit: 20 });
        const list = Array.isArray(data?.notifications) ? data.notifications : [];
        setItems((prev) => {
          const seen = new Set(prev.map((x) => x._id || x.id));
          const merged = [...prev];
          for (const n of list) if (!seen.has(n._id || n.id)) merged.push(n);
          return merged;
        });
        setNextCursor(data?.nextCursor || null);
      } finally {
        setLoadingNotifs(false);
      }
    })();
  }, [notificationOpen, userId, items.length]);

  const loadMore = async () => {
    if (!nextCursor) return;
    try {
      setLoadingNotifs(true);
      const data = await fetchNotifications({ limit: 20, cursor: nextCursor });
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x._id || x.id));
        const merged = [...prev];
        for (const n of list) if (!seen.has(n._id || n.id)) merged.push(n);
        return merged;
      });
      setNextCursor(data?.nextCursor || null);
    } finally {
      setLoadingNotifs(false);
    }
  };

  /* ✅ HARD LOGOUT: emit socket + call API (with cookies) */
  const onSignOut = async () => {
    setSigningOut(true);
    try {
      const s = connectSocket(userId);
      s?.emit("auth:logout");           // immediate presence update on server
      await new Promise((r) => setTimeout(r, 150)); // tiny grace to flush frame

      await dispatch(logoutThunk()).unwrap?.();
      navigate("/signin", { replace: true });
    } finally {
      setSigningOut(false);
      setShowSignout(false);
    }
  };

  // everyone sees bell
  const hideNotifications = false;

  const topbarSurface =
    isSuperAdmin
      ? "bg-[#0B0B0E]/80 backdrop-blur border-white/10"
      : "bg-white/95 backdrop-blur border-black/10 shadow-sm";

  /** Role-based navigation for a notification */
  function navigateForNotification(n) {
    if (isSuperAdmin) return; // SA never routes — they just read
    if (n?.link) return navigate(n.link);
    const t = (n?.type || "").toUpperCase();
    if (isEngineer) return navigate("/tasks");
    if (isPM || isAdmin) return navigate("/chat");
    return navigate("/chat");
  }

  const onClickItem = async (n) => {
    try {
      if (!n.readAt && n._id) {
        await markNotificationRead(n._id);
        setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {}
    navigateForNotification(n);
    if (!isSuperAdmin) setNotificationOpen(false);
  };

  const onMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {}
  };

  const bellShouldWiggle = unreadCount > 0 && !notificationOpen;

  return (
    <header className={`fixed top-0 right-0 left-0 h-16 z-30 border-b ${topbarSurface}`}>
      <div className="h-full flex items-center justify-between px-4 md:px-6 gap-4">
        {/* Left cluster */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg transition-colors ${
              isSuperAdmin ? "hover:bg-white/10 text-white" : "hover:bg-black/5 text-black"
            }`}
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {!sidebarOpen && (
            <div className="hidden md:flex flex-1 justify-start">
              <div
                className={[
                  "group relative flex items-center gap-2",
                  "w-[200px] max-w-sm ml-4",
                  "rounded-full border px-3 py-1.5",
                  isSuperAdmin
                    ? "border-white/15 bg-white/5 backdrop-blur focus-within:border-white/30"
                    : "border-black/10 bg-white focus-within:border-black/40",
                  "transition-colors",
                ].join(" ")}
              >
                <Search className={`w-4 h-4 flex-shrink-0 ${isSuperAdmin ? "text-white/70" : "text-black/50"}`} />
                <input
                  type="text"
                  placeholder="Search…"
                  className={[
                    "w-full bg-transparent outline-none text-sm",
                    isSuperAdmin ? "placeholder:text-white/50 text-white" : "placeholder:text-black/40 text-black",
                  ].join(" ")}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2 md:gap-3">
          {!hideNotifications && (
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className={`relative p-2 rounded-lg transition-colors ${
                  isSuperAdmin ? "hover:bg-white/10 text-white" : "hover:bg-black/5 text-black"
                }`}
                aria-label="Notifications"
              >
                <motion.span
                  animate={bellShouldWiggle ? { rotate: [0, -12, 12, -8, 8, 0] } : { rotate: 0 }}
                  transition={bellShouldWiggle ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.2 }}
                  className="inline-flex"
                >
                  <Bell className="w-5 h-5" />
                </motion.span>
                {unreadCount > 0 && (
                  <span
                    className={[
                      "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1",
                      "rounded-full bg-red-600 text-white",
                      "text-[10px] leading-[18px] text-center font-semibold",
                      "shadow ring-1 ring-white/80",
                    ].join(" ")}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className={`absolute right-0 mt-2 w-96 overflow-hidden rounded-xl border shadow-lg ${
                      isSuperAdmin ? "bg-[#0F1115]/95 border-white/10 text-white" : "bg-white border-black/10 text-black"
                    }`}
                  >
                    <div
                      className={`px-4 py-3 flex items-center justify-between border-b ${
                        isSuperAdmin ? "border-white/10" : "border-black/10"
                      }`}
                    >
                      <h3 className="text-sm font-semibold">Notifications</h3>
                      <button
                        onClick={onMarkAll}
                        className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded-md ${
                          isSuperAdmin ? "hover:bg-white/10" : "hover:bg-black/5"
                        }`}
                        title="Mark all as read"
                      >
                        <CheckCheck className="w-4 h-4" /> Mark all
                      </button>
                    </div>

                    <div className="max-h-[24rem] overflow-y-auto">
                      {items.length === 0 && !loadingNotifs && (
                        <div className={isSuperAdmin ? "p-4 text-white/70" : "p-4 text-black/60"}>No notifications</div>
                      )}

                      {items.map((n) => (
                        <button
                          key={n._id || n.id}
                          onClick={() => onClickItem(n)}
                          className={[
                            "w-full text-left px-4 py-3 grid gap-1 border-b",
                            isSuperAdmin ? "border-white/10" : "border-black/10",
                            !n.readAt ? (isSuperAdmin ? "bg-white/5" : "bg-black/[0.03]") : "",
                            "hover:opacity-90",
                          ].join(" ")}
                        >
                          <div className="text-sm font-medium flex items-center gap-2">
                            {!n.readAt && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full" />}
                            {n.title || "Notification"}
                          </div>
                          {n.body && <div className="text-xs opacity-70">{n.body}</div>}
                          <div className="text-[11px] opacity-50">
                            {new Date(n.createdAt || Date.now()).toLocaleString()}
                          </div>
                        </button>
                      ))}

                      {nextCursor && (
                        <div className="p-2">
                          <button
                            onClick={loadMore}
                            className={`w-full text-sm px-3 py-2 rounded-lg ${
                              isSuperAdmin ? "bg-white/10 hover:bg-white/15" : "bg-black/5 hover:bg-black/10"
                            }`}
                            disabled={loadingNotifs}
                          >
                            {loadingNotifs ? "Loading…" : "Load more"}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="relative">
            <Link
              to="/chat"
              className={`relative p-2 rounded-lg transition-colors ${
                isSuperAdmin ? "hover:bg-white/10 text-white" : "hover:bg-black/5 text-black"
              }`}
              aria-label="Messages"
              onClick={() => setUnreadMsgs(totalChatUnread(userId))}
            >
              <MessageSquare className="w-5 h-5" />
              {unreadMsgs > 0 && (
                <span
                  className={[
                    "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1",
                    "rounded-full bg-red-600 text-white",
                    "text-[10px] leading-[18px] text-center font-semibold",
                    "shadow ring-1 ring-white/80",
                  ].join(" ")}
                >
                  {unreadMsgs > 99 ? "99+" : unreadMsgs}
                </span>
              )}
            </Link>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={`flex items-center gap-2 md:gap-3 p-2 rounded-lg transition-colors ${
                isSuperAdmin ? "hover:bg-white/10" : "hover:bg-black/5"
              }`}
              aria-label="User profile"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  isSuperAdmin ? "bg-white/10 text-white border border-white/15" : "bg-black text-white"
                } md:hidden`}
              >
                {initials}
              </div>

              <div className="hidden md:flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                    isSuperAdmin ? "bg-white/10 text-white border border-white/15" : "bg-black text-white"
                  }`}
                >
                  {initials}
                </div>
                <div className="hidden lg:block text-left">
                  <p className={isSuperAdmin ? "text-white leading-tight" : "text-black leading-tight"}>{name}</p>
                  <p className={isSuperAdmin ? "text-white/70 leading-tight" : "text-black/60 leading-tight"}>{role}</p>
                </div>
                <ChevronDown className={`w-4 h-4 hidden lg:block ${isSuperAdmin ? "text-white" : "text-black"}`} />
              </div>
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className={`absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border shadow-lg ${
                    isSuperAdmin ? "bg-[#0F1115]/95 border-white/10 text-white" : "bg-white border-black/10 text-black"
                  }`}
                >
                  <div className={`p-4 border-b ${isSuperAdmin ? "border-white/10" : "border-black/10"}`}>
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold ${
                          isSuperAdmin ? "bg-white/10 text-white border border-white/15" : "bg-black text-white"
                        }`}
                      >
                        {initials}
                      </div>
                      <div>
                        <p className={isSuperAdmin ? "text-white" : "text-black"}>{name}</p>
                        <p className={isSuperAdmin ? "text-white/70" : "text-black/60"}>{role}</p>
                      </div>
                    </div>
                  </div>

                  <div className="py-2">
                    <Link
                      to="/profile"
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                        isSuperAdmin ? "hover:bg-white/10 text-white" : "hover:bg-black/5 text-black"
                      }`}
                      onClick={() => setProfileOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      <span>My Profile</span>
                    </Link>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                          isSuperAdmin ? "hover:bg-white/10 text-white/90" : "hover:bg-black/5 text-black"
                        }`}
                        onClick={() => setProfileOpen(false)}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Settings (coming soon)</span>
                      </button>
                    )}
                  </div>

                  <div className={isSuperAdmin ? "border-t border-white/10" : "border-t border-black/10"}>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setShowSignout(true);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                        isSuperAdmin ? "hover:bg-rose-500/10 text-rose-300" : "hover:bg-rose-50 text-rose-600"
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ConfirmSignOutModal
        open={showSignout}
        onCancel={() => setShowSignout(false)}
        onConfirm={onSignOut}
        loading={signingOut}
      />
    </header>
  );
}
