import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import { connectSocket, getSocket, joinRoom } from "@/lib/socket";
import chatApi from "@/services/chat.service";
import projects from "@/services/projects.service";
import invoices from "@/services/invoice.service";

import ConversationList from "../components/ConversationList";
import ChatHeader from "../components/ChatHeader";
import ChatInput from "../components/ChatInput";
import MessageBubble from "../components/MessageBubble";

import SearchBar from "@/features/chat/components/SearchBar";
import InlineNotification from "@/features/chat/components/InlineNotification";
import ChatBackground from "@/features/chat/components/ChatBackground";
import UnreadMessagesIndicator from "@/features/chat/components/UnreadMessagesIndicator";
import InvoiceModal from "../components/InvoiceModal";

// within ~Room.jsx

// consider two times "close" if within N ms
const closeInTime = (aISO, bISO, ms = 10000) => {
  const a = new Date(aISO || Date.now()).getTime();
  const b = new Date(bISO || Date.now()).getTime();
  return Math.abs(a - b) <= ms;
};

// try to reconcile an echoed message that has no clientNonce with a recent optimistic one
function reconcileMineWithoutNonce(prev, shaped) {
  if (!shaped.isMine) return prev;

  // Find the most recent optimistic "pending/sent" mine with same content
  // and a close timestamp window — replace it instead of appending.
  const idx = [...prev]
    .reverse()
    .findIndex((m) =>
      m.isMine &&
      (m.status === "pending" || m.status === "sent") &&
      (m.content || "").trim() === (shaped.content || "").trim() &&
      closeInTime(m.createdAtISO, shaped.createdAtISO, 15000) // 15s window
    );

  if (idx === -1) return prev;

  const realIdx = prev.length - 1 - idx;
  const next = prev.slice();
  next[realIdx] = {
    ...prev[realIdx],
    _id: shaped._id,
    status: "delivered",
    deliveredAt: shaped.deliveredAt || new Date().toISOString(),
    createdAtISO: shaped.createdAtISO || prev[realIdx].createdAtISO,
    timestamp: shaped.timestamp || prev[realIdx].timestamp,
  };
  return next;
}

