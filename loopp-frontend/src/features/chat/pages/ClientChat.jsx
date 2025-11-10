// src/features/clientChat/pages/ClientChat.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMyClientRooms,
  fetchClientRoomMessages,
  sendClientRoomMessage,
} from "@/services/clientChat.service";
import {
  connectSocket,
  getSocket,
  joinRoom as joinSocketRoom,
} from "@/lib/socket";
import * as Projects from "@/services/projects.service";

import ConversationList from "@/features/chat/components/ConversationList";
import ChatHeader from "@/features/chat/components/ChatHeader";
import ChatInput from "@/features/chat/components/ChatInput";
import MessageBubble from "@/features/chat/components/MessageBubble";

import SearchBar from "@/features/chat/components/SearchBar";
import InlineNotification from "@/features/chat/components/InlineNotification";
import ChatBackground from "@/features/chat/components/ChatBackground";
import UnreadMessagesIndicator from "@/features/chat/components/UnreadMessagesIndicator";
import RatingModal from "../components/RatingModal";

/* ----------------------------- tiny primitives ---------------------------- */
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  const elRef = useRef(null);
  if (!elRef.current && typeof document !== "undefined") {
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.pointerEvents = "none";
    el.style.zIndex = "9999";
    elRef.current = el;
  }
  useEffect(() => {
    if (!elRef.current) return;
    document.body.appendChild(elRef.current);
    setMounted(true);
    return () => {
      try { document.body.removeChild(elRef.current); } catch {}
    };
  }, []);
  if (!mounted) return null;
  return <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{children}</div>;
}