/* ------------------------------ unread helpers ------------------------------ */
const UNREAD_KEY = (userId) => `CHAT_UNREAD:${userId}`;
function getUnreadMap(userId) {
  try {
    const raw = localStorage.getItem(UNREAD_KEY(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function setUnreadMap(userId, map) {
  try {
    localStorage.setItem(UNREAD_KEY(userId), JSON.stringify(map || {}));
    window.dispatchEvent(new Event("chat-unread-update"));
  } catch {}
}
function unreadCountFor(userId, roomId) {
  const m = getUnreadMap(userId);
  return Math.max(0, Number(m?.[roomId]?.count || 0));
}
function incUnread(userId, roomId) {
  const m = getUnreadMap(userId);
  const cur = m[roomId]?.count || 0;
  m[roomId] = { count: cur + 1, lastReadAt: m[roomId]?.lastReadAt || null };
  setUnreadMap(userId, m);
}
function clearUnread(userId, roomId) {
  const m = getUnreadMap(userId);
  m[roomId] = { count: 0, lastReadAt: new Date().toISOString() };
  setUnreadMap(userId, m);
}

/* --------------------------------- helpers --------------------------------- */
const shortName = (s, m = 28) => {
  const t = (s || "").toString().trim();
  return t.length <= m ? t : t.slice(0, m - 1) + "…";
};
const norm = (r = "") => (r || "").toString();

function normalizeRole(r = "") {
  const s = String(r || "").trim();
  if (/^system$/i.test(s)) return "System";
  if (/^super\s*admin$/i.test(s)) return "SuperAdmin";
  if (/^admin$/i.test(s)) return "Admin";
  if (/^pm$|project\s*manager/i.test(s)) return "PM";
  if (/^engineer$/i.test(s)) return "Engineer";
  if (/^client$/i.test(s)) return "Client";
  return "User";
}

function roleToTheme(role, isMine) {
  if (role === "System") return "system";
  if (isMine) return "me";
  if (role === "Client") return "client";
  if (role === "PM") return "pm";
  if (role === "Engineer") return "engineer";
  if (role === "Admin") return "admin";
  if (role === "SuperAdmin") return "superadmin";
  return "user";
}
function previewText(m) {
  if (m.attachments?.length && !m.content) return `📎 ${m.attachments.length} attachment(s)`;
  return m.content || "—";
}

/* --------------------------- optimistic utilities --------------------------- */
const genClientNonce = () =>
  Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);

function normalizeIncoming(m, meId, dir = {}) {
  // NOTE: never hide client-visible system messages here unless intended
  // (Your old filter hid some System→Client; I’ll keep your logic but safer)
  if (
    String(m.senderType || "").toLowerCase() === "system" &&
    String(m.visibleTo || "All") === "Client"
  ) {
    // visible to Client => keep; if you intended to HIDE from Client UI only,
    // move that condition to the render layer where you know the viewer role.
  }

  const rawSender = m.sender || m.user || {};
  const senderId = (
    typeof rawSender === "string" ? rawSender : rawSender._id || rawSender.id || ""
  ).toString();

  const lookup = (senderId && dir[senderId]) ? dir[senderId] : {};

  const clientName  = (m.clientName || "").toString().trim();
  const clientEmail = (m.clientEmail || "").toString().trim();

  const first = (rawSender.firstName ?? lookup.firstName ?? "").toString().trim();
  const last  = (rawSender.lastName  ?? lookup.lastName  ?? "").toString().trim();

  const email = (
    rawSender.email ?? lookup.email ?? clientEmail ?? ""
  ).toString().trim();

  const full  = [first, last].filter(Boolean).join(" ");
  const explicitName = (m.senderName || "").toString().trim();
  const username = (rawSender.username || "").toString().trim();

  const rawRole =
    rawSender.role || m.senderRole || m.role || lookup.role || m.senderType || "User";
  const role = normalizeRole(rawRole);

  const emailLocal = email ? email.split("@")[0] : "";
  let senderName =
    (explicitName && explicitName.toLowerCase() !== "client" ? explicitName : "") ||
    full ||
    clientName ||
    emailLocal ||
    username ||
    (emailLocal ? emailLocal : "") ||
    role;

  const isMine = senderId && senderId === String(meId);

  const created = m.createdAt || m.createdAtISO || m.timestamp || new Date().toISOString();
  const attachments = Array.isArray(m.attachments) ? m.attachments : [];

  const shaped = {
    _id: m._id || m.id || `${Date.now()}-${Math.random()}`,
    room: (m.room && (m.room._id || m.room)) || "",
    content: m.text || m.content || "",
    timestamp: new Date(created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    createdAtISO: new Date(created).toISOString(),

    senderName,
    senderRole: role,
    senderType: (m.senderType || "").toString(),
    isMine,

    sender: {
      _id: senderId || undefined,
      firstName: first || undefined,
      lastName:  last  || undefined,
      email:     email || undefined,
      role
    },

    clientName: clientName || undefined,
    clientEmail: clientEmail || (email && role === "Client" ? email : undefined),

    attachments,

    // delivery state – server should include if available
    status: m.status || (isMine ? "delivered" : "delivered"), // default to delivered for server-fed messages
    clientNonce: m.clientNonce || null,
    deliveredAt: m.deliveredAt || null,
    readAt: m.readAt || null
  };

  shaped.bubbleTheme = roleToTheme(role, isMine);
  return shaped;
}

function msgSignature(m) {
  return [
    String(m.room || ""),
    String(m.senderRole || ""),
    String(m.isMine ? "1" : "0"),
    (m.content || "").slice(0, 200),
    (m.createdAtISO || "").slice(0, 19),
    String(Array.isArray(m.attachments) ? m.attachments.length : 0),
    String(m.clientNonce || "")
  ].join("|");
}
function safeAppend(setMessages, incoming) {
  setMessages((prev) => {
    // primary: id match
    if (prev.some((x) => x._id === incoming._id)) return prev;

    // secondary: nonce match
    if (incoming.clientNonce) {
      const nIdx = prev.findIndex((x) => x.clientNonce && x.clientNonce === incoming.clientNonce);
      if (nIdx !== -1) {
        const next = prev.slice();
        next[nIdx] = {
          ...next[nIdx],
          _id: incoming._id,
          status: incoming.status || "delivered",
          deliveredAt: incoming.deliveredAt || new Date().toISOString(),
          createdAtISO: incoming.createdAtISO || next[nIdx].createdAtISO,
          timestamp: incoming.timestamp || next[nIdx].timestamp,
        };
        return next;
      }
    }

    // tertiary: fuzzy de-dupe for "my" messages (same text, recent time window)
    const dupIdx = prev.findIndex(
      (x) =>
        x.isMine === true &&
        incoming.isMine === true &&
        (x.status === "pending" || x.status === "sent") &&
        (x.content || "").trim() === (incoming.content || "").trim() &&
        closeInTime(x.createdAtISO, incoming.createdAtISO, 15000)
    );
    if (dupIdx !== -1) {
      const next = prev.slice();
      next[dupIdx] = {
        ...next[dupIdx],
        _id: incoming._id,
        status: "delivered",
        deliveredAt: incoming.deliveredAt || new Date().toISOString(),
        createdAtISO: incoming.createdAtISO || next[dupIdx].createdAtISO,
        timestamp: incoming.timestamp || next[dupIdx].timestamp,
      };
      return next;
    }

    return [...prev, incoming];
  });
}
async function waitForSocketConnected(s, timeout = 20000) {
  return new Promise((resolve, reject) => {
    if (!s) return reject(new Error("No socket"));
    if (s.connected) return resolve(true);
    const to = setTimeout(() => {
      s.off("connect", on);
      reject(new Error("Socket connect timeout"));
    }, timeout);
    const on = () => {
      clearTimeout(to);
      s.off("connect", on);
      resolve(true);
    };
    s.on("connect", on);
  });
}

/* -------------------------- date-separator formatting -------------------------- */
const formatDateSeparator = (date) => {
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yest)) return "Yesterday";

  const diffDays = Math.floor((+today - +date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

/* ------------------------------- map to list ------------------------------- */
function mapRoom(r) {
  return {
    id: r?._id || r?.id,
    title: shortName(r?.title || "Untitled Room"),
    updatedAtISO: r?.updatedAt || r?.createdAt || new Date().toISOString(),
    lastMessage: "",
    unreadCount: 0,
    isClosed: !!r?.isClosed,
  };
}
const toConversation = (typingByRoom) => (r) => {
  const typing = !!typingByRoom[r.id] && Object.keys(typingByRoom[r.id]).length > 0;
  return {
    id: r.id,
    name: shortName(r.title),
    avatar: "",
    lastMessage: r.lastMessage || "",
    time: new Date(r.updatedAtISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    unreadCount: r.unreadCount || 0,
    isOnline: !r.isClosed,
    isPinned: false,
    typing,
  };
};

/* ======================= NEW: Friendly Fatal Error Screen ======================= */
function ErrorScreen({ kind, title, message, onRefresh, onRetry, retryLabel = "Try Again" }) {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white px-6 text-center">
      <div className="relative mb-6">
        <svg viewBox="0 0 64 64" className="w-20 h-20 text-gray-400 animate-spin-slow" style={{ animationDuration: "6s" }}>
          <g fill="currentColor">
            <path d="M27 4h10l1.2 5.4 5.1 2.1 4.3-3.5 7.1 7.1-3.5 4.3 2.1 5.1L60 27v10l-5.4 1.2-2.1 5.1 3.5 4.3-7.1 7.1-4.3-3.5-5.1 2.1L37 60H27l-1.2-5.4-5.1-2.1-4.3 3.5-7.1-7.1 3.5-4.3-2.1-5.1L4 37V27l5.4-1.2 2.1-5.1-3.5-4.3 7.1-7.1 4.3 3.5 5.1-2.1L27 4zm5 16a12 12 0 100 24 12 12 0 000-24z"/>
          </g>
        </svg>
        <svg viewBox="0 0 64 64" className="w-20 h-20 text-gray-500 absolute -bottom-4 -right-6 animate-bounce-slow" style={{ animationDuration: "2.5s" }}>
          <path fill="currentColor" d="M50 10a10 10 0 00-9.7 7.5l6.2 6.2a3 3 0 01-4.2 4.2l-6.2-6.2A10 10 0 1050 10zM21 43l-9 9a3 3 0 004.2 4.2l9-9a10.7 10.7 0 01-4.2-4.2z"/>
        </svg>
      </div>

      <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-2 max-w-xl text-sm sm:text-base text-gray-600">{message}</p>

      <div className="mt-4 text-xs text-gray-500">
        {kind === "SOCKET_TIMEOUT" && "Hint: If you’re on a slow or flaky connection, a quick refresh usually fixes it."}
        {kind === "JOIN_FAILED" && "Hint: The room may have briefly dropped. Rejoin to pick up right where you left off."}
        {kind === "GENERIC" && "Hint: You can refresh the page, or try again in a moment."}
      </div>

      <div className="mt-6 flex items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold bg-black text-white hover:bg-black/90 active:scale-[.98] transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 7V3m6 4V3M7 14h10m-9 0v2a5 5 0 0010 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {retryLabel}
          </button>
        )}
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 active:scale-[.98] transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4v6h6M20 20v-6h-6M20 8a8 8 0 10.002 8.002" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Refresh Page
        </button>
      </div>

      <div className="mt-6 inline-flex items-center gap-2 text-[11px] rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
        Connection lost • Click a button to continue
      </div>

      <style>
        {`
          .animate-spin-slow { animation: spin 6s linear infinite; }
          .animate-bounce-slow { animation: bounce 2.5s infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes bounce {
            0%,100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
        `}
      </style>
    </div>
  );
}

/* ===================================== Room ===================================== */
export default function Room() {
  const user = useSelector((s) => s.auth.user);
  const [memberDir, setMemberDir] = useState({});
  const userId = user?._id || user?.id;
  const userRole = normalizeRole((user?.role || "User").toString());
  const userName =
    [user?.firstName || user?.first_name, user?.lastName || user?.last_name]
      .filter(Boolean)
      .join(" ") || "You";

  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const [err, setErr] = useState("");

  // fatal error state for connection/join issues
  const [fatal, setFatal] = useState(null);

  const [messages, setMessages] = useState([]);
  const [typingByRoom, setTypingByRoom] = useState({});
  const [project, setProject] = useState(null);
  const [roomClosed, setRoomClosed] = useState(false);

  // PM actions
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // UI-only state
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadFloatCount, setUnreadFloatCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // scroller controls
  const scrollerRef = useRef(null);
  const atBottomRef = useRef(true);
  const messageRefs = useRef({});

  // trigger rejoin attempts
  const [rejoinTick, setRejoinTick] = useState(0);

  /* ----------------------------- typing cleanup ---------------------------- */
  useEffect(() => {
    const id = setInterval(() => {
      setTypingByRoom((prev) => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };
        for (const rid of Object.keys(next)) {
          const map = { ...next[rid] };
          for (const uid of Object.keys(map)) {
            if (map[uid].until < now) {
              delete map[uid];
              changed = true;
            }
          }
          next[rid] = map;
        }
        return changed ? next : prev;
      });
    }, 900);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onOnline = () => {};
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  /* ------------------------------ load rooms ------------------------------ */
  useEffect(() => {
    let mounted = true;
    if (!userId) return;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const { data } = await chatApi.myRooms();
        const list = Array.isArray(data?.rooms) ? data.rooms : [];

        list.sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
        );

        if (!mounted) return;

        const mapped = list
          .map(mapRoom)
          .map((r) => ({ ...r, unreadCount: unreadCountFor(userId, r.id) }));

        setRooms(mapped);
        if (!activeRoomId && mapped.length) setActiveRoomId(mapped[0].id);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load rooms");
        setRooms([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  /* ----------------------------- join a room ----------------------------- */
  useEffect(() => {
    let cancelled = false;
    if (!userId || !activeRoomId) return;

    (async () => {
      try {
        setJoining(true);
        setErr("");
        setFatal(null);

        const s = connectSocket(userId);

        try {
          await waitForSocketConnected(getSocket());
        } catch (e) {
          if (cancelled) return;
          setFatal({ kind: "SOCKET_TIMEOUT", message: e?.message || "Socket connect timeout" });
          return;
        }

        try {
          await joinRoom(activeRoomId, userId);
        } catch (e) {
          if (cancelled) return;
          setFatal({
            kind: "JOIN_FAILED",
            message: e?.response?.data?.message || e?.message || "Failed to join room",
          });
          return;
        }

        if (cancelled) return;

        // messages
        const { data } = await chatApi.getMessages(activeRoomId);
        const list = Array.isArray(data?.messages) ? data.messages : [];
        const normalized = list
          .map((m) => normalizeIncoming(m, userId))
          .filter(Boolean);
        setMessages(normalized);

        // project meta
        let metaProject = null;
        let metaRoomClosed = false;
        let metaReopenRequested = false;
        try {
          const res = await projects.getRoomMeta(activeRoomId);
          const meta = res?.data || {};
          const p = meta?.project || null;
          if (p) metaProject = { ...p, _id: p._id || p.id || null };
          metaRoomClosed = !!meta?.room?.isClosed;
          metaReopenRequested = !!meta?.room?.reopenRequested;
        } catch {
          metaProject = null;
        }

        if (normalizeRole(userRole) === "PM") {
          try {
            const resFull = await projects.getByRoom(activeRoomId);
            const full = resFull?.data?.project || {};
            metaProject = {
              ...full,
              _id: full?._id || full?.id || metaProject?._id || null,
              hasRatings: !!full?.ratings || (metaProject?.hasRatings || false),
              reopenRequested:
                typeof full?.reopenRequested === "boolean"
                  ? full.reopenRequested
                  : metaReopenRequested,
            };
          } catch {
            metaProject = {
              ...(metaProject || {}),
              reopenRequested: metaReopenRequested,
            };
          }
        }

        setProject((prev) => ({
          ...metaProject,
          reopenRequested:
            typeof metaProject?.reopenRequested === "boolean"
              ? metaProject.reopenRequested
              : metaReopenRequested,
        }));

        const statusLc = String(metaProject?.status || "").toLowerCase();
        const fromProject = statusLc === "complete";
        setRoomClosed(fromProject || metaRoomClosed);

        // update sidebar preview timing
        if (normalized.length) {
          const last = normalized[normalized.length - 1];
          setRooms((prev) =>
            prev.map((r) =>
              r.id === activeRoomId
                ? { ...r, lastMessage: previewText(last), updatedAtISO: last.createdAtISO }
                : r
            )
          );
        }

        // reset unread for current room
        clearUnread(userId, activeRoomId);
        setRooms((prev) => prev.map((r) => (r.id === activeRoomId ? { ...r, unreadCount: 0 } : r)));

        // scroll to bottom once on load
        requestAnimationFrame(() => {
          const el = scrollerRef.current;
          if (el) {
            el.scrollTop = el.scrollHeight;
            atBottomRef.current = true;
            setIsAtBottom(true);
            setUnreadFloatCount(0);
          }
        });

        // socket listeners
        const onMessage = (msg) => {
          const shaped = normalizeIncoming(msg, userId);
          if (!shaped) return;

          const rid = String(shaped.room || activeRoomId);

          if (shaped.isMine) {
            // 1) If we have a nonce, reconcile by nonce.
            if (shaped.clientNonce) {
              setMessages((prev) => {
                const idx = prev.findIndex(
                  (x) => x.isMine && x.clientNonce && x.clientNonce === shaped.clientNonce
                );
                if (idx !== -1) {
                  const prevMsg = prev[idx];
                  const merged = {
                    ...prevMsg,
                    _id: shaped._id,
                    status: "delivered",
                    deliveredAt: shaped.deliveredAt || new Date().toISOString(),
                    createdAtISO: shaped.createdAtISO || prevMsg.createdAtISO,
                    timestamp: shaped.timestamp || prevMsg.timestamp,
                  };
                  const next = prev.slice();
                  next[idx] = merged;
                  return next;
                }
                // fallback: fuzzy reconcile without nonce
                return reconcileMineWithoutNonce(prev, shaped);
              });
            } else {
              // no nonce at all — fuzzy reconcile
              setMessages((prev) => reconcileMineWithoutNonce(prev, shaped));
            }
          } else {
            // messages from others (or mine already reconciled): keep sidebar/ordering fresh
            setRooms((prev) => {
              let updated = prev;
              const idx = updated.findIndex((x) => x.id === rid);
              if (idx !== -1) {
                const r0 = updated[idx];
                const r1 = {
                  ...r0,
                  lastMessage: previewText(shaped),
                  updatedAtISO: shaped.createdAtISO,
                };
                updated = [r1, ...updated.slice(0, idx), ...updated.slice(idx + 1)];
              }
              return updated;
            });

            if (rid !== String(activeRoomId) && !shaped.isMine) {
              incUnread(userId, rid);
              setRooms((prev) =>
                prev.map((r) =>
                  r.id === rid ? { ...r, unreadCount: unreadCountFor(userId, rid) } : r
                )
              );
              return;
            }

            safeAppend(setMessages, shaped);
          }

          // scroll behavior unchanged...
          const el = scrollerRef.current;
          if (!el) return;
          const atBottom = atBottomRef.current;
          if (atBottom || shaped.isMine) {
            requestAnimationFrame(() => {
              scrollerRef.current?.scrollTo({
                top: scrollerRef.current.scrollHeight,
                behavior: "smooth",
              });
            });
            setUnreadFloatCount(0);
          } else {
            setUnreadFloatCount((c) => c + 1);
          }
        };

        const onTyping = ({ roomId, userId: uid, role, isTyping }) => {
          if (!roomId || !uid || String(uid) === String(userId)) return;
          const displayRole = normalizeRole(role) || "User";
          setTypingByRoom((prev) => {
            const map = { ...(prev[roomId] || {}) };
            if (isTyping) map[uid] = { role: displayRole, until: Date.now() + 2500 };
            else delete map[uid];
            return { ...prev, [roomId]: map };
          });
        };

        const onDelivered = ({ messageId, clientNonce }) => {
          // Optional: if your backend emits a dedicated delivered event
          setMessages((prev) => {
            const idx = prev.findIndex(
              (m) => (clientNonce && m.clientNonce === clientNonce) || m._id === messageId
            );
            if (idx === -1) return prev;
            const next = prev.slice();
            next[idx] = { ...next[idx], status: "delivered", deliveredAt: new Date().toISOString() };
            return next;
          });
        };

        const onRead = ({ messageIds }) => {
          setMessages((prev) => {
            if (!Array.isArray(messageIds) || !messageIds.length) return prev;
            let changed = false;
            const next = prev.map((m) => {
              if (messageIds.includes(m._id) && m.status !== "read") {
                changed = true;
                return { ...m, status: "read", readAt: new Date().toISOString() };
              }
              return m;
            });
            return changed ? next : prev;
          });
        };

        const onRated = ({ ratings }) =>
          setProject((p) => (p ? { ...p, ratings: ratings || p.ratings, hasRatings: true } : p));

        const onRoomClosed = ({ roomId }) => {
          if (String(roomId) !== String(activeRoomId)) return;
          setRoomClosed(true);
        };
        const onRoomReopened = ({ roomId }) => {
          if (String(roomId) !== String(activeRoomId)) return;
          setRoomClosed(false);
          setProject((p) => (p ? { ...p, reopenRequested: false, status: "In-Progress" } : p));
        };

        const onReopenRequested = ({ roomId }) => {
          if (String(roomId) !== String(activeRoomId)) return;
          setProject((p) => (p ? { ...p, reopenRequested: true } : p));
        };

        const s2 = getSocket();
        s2?.off("message", onMessage);
        s2?.off("typing", onTyping);
        s2?.off("delivered", onDelivered);
        s2?.off("read", onRead);
        s2?.off("rated", onRated);
        s2?.off("room:closed", onRoomClosed);
        s2?.off("room:reopened", onRoomReopened);
        s2?.off("reopen:requested", onReopenRequested);

        s2?.on("message", onMessage);
        s2?.on("typing", onTyping);
        s2?.on("delivered", onDelivered); // if supported by backend
        s2?.on("read", onRead); // if supported by backend
        s2?.on("rated", onRated);
        s2?.on("room:closed", onRoomClosed);
        s2?.on("room:reopened", onRoomReopened);
        s2?.on("reopen:requested", onReopenRequested);
      } catch (e) {
        if (!cancelled) {
          setFatal({ kind: "GENERIC", message: e?.message || "Failed to join chat" });
        }
      } finally {
        setJoining(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeRoomId, userId, userRole, rejoinTick]);

  /* ------------------------------ derived flags ----------------------------- */
  const rated = useMemo(() => {
    if (project?.hasRatings) return true;
    const r = project?.ratings || {};
    return !!(r?.pm?.score && r?.engineer?.score);
  }, [project]);

  const canShowClose = userRole === "PM" && rated && !roomClosed;
  const canShowReopen = userRole === "PM" && roomClosed && !!project?.reopenRequested;

  /* ----------------------------- presence counts ----------------------------- */
  const presence = useMemo(() => {
    const map = new Map();
    const now = Date.now();

    for (const m of messages) {
      if (!m?.senderName) continue;
      const key = m.senderName + "|" + (m.senderRole || "");
      const last = new Date(m.createdAtISO || Date.now()).getTime();
      const prev = map.get(key) || { name: m.senderName, role: m.senderRole, last: 0 };
      if (last > prev.last) map.set(key, { name: m.senderName, role: m.senderRole, last });
    }

    map.set(userName + "|" + userRole, { name: userName, role: userRole, last: now });

    const typers = Object.values(typingByRoom[activeRoomId] || {});
    const typingRoles = typers.map((t) => t.role);

    let online = 0;
    let offline = 0;
    const fiveMin = 5 * 60 * 1000;

    map.forEach((v) => {
      const isTyping = typingRoles.includes(v.role);
      const active = isTyping || now - v.last <= fiveMin;
      if (active) online += 1;
      else offline += 1;
    });

    return {
      total: map.size,
      online,
      offline,
      users: Array.from(map.values()).map((u) => ({
        id: u.name + "|" + u.role,
        name: u.name,
        role: u.role,
        isOnline: now - u.last <= fiveMin || typingRoles.includes(u.role),
      })),
    };
  }, [messages, typingByRoom, activeRoomId, userName, userRole]);

  /* ------------------------------ typing label ------------------------------ */
  const typingText = useMemo(() => {
    if (!activeRoomId || roomClosed) return "";
    const others = Object.values(typingByRoom[activeRoomId] || {});
    if (!others.length) return "";
    const first = normalizeRole(others[0].role);
    return others.length === 1
      ? `${first} is typing`
      : `${first} and ${others.length - 1} other(s) are typing`;
  }, [typingByRoom, activeRoomId, roomClosed]);

  /* -------------------------------- commands -------------------------------- */
  const commands = useMemo(() => {
    if (userRole !== "PM") return [];
    return [
      { id: "invoice", title: "Generate an invoice", subtitle: "Create a Stripe hosted invoice for this project", hint: "invoice" },
    ];
  }, [userRole]);

  const handleRunCommand = async (cmd) => {
    try {
      if (!activeRoomId) return;
      if (cmd.id === "invoice") {
        setShowInvoiceModal(true);
        return;
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to run command");
    }
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const threshold = 120;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < threshold;
    atBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    if (atBottom) setUnreadFloatCount(0);
  };

  /* --------------------------- OPTIMISTIC SEND --------------------------- */
  const handleSendMessage = async (text, files = []) => {
    if (!activeRoomId || roomClosed) return;

    // normalize file input
    let fileArray = [];
    if (files) {
      if (typeof FileList !== "undefined" && files instanceof FileList) {
        fileArray = Array.from(files);
      } else if (Array.isArray(files)) {
        fileArray = files.filter(Boolean);
      } else {
        fileArray = [files].filter(Boolean);
      }
    }

    const trimmed = (text || "").trim();
    const hasFiles = fileArray.length > 0;
    if (!trimmed && !hasFiles) return;

    const clientNonce = genClientNonce();
    const tempId = `tmp-${clientNonce}`;
    const createdAtISO = new Date().toISOString();

    // Build optimistic message
    const optimistic = {
      _id: tempId,
      room: activeRoomId,
      content: trimmed,
      attachments: [], // show after upload if you implement optimistic file previews
      createdAtISO,
      timestamp: new Date(createdAtISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      senderName: userName,
      senderRole: userRole,
      senderType: userRole,
      isMine: true,
      bubbleTheme: "me",
      status: "pending",           // <- key
      clientNonce,                 // <- reconcile key
      deliveredAt: null,
      readAt: null
    };

    // 1) Show immediately
    setMessages((prev) => [...prev, optimistic]);

    // 2) Scroll to bottom
    requestAnimationFrame(() => {
      scrollerRef.current?.scrollTo({
        top: scrollerRef.current.scrollHeight,
        behavior: "smooth",
      });
    });

    try {
      // 3) Send to server (include clientNonce so echo can reconcile)
      await chatApi.send({ roomId: activeRoomId, text: trimmed, files: fileArray, clientNonce });

      // If your backend does NOT echo the nonce, you could fallback-set "sent" here,
      // then upgrade to "delivered" on socket echo. If it does echo, the onMessage
      // handler above will replace this optimistic one with the real message and set 'delivered'.
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m._id === tempId);
        if (idx === -1) return prev;
        const next = prev.slice();
        // Move from 'pending' → 'sent' (will become 'delivered' when echoed)
        next[idx] = { ...next[idx], status: "sent" };
        return next;
      });
    } catch (e) {
      // 4) Failure: flag as failed
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m._id === tempId);
        if (idx === -1) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], status: "failed", error: e?.response?.data?.message || e?.message || "Failed to send" };
        return next;
      });
      setErr(e?.response?.data?.message || e?.message || "Failed to send");
    }
  };

  const retrySend = async (message) => {
    if (!message || message.status !== "failed") return;
    try {
      setMessages((prev) => prev.map((m) => (m._id === message._id ? { ...m, status: "pending", error: undefined } : m)));
      await chatApi.send({ roomId: message.room, text: message.content, files: [], clientNonce: message.clientNonce });
      setMessages((prev) => prev.map((m) => (m._id === message._id ? { ...m, status: "sent" } : m)));
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m._id === message._id ? { ...m, status: "failed", error: e?.message || "Failed again" } : m)));
    }
  };

  const handleTypingChange = (isTyping) => {
    const s = getSocket();
    if (!s || !activeRoomId || roomClosed) return;
    s.emit("typing", {
      roomId: activeRoomId,
      userId: String(userId),
      role: userRole,
      isTyping: !!isTyping,
      name: userName,
    });
  };

  const getProjectId = () => project?._id || project?.id || null;

  const handleCloseRoom = async () => {
    try {
      const pid = getProjectId();
      if (!pid) return;
      await projects.close({ requestId: pid });
      setRoomClosed(true);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to close room");
    }
  };
  const handleReopenRoom = async () => {
    try {
      const pid = getProjectId();
      if (!pid) return;
      await projects.reopen({ requestId: pid });
      setProject((p) => (p ? { ...p, reopenRequested: false, status: "In-Progress" } : p));
      setRoomClosed(false);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to reopen room");
    }
  };

  /* ---------------------------- derived: grouping ---------------------------- */
  const grouped = useMemo(() => {
    if (!messages?.length) return [];
    const map = {};
    for (const m of messages) {
      const d = new Date(m.createdAtISO || Date.now());
      const key = d.toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }
    return Object.keys(map)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((k) => ({ date: new Date(k), list: map[k] }));
  }, [messages]);

  /* ---------------------------------- UI ---------------------------------- */
  if (loading) {
    return (
      <div className="h-screen grid place-items-center text-gray-600">
        Loading chat…
      </div>
    );
  }

  if (fatal) {
    const { kind } = fatal;
    const commonRefresh = () => window.location.reload();
    const retry = () => {
      setFatal(null);
      setRejoinTick((t) => t + 1);
    };

    const title =
      kind === "SOCKET_TIMEOUT"
        ? "Your connection took too long"
        : kind === "JOIN_FAILED"
          ? "We couldn’t join the room"
          : "Something broke while connecting";

    const copy =
      kind === "SOCKET_TIMEOUT"
        ? "It looks like your network is a bit slow and the chat socket couldn’t connect in time. Click Refresh to reload, or Try Again to reconnect now."
        : kind === "JOIN_FAILED"
          ? "The room briefly went out of sync and we couldn’t join. Your network may have dropped for a moment. Rejoin to continue chatting, or refresh the page."
          : "Your chat session lost its connection. You can refresh the page or try again.";

    return (
      <ErrorScreen
        kind={kind}
        title={title}
        message={copy}
        onRefresh={commonRefresh}
        onRetry={retry}
        retryLabel={kind === "JOIN_FAILED" ? "Rejoin Room" : "Try Again"}
      />
    );
  }

  const conversations = rooms.map(toConversation(typingByRoom));
  const headerContact = {
    name: shortName(rooms.find((r) => r.id === activeRoomId)?.title || "Team Chat"),
    status: roomClosed ? "Closed" : typingText || (joining ? "Joining…" : "Online"),
    avatar: "",
    isOnline: !joining && !roomClosed,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      {/* Top Navigation Bar */}
      <div className="border-b px-4 py-3 flex items-center justify-between z-50 bg-white border-gray-200">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition bg-black text-white hover:bg-black/90"
          title="Back"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline text-sm font-medium">Dashboard</span>
        </Link>

        <div className="text-sm font-medium text-gray-600">Team Chat</div>

        <button
          className="sm:hidden px-3 py-1.5 rounded-lg border text-sm transition border-gray-200 hover:bg-gray-50"
          onClick={() => setShowSidebar(true)}
        >
          Rooms
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside
          className={`${showSidebar ? "translate-x-0" : "-translate-x-full"} sm:translate-x-0 fixed sm:relative inset-y-0 left-0 z-40 w-80 border-r transition-transform duration-300 sm:flex flex-col bg-white border-gray-200`}
        >
          {showSidebar && (
            <div
              className="sm:hidden fixed inset-0 bg-black/20 -z-10"
              onClick={() => setShowSidebar(false)}
            />
          )}
          <ConversationList
            conversations={conversations}
            activeConversationId={activeRoomId}
            onConversationSelect={(id) => {
              setActiveRoomId(id);
              setShowSidebar(false);
            }}
            loading={false}
            error={""}
          />
        </aside>

        {/* Chat Area */}
        <section className={`relative flex-1 min-w-0 flex flex-col overflow-hidden min-h-0 ${!activeRoomId && "hidden sm:flex"} bg-gray-50`}>
          {/* Pinned wallpaper (NON-SCROLLING) */}
          <ChatBackground variant="staff" />

          {activeRoomId ? (
            <>
              {/* Chat Header */}
              <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
                <ChatHeader
                  contact={headerContact}
                  onBack={() => setShowSidebar(true)}
                  onSearchToggle={() => setShowSearch((v) => !v)}
                  activeUsers={presence.users}
                  totalUsers={presence.total}
                />
              </div>

              {/* Search Bar */}
              {showSearch && (
                <div className="border-b bg-white z-20">
                  <SearchBar
                    messages={messages}
                    onClose={() => setShowSearch(false)}
                    onResultSelect={(index) => {
                      const msg = messages[index];
                      if (!msg) return;
                      const el = messageRefs.current[msg._id];
                      if (el) {
                        setHighlightedMessageId(msg._id);
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        setTimeout(() => setHighlightedMessageId(null), 1800);
                      }
                    }}
                  />
                </div>
              )}

              {/* Close/Reopen banner */}
              {(canShowClose || canShowReopen) && (
                <div className="sticky top-[48px] md:top-[56px] z-20 border-b border-gray-200 bg-white px-3 md:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                  {canShowClose && (
                    <>
                      <div className="flex flex-1 min-w-0 flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-900 px-3 py-1 text-xs font-semibold">
                          Client Rated
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-[2px] text-[11px] font-medium">
                            PM ★{project?.ratings?.pm?.score ?? "—"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-[2px] text-[11px] font-medium">
                            Eng ★{project?.ratings?.engineer?.score ?? "—"}
                          </span>
                        </span>
                        {project?.ratings?.pm?.comment && (
                          <span className="text-xs text-gray-600 truncate max-w-[46ch]">
                            “{project.ratings.pm.comment}”
                          </span>
                        )}
                      </div>

                      <button
                        onClick={handleCloseRoom}
                        className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm
                                   bg-black hover:bg-black/90 active:scale-[.98] transition"
                        title="Close this room and mark the project Complete"
                      >
                        Close Room
                      </button>
                    </>
                  )}

                  {canShowReopen && (
                    <div className="w-full sm:w-auto flex items-center justify-between gap-2">
                      <div className="text-sm text-gray-600">
                        Client requested to reopen this room.
                      </div>
                      <button
                        onClick={handleReopenRoom}
                        className="rounded-full px-4 py-2 text-sm font-semibold text-white bg-black hover:bg-black/90"
                      >
                        Reopen Room
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Messages Area */}
              <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3 min-h-0
                           scroll-smooth"
              >
                {messages.length ? (
                  grouped.map((g) => (
                    <div key={g.date.toISOString()} className="space-y-2.5">
                      {/* Date separator */}
                      <div className="flex items-center justify-center my-4">
                        <div className="border rounded-full px-3 py-1 shadow-sm bg-gray-100 border-gray-200 text-gray-700">
                          <span className="text-[11px] font-medium">
                            {formatDateSeparator(g.date)}
                          </span>
                        </div>
                      </div>

                      {/* Message list */}
                      <div className="space-y-2">
                        {g.list.map((m) => (
                          <div key={m._id} ref={(el) => (messageRefs.current[m._id] = el)}>
                            <MessageBubble
                              message={m}
                              highlighted={highlightedMessageId === m._id}
                              onRetry={() => retrySend(m)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full w-full grid place-items-center text-center text-gray-500 px-4">
                    No messages yet
                  </div>
                )}
                <div className="h-8" />
              </div>

              {!isAtBottom && unreadFloatCount > 0 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
                  <UnreadMessagesIndicator
                    count={unreadFloatCount}
                    onClick={() => {
                      scrollerRef.current?.scrollTo({
                        top: scrollerRef.current.scrollHeight,
                        behavior: "smooth",
                      });
                      setUnreadFloatCount(0);
                    }}
                  />
                </div>
              )}

              {typingText && headerContact.status !== "Closed" && (
                <div className="px-4 pb-2 relative z-20">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs bg-white/90 backdrop-blur border-gray-200 text-gray-600">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-gray-400" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-gray-400" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-gray-400" style={{ animationDelay: "300ms" }} />
                    </span>
                    {typingText}
                  </div>
                </div>
              )}

              <div className="sticky bottom-0 border-t bg-white/95 backdrop-blur border-gray-200 z-20">
                <div className="max-w-6xl mx-auto px-3 md:px-4 py-2">
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    onTypingChange={handleTypingChange}
                    typingText=""
                    disabled={roomClosed}
                    commands={userRole === "PM" ? [{ id: "invoice", title: "Generate an invoice", subtitle: "Create a Stripe hosted invoice for this project", hint: "invoice" }] : []}
                    onCommandRun={handleRunCommand}
                    role={userRole}
                  />
                </div>
              </div>

              {err && (
                <div className="px-4 py-2">
                  <InlineNotification
                    notification={{
                      id: "err",
                      type: "error",
                      message: err,
                      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    }}
                    onDismiss={() => setErr("")}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="hidden sm:grid flex-1 place-items-center text-gray-500 p-6 z-10">
              {loading ? "Loading your rooms…" : "Select a conversation to start chatting"}
            </div>
          )}
        </section>
      </div>

      {showInvoiceModal && userRole === "PM" && (
        <InvoiceModal
          projectTitle={project?.projectTitle}
          onCancel={() => setShowInvoiceModal(false)}
          onSubmit={async ({ amountDecimal, currency, memo }) => {
            try {
              const pid = project?.["_id"] || project?.id;
              if (!pid) throw new Error("No project found for this room.");

              const payload = {
                projectId: pid,
                amountDecimal,
                currency: currency || "USD",
                memo: memo || `Invoice for ${project?.projectTitle || "project"}`,
              };

              const { data } = await invoices.createInvoice(payload);
              const url = data?.hostedUrl || data?.invoiceUrl;
              if (!url) throw new Error("No invoice URL returned.");

              const msg = `🧾 Invoice created — ${url}`;
              await chatApi.send({ roomId: activeRoomId, text: msg });

              setShowInvoiceModal(false);
              setNotifications((p) => [
                ...p,
                {
                  id: `n-${Date.now()}`,
                  type: "success",
                  message: "Invoice created successfully",
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ]);
            } catch (e) {
              setErr(e?.response?.data?.message || e?.message || "Failed to create invoice");
            }
          }}
        />
      )}
    </div>
  );
}