function ContextMenu({ open, x, y, items, onClose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) return;
      const { innerWidth: W, innerHeight: H } = window;
      const rect = menu.getBoundingClientRect();
      let nx = x, ny = y;
      if (nx + rect.width > W - 8) nx = Math.max(8, W - rect.width - 8);
      if (ny + rect.height > H - 8) ny = Math.max(8, H - rect.height - 8);
      setPos({ left: nx, top: ny });
    });
    return () => cancelAnimationFrame(id);
  }, [open, x, y]);

  useEffect(() => {
    if (!open) return;
    const onAny = (e) => {
      if (e.type === "keydown" && e.key !== "Escape") return;
      onClose?.();
    };
    window.addEventListener("click", onAny, { capture: true });
    window.addEventListener("contextmenu", onAny, { capture: true });
    window.addEventListener("keydown", onAny);
    return () => {
      window.removeEventListener("click", onAny, { capture: true });
      window.removeEventListener("contextmenu", onAny, { capture: true });
      window.removeEventListener("keydown", onAny);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <Portal>
      <div
        ref={menuRef}
        style={{ position: "fixed", left: pos.left, top: pos.top, pointerEvents: "auto" }}
        className="min-w-44 max-w-[70vw] rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
      >
        <ul className="py-1">
          {items.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => { it.onClick?.(); onClose?.(); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Portal>
  );
}

/* ------------------------------ helpers/utils ----------------------------- */
const shortName = (s, m = 28) => {
  const t = (s || "").toString().trim();
  return t.length <= m ? t : t.slice(0, m - 1) + "…";
};

const STAFF_ROLES = ["SuperAdmin", "Admin", "PM", "Engineer"];
const normalizeRole = (r = "") => {
  const s = (r || "").toString();
  if (/system/i.test(s)) return "System";
  if (/super\s*admin/i.test(s)) return "SuperAdmin";
  if (/admin/i.test(s) && !/super/i.test(s)) return "Admin";
  if (/pm|project\s*manager/i.test(s)) return "PM";
  if (/engineer/i.test(s)) return "Engineer";
  if (/client/i.test(s)) return "Client";
  return "";
};
const isStaff = (role) => STAFF_ROLES.includes(role);

const roleToTheme = (role, isMine) => {
  if (role === "System") return "system";
  if (isMine) return "me";
  if (role === "SuperAdmin") return "superadmin";
  if (role === "Admin") return "admin";
  if (role === "PM") return "pm";
  if (role === "Engineer") return "engineer";
  return "client";
};

const closeInTime = (aISO, bISO, ms = 15000) => {
  const a = new Date(aISO || Date.now()).getTime();
  const b = new Date(bISO || Date.now()).getTime();
  return Math.abs(a - b) <= ms;
};

const STATUS_ONLINE = "online";
const STATUS_AWAY = "away";
const STATUS_OFFLINE = "offline";

/* --------------------------- presence mini-store -------------------------- */
function upsertMember(map, roomId, idKey, role, name, status) {
  const cur = map[roomId] || { members: [] };
  const members = [...cur.members];
  const idx = members.findIndex((m) => (m.id || m.role) === idKey);
  const next = { id: idKey, role, name, status };
  if (idx === -1) members.push(next);
  else members[idx] = { ...members[idx], ...next };
  return { ...map, [roomId]: { members } };
}
function setStatus(map, roomId, idKey, status) {
  const cur = map[roomId] || { members: [] };
  const members = cur.members.map((m) => ((m.id || m.role) === idKey ? { ...m, status } : m));
  return { ...map, [roomId]: { members } };
}
function ensureSeedParticipants(map, roomId, meta) {
  let next = { ...map };
  next = upsertMember(next, roomId, "Client", "Client", "You", STATUS_ONLINE);
  const pm = meta?.pm || meta?.project?.pm || meta?.room?.pm || meta?.userPM;
  if (pm) {
    const pmName = [pm.firstName, pm.lastName].filter(Boolean).join(" ").trim() || "PM";
    next = upsertMember(next, roomId, "PM", "PM", pmName, STATUS_AWAY);
  }
  const eng = meta?.engineer || meta?.project?.engineer || meta?.room?.engineer;
  if (eng) {
    const engName = [eng.firstName, eng.lastName].filter(Boolean).join(" ").trim() || "Engineer";
    next = upsertMember(next, roomId, "Engineer", "Engineer", engName, STATUS_AWAY);
  }
  return next;
}

/* --------------------- message shaping / reconciliation -------------------- */
function shapeForClient(m) {
  const created =
    m.createdAt || m.createdAtISO || m.timestamp || new Date().toISOString();
  const isSystem = String(m.senderType || "").toLowerCase() === "system";

  const role =
    normalizeRole(
      m.senderRole || m.role || (m.sender && (m.sender.role || m.sender.type))
    ) || (isSystem ? "System" : "");

  const mine = isSystem ? false : !isStaff(role);

  const senderName =
    m.senderName ||
    (isSystem
      ? "System"
      : mine
      ? "You"
      : (m.sender &&
          [m.sender.firstName, m.sender.lastName].filter(Boolean).join(" ")) ||
        role ||
        "PM/Engineer");

  const attachments = Array.isArray(m.attachments) ? m.attachments : [];

  // deliveryStatus from server if present; default "sent" for any echo we receive
  const deliveryStatus = m.deliveryStatus || "sent";

  return {
    _id: m._id || m.id || `${Date.now()}-${Math.random()}`,
    room: String(m.room?._id || m.room || ""),
    content: m.text || m.content || "",
    timestamp: new Date(created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    createdAtISO: new Date(created).toISOString(),
    isMine: mine,
    senderRole: role || "Client",
    senderName,
    attachments,
    bubbleTheme: roleToTheme(role || "", mine),
    clientNonce: m.clientNonce || m.nonce || undefined,
    deliveryStatus, // "sending" | "sent" | "failed"
  };
}

const msgSignature = (m) =>
  [
    String(m.room || ""),
    String(m.senderRole || ""),
    String(m.isMine ? "1" : "0"),
    (m.content || "").slice(0, 200),
    (m.createdAtISO || "").slice(0, 19),
    String(Array.isArray(m.attachments) ? m.attachments.length : 0),
  ].join("|");

function safeAppend(setMessages, incoming) {
  setMessages((prev) => {
    if (prev.some((x) => x._id === incoming._id)) return prev;

    // perfect reconcile via clientNonce
    if (incoming.clientNonce) {
      const nIdx = prev.findIndex((x) => x.clientNonce && x.clientNonce === incoming.clientNonce);
      if (nIdx !== -1) {
        const next = prev.slice();
        next[nIdx] = {
          ...next[nIdx],
          _id: incoming._id,
          createdAtISO: incoming.createdAtISO || next[nIdx].createdAtISO,
          timestamp: incoming.timestamp || next[nIdx].timestamp,
          clientNonce: incoming.clientNonce,
          deliveryStatus: "sent",
          attachments: incoming.attachments?.length ? incoming.attachments : next[nIdx].attachments,
          content: incoming.content ?? next[nIdx].content,
        };
        return next;
      }
    }

    // fuzzy dedupe (mine, time-close, same content)
    const dupIdx = prev.findIndex(
      (x) =>
        x.isMine === true &&
        incoming.isMine === true &&
        (x.content || "").trim() === (incoming.content || "").trim() &&
        closeInTime(x.createdAtISO, incoming.createdAtISO, 15000)
    );
    if (dupIdx !== -1) {
      const next = prev.slice();
      next[dupIdx] = {
        ...next[dupIdx],
        _id: incoming._id,
        createdAtISO: incoming.createdAtISO || next[dupIdx].createdAtISO,
        timestamp: incoming.timestamp || next[dupIdx].timestamp,
        clientNonce: incoming.clientNonce || next[dupIdx].clientNonce,
        deliveryStatus: "sent",
        attachments: incoming.attachments?.length ? incoming.attachments : next[dupIdx].attachments,
        content: incoming.content ?? next[dupIdx].content,
      };
      return next;
    }

    // legacy signature
    const sig = msgSignature(incoming);
    if (prev.some((x) => msgSignature(x) === sig)) return prev;

    return [...prev, incoming];
  });
}

function previewText(m) {
  if (m.attachments?.length && !m.content) return `📎 ${m.attachments.length} attachment(s)`;
  return m.content || "—";
}

/* ----------------------- grouping + tiny notices etc. ---------------------- */
const formatDateSeparator = (date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (date > weekAgo) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};
const groupMessagesByDate = (messages) => {
  const groups = {};
  messages.forEach((msg) => {
    const d = msg.createdAtISO ? new Date(msg.createdAtISO) : new Date();
    const key = d.toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(msg);
  });
  return Object.keys(groups).map((key) => ({
    date: formatDateSeparator(new Date(key)),
    messages: groups[key],
  }));
};

function InlineNotice({ text }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <div className="w-full text-center text-[11px] md:text-xs tracking-wide text-black/65">
        {"—".repeat(6)} <span className="font-semibold uppercase">{text}</span> {"—".repeat(6)}
      </div>
    </div>
  );
}
function noticeFromSystemEvent(ev = {}) {
  const type = String(ev.type || "").toLowerCase();
  const eng = ev.engineer || {};
  const engName = [eng.firstName, eng.lastName].filter(Boolean).join(" ").trim();
  switch (type) {
    case "pm_assigned": return "A PM HAS BEEN ASSIGNED";
    case "pm_online": return "PM IS ACTIVELY ONLINE";
    case "pm_assigned_engineer": return `PM HAS ASSIGNED THE PROJECT TO AN ENGINEER${engName ? ` — (${engName})` : ""}`;
    case "engineer_accepted": return "ENGINEER HAS ACCEPTED THE TASK AND WILL BE JOINING THE ROOM";
    case "engineer_joined":
    case "engineer_online": return "ENGINEER IS IN THE ROOM";
    default: return "";
  }
}

/* ------------------------------- tiny toast ------------------------------- */
function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast];
}

/* ------------------------------- main view -------------------------------- */
export default function ClientChat() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);

  const [header, setHeader] = useState({ name: "Chat", status: "Online", avatar: "" });
  const [messages, setMessages] = useState([]);

  const [typingByRoom, setTypingByRoom] = useState({});
  const [toast, setToast] = useToast();

  const [ratingOpen, setRatingOpen] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [reopenRequested, setReopenRequested] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const [presenceByRoom, setPresenceByRoom] = useState({});
  const [presenceOpen, setPresenceOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const lastRightClickText = useRef("");

  const scrollerRef = useRef(null);
  const atBottomRef = useRef(true);
  const lastCountRef = useRef(0);
  const messageRefs = useRef({});

  const [fatal, setFatal] = useState(null);
  const [reconnectTick, setReconnectTick] = useState(0);

  // NEW: local outbox so we can retry sends (keeps original files)
  const outboxRef = useRef(new Map()); // nonce -> { text, files }

  const typingText = useMemo(() => {
    if (!activeRoomId) return "";
    const map = typingByRoom[activeRoomId] || {};
    const others = Object.values(map);
    if (!others.length) return "";
    const first = others[0];
    const label = first.role || "PM/Engineer";
    return others.length === 1 ? `${label} is typing…` : `${label} and ${others.length - 1} other(s) are typing…`;
  }, [typingByRoom, activeRoomId]);

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
              setPresenceByRoom((p) => setStatus(p, rid, uid, STATUS_AWAY));
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

  /* --------------------- initial rooms load --------------------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErr("");
        const data = await fetchMyClientRooms();
        const list = Array.isArray(data?.rooms) ? data.rooms : [];
        list.sort((a, b) =>
          new Date(b.updatedAtISO || b.updatedAt) - new Date(a.updatedAtISO || a.updatedAt)
        );
        setRooms(list);
        const firstReal = list.find((r) => r.hasRoom);
        setActiveRoomId(firstReal?.id || null);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load rooms");
      } finally { setLoading(false); }
    })();
  }, []);

  /* ---------------- join + live listeners (+presence) ---------------- */
  useEffect(() => {
    if (!activeRoomId) return;
    const active = rooms.find((r) => r.id === activeRoomId);
    if (!active?.hasRoom) return;

    let unsub = () => {};

    (async () => {
      try {
        setErr(""); setFatal(null);

        const res = await fetchClientRoomMessages(activeRoomId, { limit: 100 });
        const shaped = (res?.messages || []).map(shapeForClient);
        setMessages(shaped);

        let roomMeta = {};
        try {
          const metaRes = await Projects.getRoomMeta(activeRoomId);
          roomMeta = metaRes?.data?.room || metaRes?.room || metaRes || {};
        } catch {}

        setPresenceByRoom((prev) => ensureSeedParticipants(prev, activeRoomId, roomMeta));

        let closed = Boolean(active?.isClosed === true || active?.isClosed === "true");
        let reopen = !!roomMeta?.reopenRequested;
        if (typeof roomMeta?.isClosed === "boolean") closed = roomMeta.isClosed;

        setHeader({
          name: shortName(active?.title || "Project Chat"),
          status: closed ? "Closed" : "Online",
          avatar: "",
        });
        setReopenRequested(reopen);

        const el = scrollerRef.current;
        if (el) {
          const onScroll = () => {
            const threshold = 120;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
            atBottomRef.current = atBottom;
            setIsAtBottom(atBottom);
            if (atBottom) setUnreadCount(0);
          };
          el.addEventListener("scroll", onScroll, { passive: true });
          requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
            atBottomRef.current = true;
            setIsAtBottom(true);
          });
          unsub = () => { try { el.removeEventListener("scroll", onScroll); } catch {} };
        }

        try {
          connectSocket();
          await waitForSocketConnected(getSocket());
        } catch (e) {
          setFatal({ type: "socket_timeout", message: e?.message || "The live connection timed out." });
          return;
        }

        try {
          await joinSocketRoom(activeRoomId);
        } catch (e) {
          setFatal({ type: "join_failed", message: e?.response?.data?.message || e?.message || "Join failed." });
          return;
        }

        const s = getSocket();

        const onMessage = (m) => {
          const rid = String(m.room?._id || m.room);
          const shapedMsg = shapeForClient(m);

          // Update room card recency
          setRooms((prev) => {
            const idx = prev.findIndex((x) => String(x.id) === rid);
            if (idx === -1) return prev;
            const updated = {
              ...prev[idx],
              updatedAtISO: m.createdAt || new Date().toISOString(),
              lastMessage: previewText(shapedMsg),
            };
            const rest = prev.slice(0, idx).concat(prev.slice(idx + 1));
            return [updated, ...rest];
          });

          if (rid !== String(activeRoomId)) return;

          // Apply reconcile (will turn local "sending" into "sent")
          safeAppend(setMessages, shapedMsg);

          if (shapedMsg.clientNonce) {
            // clear outbox on success
            outboxRef.current.delete(shapedMsg.clientNonce);
          }

          if (atBottomRef.current || shapedMsg.isMine) {
            requestAnimationFrame(() => {
              scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
              setIsAtBottom(true); setUnreadCount(0);
            });
          } else {
            setUnreadCount((c) => c + 1);
          }
        };

        const onTyping = ({ roomId, role, isTyping, name }) => {
          const displayRole = normalizeRole(role) || "PM/Engineer";
          if (String(roomId) !== String(activeRoomId)) return;

          setTypingByRoom((prev) => {
            const map = { ...(prev[roomId] || {}) };
            const key = displayRole;
            if (isTyping) map[key] = { role: displayRole, until: Date.now() + 2500 };
            else delete map[key];
            return { ...prev, [roomId]: map };
          });

          if (isTyping) {
            const idKey = displayRole;
            setPresenceByRoom((prev) =>
              upsertMember(prev, activeRoomId, idKey, displayRole, name || displayRole, STATUS_ONLINE)
            );
          }
        };

        const onSystem = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          const type = String(payload.type || "").toLowerCase();
          const pm = payload.pm || payload.user || {};
          const eng = payload.engineer || {};

          if (!rid || rid === String(activeRoomId)) {
            const label = noticeFromSystemEvent(payload);
            if (label) {
              const msg = {
                _id: `sys-${payload.type}-${payload.timestamp || Date.now()}-${Math.random()}`,
                room: String(activeRoomId),
                inlineNotice: true,
                noticeText: label,
                createdAtISO: payload.timestamp || new Date().toISOString(),
              };
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.inlineNotice && last.noticeText === label) return prev;
                return [...prev, msg];
              });
              if (atBottomRef.current) {
                requestAnimationFrame(() => {
                  scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
                });
              }
            }
          }

          setPresenceByRoom((prev) => {
            let next = { ...prev };
            const pmName = [pm?.firstName, pm?.lastName].filter(Boolean).join(" ").trim() || "PM";
            const engName = [eng?.firstName, eng?.lastName].filter(Boolean).join(" ").trim() || "Engineer";

            if (!rid || rid === String(activeRoomId)) {
              if (type === "pm_assigned") next = upsertMember(next, activeRoomId, "PM", "PM", pmName, STATUS_AWAY);
              if (type === "pm_online") next = upsertMember(next, activeRoomId, "PM", "PM", pmName, STATUS_ONLINE);
              if (type === "pm_assigned_engineer" || type === "engineer_joined")
                next = upsertMember(next, activeRoomId, "Engineer", "Engineer", engName, STATUS_ONLINE);
              if (type === "engineer_online")
                next = upsertMember(next, activeRoomId, "Engineer", "Engineer", engName, STATUS_ONLINE);
            }
            return next;
          });
        };

        const onRoomClosed = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;
          setRooms((prev) => prev.map((r) => (String(r.id) === String(activeRoomId) ? { ...r, isClosed: true } : r)));
          setHeader((h) => ({ ...h, status: "Closed" }));
          setToast({ text: "This room has been closed.", kind: "warn" });
          setNotifications((n) => [
            ...n,
            { id: `notif-${Date.now()}`, type: "warning", message: "Room closed",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
          ]);
        };

        const onRoomReopened = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;
          setRooms((prev) => prev.map((r) => (String(r.id) === String(activeRoomId) ? { ...r, isClosed: false } : r)));
          setReopenRequested(false);
          setHeader((h) => ({ ...h, status: "Online" }));
          setToast({ text: "This room has been reopened.", kind: "ok" });
          setNotifications((n) => [
            ...n,
            { id: `notif-${Date.now()}`, type: "success", message: "Room reopened",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
          ]);
        };

        const onReopenRequested = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;
          setReopenRequested(true);
          setToast({ text: "Reopen request sent.", kind: "ok" });
          setNotifications((n) => [
            ...n,
            { id: `notif-${Date.now()}`, type: "success", message: "Reopen request sent",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
          ]);
        };

        const onPmAssigned = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;

          const pmFirst = payload?.pm?.firstName || "";
          const pmLast = payload?.pm?.lastName || "";
          const pmName = [pmFirst, pmLast].filter(Boolean).join(" ").trim() || "PM";

          setRooms((prev) =>
            prev.map((r) =>
              String(r.id) === String(activeRoomId)
                ? { ...r, lastMessage: `${pmName} has been assigned as your PM. They’ll join shortly.`,
                    updatedAtISO: payload?.at || new Date().toISOString() }
                : r
            )
          );

          const inline = {
            _id: `pm-assigned-inline-${payload?.at || Date.now()}-${Math.random()}`,
            room: String(activeRoomId),
            inlineNotice: true,
            noticeText: "A PM HAS BEEN ASSIGNED",
            createdAtISO: payload?.at || new Date().toISOString(),
          };
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.inlineNotice && last.noticeText === inline.noticeText) return prev;
            return [...prev, inline];
          });

          setPresenceByRoom((prev) => upsertMember(prev, activeRoomId, "PM", "PM", pmName, STATUS_AWAY));

          if (atBottomRef.current) {
            requestAnimationFrame(() => {
              scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
            });
          }
        };

        s.off("message", onMessage);
        s.off("typing", onTyping);
        s.off("system", onSystem);
        s.off("room:closed", onRoomClosed);
        s.off("room:reopened", onRoomReopened);
        s.off("reopen:requested", onReopenRequested);
        s.off("room:pm_assigned", onPmAssigned);

        s.on("message", onMessage);
        s.on("typing", onTyping);
        s.on("system", onSystem);
        s.on("room:closed", onRoomClosed);
        s.on("room:reopened", onRoomReopened);
        s.on("reopen:requested", onReopenRequested);
        s.on("room:pm_assigned", onPmAssigned);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load messages");
      }
    })();

    return () => {
      try {
        const s = getSocket();
        if (s) {
          s.off("message");
          s.off("typing");
          s.off("system");
          s.off("room:closed");
          s.off("room:reopened");
          s.off("reopen:requested");
          s.off("room:pm_assigned");
        }
      } catch {}
      unsub?.();
    };
  }, [activeRoomId, rooms, reconnectTick]);

  useEffect(() => {
    if (!activeRoomId) return;
    setPresenceByRoom((prev) => setStatus(prev, activeRoomId, "Client", STATUS_ONLINE));
    setPresenceOpen(false);
  }, [activeRoomId]);

  useEffect(() => {
    if (!scrollerRef.current) return;
    const count = messages.length;
    const added = count - (lastCountRef.current || 0);
    if (added > 0 && !isAtBottom) setUnreadCount((c) => c + added);
    lastCountRef.current = count;
  }, [messages, isAtBottom]);

  /* -------------------------------- actions -------------------------------- */
  const appendOptimistic = (roomId, text, files, clientNonce) => {
    const createdAtISO = new Date().toISOString();

    // build local preview attachments (blob URLs) so user sees files instantly
    const localAttachments = (files || []).map((f) => {
      const url = typeof URL !== "undefined" ? URL.createObjectURL(f) : "";
      return {
        name: f.name || "attachment",
        type: f.type || "application/octet-stream",
        size: f.size || 0,
        url,
        isLocal: true,
      };
    });

    const optimistic = {
      _id: `tmp-${clientNonce}`,
      room: String(roomId),
      content: text,
      timestamp: new Date(createdAtISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAtISO,
      isMine: true,
      senderRole: "Client",
      senderName: "You",
      attachments: localAttachments,
      bubbleTheme: "me",
      clientNonce,
      deliveryStatus: "sending", // spinner
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
      setIsAtBottom(true); setUnreadCount(0);
    });
  };

  const markFailed = (clientNonce, reason) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.clientNonce === clientNonce
          ? { ...m, deliveryStatus: "failed", errorText: reason || "Failed to send" }
          : m
      )
    );
  };

  const onSend = async (text, files = []) => {
    const active = rooms.find((r) => r.id === activeRoomId);
    if (!activeRoomId || !active?.hasRoom || active?.isClosed || header.status === "Closed") return;

    const trimmed = (text || "").trim();
    let fileArray = [];
    if (files) {
      if (typeof FileList !== "undefined" && files instanceof FileList) fileArray = Array.from(files);
      else if (Array.isArray(files)) fileArray = files.filter(Boolean);
      else fileArray = [files].filter(Boolean);
    }
    const hasFiles = fileArray.length > 0;
    if (!trimmed && !hasFiles) { setErr("Please type a message or attach a file."); return; }

    // rating shortcut
    if (trimmed === "/rate") {
      try {
        const metaRes = await Projects.getRoomMeta(activeRoomId);
        const pr = metaRes?.data?.project || metaRes?.project || {};
        const status = String(pr?.status || "").toLowerCase();
        const already = !!pr?.hasRatings || hasRated;
        if (status !== "review") { setToast({ text: "You can only rate when the project is in Review.", kind: "warn" }); return; }
        if (already) { setToast({ text: "You’ve already submitted a rating.", kind: "error" }); return; }
        setRatingOpen(true);
      } catch { setToast({ text: "Unable to open rating right now.", kind: "error" }); }
      return;
    }

    // create nonce & optimistic bubble immediately
    const clientNonce = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    outboxRef.current.set(clientNonce, { text: trimmed, files: fileArray });
    appendOptimistic(activeRoomId, trimmed, fileArray, clientNonce);

    try {
      const res = await sendClientRoomMessage(activeRoomId, { text: trimmed, files: fileArray, clientNonce });
      if (res?.message) {
        // When the server echoes, onMessage + safeAppend will promote it to "sent"
        const shaped = shapeForClient({ ...res.message, clientNonce });
        safeAppend(setMessages, shaped);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === activeRoomId
              ? { ...r, lastMessage: previewText(shaped), updatedAtISO: new Date().toISOString() }
              : r
          )
        );
        outboxRef.current.delete(clientNonce);
      } else {
        // No message in response (should still arrive via socket). If it never does, we're safe.
      }
    } catch (e) {
      const reason = e?.response?.data?.message || e?.message || "Failed to send";
      markFailed(clientNonce, reason);
    }
  };

  const retrySend = async (clientNonce) => {
    const pack = outboxRef.current.get(clientNonce);
    if (!pack) {
      // Try to reconstruct from message in UI
      const msg = messages.find((m) => m.clientNonce === clientNonce);
      if (!msg) return;
      outboxRef.current.set(clientNonce, {
        text: msg.content || "",
        files: (msg.attachments || [])
          .filter((a) => a.isLocal && a.url)
          .map((a) => {
            // We cannot recreate original File from blob URL reliably;
            // recommend users reattach if browser blocks; attempt fetch->blob->File as fallback.
            return a.__file || null;
          })
          .filter(Boolean),
      });
    }
    const { text, files } = outboxRef.current.get(clientNonce) || { text: "", files: [] };

    // flip UI back to "sending"
    setMessages((prev) =>
      prev.map((m) => (m.clientNonce === clientNonce ? { ...m, deliveryStatus: "sending", errorText: "" } : m))
    );

    try {
      const res = await sendClientRoomMessage(activeRoomId, { text, files, clientNonce });
      if (res?.message) {
        const shaped = shapeForClient({ ...res.message, clientNonce });
        safeAppend(setMessages, shaped);
        outboxRef.current.delete(clientNonce);
      }
    } catch (e) {
      markFailed(clientNonce, e?.response?.data?.message || e?.message || "Failed to send");
    }
  };

  const onTypingChange = (isTyping) => {
    const s = getSocket();
    const active = rooms.find((r) => r.id === activeRoomId);
    if (!s || !activeRoomId || header.status === "Closed" || active?.isClosed) return;
    s.emit("typing", { roomId: activeRoomId, userId: "client", role: "Client", isTyping: !!isTyping, name: "Client" });
  };

  const handleRequestReopen = async () => {
    try {
      const active = rooms.find((r) => r.id === activeRoomId);
      const reqId = active?.requestId;
      if (!reqId) throw new Error("Missing request id.");
      await Projects.requestReopen({ requestId: reqId });
      setReopenRequested(true);
      setToast({ text: "Reopen request sent to your PM.", kind: "ok" });
      setNotifications((n) => [
        ...n,
        { id: `notif-${Date.now()}`, type: "success", message: "Reopen request sent",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
    } catch (e) {
      setToast({ text: e?.response?.data?.message || e?.message || "Failed to request reopen", kind: "error" });
    }
  };

  const handleSearchResultSelect = (index) => {
    const m = messages[index];
    if (!m) return;
    setHighlightedMessageId(m._id);
    const node = messageRefs.current[m._id];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const sel = window.getSelection?.();
    const selectedText = sel && String(sel.toString()).trim();
    lastRightClickText.current =
      selectedText || (e.target?.innerText ? String(e.target.innerText).trim().slice(0, 2000) : "");
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  const contextMenuItems = [
    { id: "copy-text", label: "Copy selected text", onClick: () => {
      const sel = window.getSelection?.(); const s = sel && String(sel.toString()); if (s) navigator.clipboard?.writeText(s);
    } },
    { id: "copy-msg", label: "Copy message", onClick: () => {
      const t = lastRightClickText.current || ""; if (t) navigator.clipboard?.writeText(t);
    } },
    { id: "reply", label: "Reply", onClick: () => {} },
    { id: "delete", label: "Delete (if allowed)", onClick: () => {} },
  ];

  /* --------------------------------- render --------------------------------- */
  if (loading) return <div className="h-screen grid place-items-center">Loading chat…</div>;

  const genericErrBanner = err ? (
    <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200">{err}</div>
  ) : null;

  if (!rooms.length) {
    return (
      <div className="h-screen grid place-items-center text-black/60">
        No conversations yet — we’ll open one as soon as a PM is assigned.
      </div>
    );
  }

  const active = rooms.find((r) => r.id === activeRoomId);
  const requestIdForRating = active?.requestId;

  const members = (presenceByRoom[activeRoomId]?.members || []);
  const totalUsers = members.length;

  const participantsForHeader = members.map((m) => ({
    id: m.id || m.role,
    name: m.name,
    role: m.role,
    isOnline: m.status !== STATUS_OFFLINE,
    inRoom: m.status === STATUS_ONLINE,
  }));

  const headerData = {
    ...header,
    status: header.status === "Online" ? typingText || "Online" : header.status,
    isOnline: header.status !== "Closed",
  };

  const [onlineList, awayList, offlineList] = [
    members.filter((m) => m.status === STATUS_ONLINE),
    members.filter((m) => m.status === STATUS_AWAY),
    members.filter((m) => m.status === STATUS_OFFLINE),
  ];

  const scrollToBottom = () => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    }
    setIsAtBottom(true); setUnreadCount(0);
  };

  const refreshPage = () => window.location.reload();
  const retryJoin = () => setReconnectTick((t) => t + 1);

  return (
    <div className="h-screen flex flex-col bg-white text-black relative">
      {fatal && (
        <ConnectionErrorOverlay
          type={fatal.type}
          message={fatal.message}
          onRefresh={refreshPage}
          onRetryJoin={retryJoin}
        />
      )}

      <div className="flex-none h-12 md:h-14 w-full border-b z-40 bg-white border-gray-200">
        <div className="h-full max-w-[1920px] mx-auto px-3 md:px-4 flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition hover:bg-gray-100" title="Back">
            <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="hidden sm:inline">Back</span>
          </a>
          <div className="text-sm font-medium text-gray-600">Client Chat</div>
          <button onClick={() => setShowSidebar(true)} className="sm:hidden px-3 py-1.5 text-sm font-medium rounded-lg transition hover:bg-gray-100">
            Rooms
          </button>
        </div>
      </div>

      {genericErrBanner}

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Mobile sidebar */}
        {showSidebar && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setShowSidebar(false)} />
            <aside className="absolute inset-y-0 left-0 w-[85%] max-w-sm shadow-2xl flex flex-col animate-slide-left bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                <h2 className="font-semibold">Conversations</h2>
                <button onClick={() => setShowSidebar(false)} className="p-2 rounded-lg text-xl leading-none hover:bg-gray-100">×</button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ConversationList
                  conversations={rooms.map((r) => ({
                    id: r.id,
                    name: shortName(r.title),
                    avatar: "",
                    lastMessage: r.lastMessage || "",
                    time: new Date(r.updatedAtISO || r.updatedAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    unreadCount: 0,
                    isOnline: !r.isClosed,
                    isPinned: false,
                    typing: !!typingByRoom[r.id] && Object.keys(typingByRoom[r.id]).length > 0,
                  }))}
                  activeConversationId={activeRoomId}
                  onConversationSelect={(id) => { setActiveRoomId(id); setShowSidebar(false); }}
                  loading={false}
                  error={""}
                />
              </div>
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden sm:flex w-80 lg:w-96 flex-col border-r border-gray-200 bg-white">
          <div className="px-4 py-3 border-b border-gray-200"><h2 className="font-semibold">Conversations</h2></div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ConversationList
              conversations={rooms.map((r) => ({
                id: r.id,
                name: shortName(r.title),
                avatar: "",
                lastMessage: r.lastMessage || "",
                time: new Date(r.updatedAtISO || r.updatedAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                unreadCount: 0,
                isOnline: !r.isClosed,
                isPinned: false,
                typing: !!typingByRoom[r.id] && Object.keys(typingByRoom[r.id]).length > 0,
              }))}
              activeConversationId={activeRoomId}
              onConversationSelect={(id) => setActiveRoomId(id)}
              loading={false}
              error={""}
            />
          </div>
        </aside>

        {/* Chat area */}
        <section className="relative flex-1 flex flex-col overflow-hidden bg-gray-50">
          <div className="absolute inset-0 z-0 pointer-events-none"><ChatBackground variant="client" /></div>

          <div className="relative z-10">
            <div className="relative">
              <ChatHeader
                roomId={activeRoomId}
                contact={headerData}
                onBack={() => setShowSidebar(true)}
                onSearchToggle={() => setShowSearch((v) => !v)}
                activeUsers={participantsForHeader}
                totalUsers={totalUsers || undefined}
                onPresenceToggle={() => setPresenceOpen((v) => !v)}
                participants={participantsForHeader}
              />
              {presenceOpen && (
                <div className="absolute right-4 top-[calc(100%+8px)] z-40 w-80 rounded-xl border border-gray-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <div className="text-sm font-semibold">Room participants</div>
                    <button onClick={() => setPresenceOpen(false)} className="px-2 py-1 rounded-lg hover:bg-gray-100">×</button>
                  </div>
                  <div className="p-3 space-y-4 text-sm">
                    <div>
                      <div className="text-xs font-semibold text-green-700">Online (active here)</div>
                      {onlineList.length ? (
                        <ul className="mt-1 space-y-1">
                          {onlineList.map((u) => (
                            <li key={`on-${u.id || u.role}`} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="font-medium">{u.name}</span>
                              <span className="text-xs text-gray-500">— {u.role}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <div className="mt-1 text-xs text-gray-500">No one active</div>}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-amber-700">Away (online, not in this room)</div>
                      {awayList.length ? (
                        <ul className="mt-1 space-y-1">
                          {awayList.map((u) => (
                            <li key={`aw-${u.id || u.role}`} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="font-medium">{u.name}</span>
                              <span className="text-xs text-gray-500">— {u.role}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <div className="mt-1 text-xs text-gray-500">No one away</div>}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700">Offline</div>
                      {offlineList.length ? (
                        <ul className="mt-1 space-y-1">
                          {offlineList.map((u) => (
                            <li key={`off-${u.id || u.role}`} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-gray-300" />
                              <span className="font-medium">{u.name}</span>
                              <span className="text-xs text-gray-500">— {u.role}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <div className="mt-1 text-xs text-gray-500">No one offline</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {showSearch && (
            <div className="px-4 pt-2 z-10 animate-slide-down">
              <SearchBar messages={messages} onClose={() => setShowSearch(false)} onResultSelect={handleSearchResultSelect} />
            </div>
          )}

          {notifications.length > 0 && (
            <div className="px-4 pt-3 space-y-2 z-10">
              {notifications.map((notif) => (
                <InlineNotification
                  key={notif.id}
                  notification={notif}
                  onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
                />
              ))}
            </div>
          )}

          {active?.isClosed && (
            <div className="z-10 border-b px-4 py-3 flex items-center justify-between gap-2 bg-gray-100 border-gray-200">
              <div className="text-sm text-gray-700">This room is closed.</div>
              {!reopenRequested ? (
                <button onClick={handleRequestReopen} className="px-4 py-2 text-sm font-medium rounded-lg transition text-white bg-black hover:bg-gray-800">
                  Request to Reopen
                </button>
              ) : (
                <span className="text-sm rounded-lg px-3 py-1.5 border text-green-700 bg-green-50 border-green-200">
                  Request sent
                </span>
              )}
            </div>
          )}

          <div
            ref={scrollerRef}
            className="flex-1 overflow-y-auto px-4 py-4 relative z-10"
            onContextMenu={handleContextMenu}
          >
            {activeRoomId && active?.hasRoom ? (
              groupMessagesByDate(messages).map((group, idx) => (
                <div key={idx} className="mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="border shadow-sm rounded-full px-4 py-1.5 text-xs font-medium bg-white border-gray-200 text-gray-600">
                      {group.date}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {group.messages.map((m) =>
                      m.inlineNotice ? (
                        <InlineNotice key={m._id} text={m.noticeText} />
                      ) : (
                        <div key={m._id} ref={(el) => (messageRefs.current[m._id] = el)}>
                          <MessageBubble
                            message={m}
                            highlighted={highlightedMessageId === m._id}
                            onRetry={m.deliveryStatus === "failed" ? () => retrySend(m.clientNonce) : undefined}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full w-full grid place-items-center text-black/60">
                Waiting for a PM to join — we’ll connect you automatically.
              </div>
            )}
          </div>

          {typingText && header.status !== "Closed" && (
            <div className="px-4 pb-2 z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs bg-white border-gray-200 text-gray-600">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                {typingText}
              </div>
            </div>
          )}

          <div className="border-t px-3 md:px-4 py-2 bg-white border-gray-200 z-10">
            <ChatInput onSendMessage={onSend} onTypingChange={onTypingChange} typingText="" disabled={Boolean(active?.isClosed)} />
            <div className="mt-1 h-6" />
          </div>

          {unreadCount > 0 && !isAtBottom && (
            <UnreadMessagesIndicator count={unreadCount} onClick={scrollToBottom} />
          )}
        </section>
      </div>

      {ratingOpen && requestIdForRating && (
        <RatingModal
          requestId={requestIdForRating}
          roomId={activeRoomId}
          onClose={() => setRatingOpen(false)}
          onRated={() => { setHasRated(true); setRatingOpen(false); setToast({ text: "Thanks for the feedback!", kind: "ok" }); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70]">
          <div className="rounded-xl border border-black/10 bg-white px-4 py-2 shadow">
            <span className="text-sm text-black">{toast.text}</span>
          </div>
        </div>
      )}

      <ContextMenu
        open={menuOpen}
        x={menuPos.x}
        y={menuPos.y}
        items={contextMenuItems}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}

async function waitForSocketConnected(s, timeout = 4000) {
  return new Promise((resolve, reject) => {
    if (!s) return reject(new Error("No socket"));
    if (s.connected) return resolve(true);
    const to = setTimeout(() => { s.off("connect", on); reject(new Error("Socket connect timeout")); }, timeout);
    const on = () => { clearTimeout(to); s.off("connect", on); resolve(true); };
    s.on("connect", on);
  });
}
