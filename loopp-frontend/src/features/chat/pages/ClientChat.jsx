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

// shared UI
import ConversationList from "@/features/chat/components/ConversationList";
import ChatHeader from "@/features/chat/components/ChatHeader";
import ChatInput from "@/features/chat/components/ChatInput";
import MessageBubble from "@/features/chat/components/MessageBubble";

// ui helpers
import SearchBar from "@/features/chat/components/SearchBar";
import InlineNotification from "@/features/chat/components/InlineNotification";
import ChatBackground from "@/features/chat/components/ChatBackground";
import UnreadMessagesIndicator from "@/features/chat/components/UnreadMessagesIndicator";
import RatingModal from "../components/RatingModal";

/* -------------------------------------------------------------------------- */
/*                               tiny primitives                              */
/* -------------------------------------------------------------------------- */

// Minimal portal (no external deps)
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
      try {
        document.body.removeChild(elRef.current);
      } catch {}
    };
  }, []);
  if (!mounted) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {children}
    </div>
  );
}

// Viewport-bounded context menu (fixes overflow issues)
function ContextMenu({ open, x, y, items, onClose }) {
  const menuRef = useRef(null);

  // bound within viewport
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) return;
      const { innerWidth: W, innerHeight: H } = window;
      const rect = menu.getBoundingClientRect();
      let nx = x;
      let ny = y;
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
        style={{
          position: "fixed",
          left: pos.left,
          top: pos.top,
          pointerEvents: "auto",
        }}
        className="min-w-44 max-w-[70vw] rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
      >
        <ul className="py-1">
          {items.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => {
                  it.onClick?.();
                  onClose?.();
                }}
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

/* -------------------------------------------------------------------------- */
/*                                tiny helpers                                */
/* -------------------------------------------------------------------------- */

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

const shapeForClient = (m) => {
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

  return {
    _id: m._id || m.id || `${Date.now()}-${Math.random()}`,
    room: String(m.room?._id || m.room || ""),
    content: m.text || m.content || "",
    timestamp: new Date(created).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    createdAtISO: new Date(created).toISOString(),
    isMine: mine,
    senderRole: role || "Client",
    senderName,
    attachments,
    bubbleTheme: roleToTheme(role || "", mine),
  };
};

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
    const sig = msgSignature(incoming);
    if (prev.some((x) => x._id === incoming._id || msgSignature(x) === sig))
      return prev;
    return [...prev, incoming];
  });
}

function previewText(m) {
  if (m.attachments?.length && !m.content)
    return `📎 ${m.attachments.length} attachment(s)`;
  return m.content || "—";
}

/* ---------- date grouping for separators (UI-only) --- */
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

/* ----- Inline dashed notices (presence banners) ---- */
function InlineNotice({ text }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <div className="w-full text-center text-[11px] md:text-xs tracking-wide text-black/65">
        {"—".repeat(6)} <span className="font-semibold uppercase">{text}</span>{" "}
        {"—".repeat(6)}
      </div>
    </div>
  );
}
function noticeFromSystemEvent(ev = {}) {
  const type = String(ev.type || "").toLowerCase();
  const eng = ev.engineer || {};
  const engName = [eng.firstName, eng.lastName].filter(Boolean).join(" ").trim();

  switch (type) {
    case "pm_assigned":
      return "A PM HAS BEEN ASSIGNED";
    case "pm_online":
      return "PM IS ACTIVELY ONLINE";
    case "pm_assigned_engineer":
      return `PM HAS ASSIGNED THE PROJECT TO AN ENGINEER${
        engName ? ` — (${engName})` : ""
      }`;
    case "engineer_accepted":
      return "ENGINEER HAS ACCEPTED THE TASK AND WILL BE JOINING THE ROOM";
    case "engineer_joined":
    case "engineer_online":
      return "ENGINEER IS IN THE ROOM";
    default:
      return "";
  }
}

/* ---------------------- tiny toast ---------------------- */
function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast];
}

/* ------------------ Rating UI (kept) ------------------ */
function Stars({ value, onChange, label }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-black/60">{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-full border border-black/20 grid place-items-center transition
              ${
                value >= n
                  ? "bg-black text-white"
                  : "bg-white hover:bg-black/[0.05]"
              }`}
            aria-label={`${label}: ${n} star${n > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
function RatingSheet({ requestId, onClose, onRated }) {
  const [pmScore, setPmScore] = useState(0);
  const [engScore, setEngScore] = useState(0);
  const [teamScore, setTeamScore] = useState(0);
  const [pmComment, setPmComment] = useState("");
  const [engComment, setEngComment] = useState("");
  const [coordComment, setCoordComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit =
    pmScore > 0 &&
    engScore > 0 &&
    teamScore > 0 &&
    pmComment.trim() &&
    engComment.trim() &&
    coordComment.trim();

  const submit = async () => {
    if (!canSubmit) {
      setErr("Please rate each category (1–5) and provide all three comments.");
      return;
    }
    try {
      setSubmitting(true);
      setErr("");
      await Projects.rate({
        requestId,
        pmScore,
        pmComment,
        engineerScore: engScore,
        engineerComment: engComment,
        coordinationScore: teamScore,
        coordinationComment: coordComment,
      });
      onRated?.();
    } catch (e) {
      setErr(
        e?.response?.data?.message || e?.message || "Failed to submit rating"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] md:left-[max(0px,calc(50%-44rem))] md:right-[max(0px,calc(50%-44rem))] bg-white border-t border-black/10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-slide-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-lg font-semibold text-black">Rate your experience</h4>
            <p className="text-sm text-black/60">
              Please rate your Project Manager, Engineer, and Teamwork.
              Comments are required.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-black/20 hover:bg-black/[0.03]"
            aria-label="Close rating"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5">
          <Stars label="PM" value={pmScore} onChange={setPmScore} />
          <Stars label="Engineer" value={engScore} onChange={setEngScore} />
          <Stars label="Teamwork" value={teamScore} onChange={setTeamScore} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div>
            <div className="text-xs text-black/60 mb-2">PM Comment</div>
            <textarea
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-black/20"
              value={pmComment}
              onChange={(e) => setPmComment(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs text-black/60 mb-2">Engineer Comment</div>
            <textarea
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-black/20"
              value={engComment}
              onChange={(e) => setEngComment(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs text-black/60 mb-2">Teamwork Comment</div>
            <textarea
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-black/20"
              value={coordComment}
              onChange={(e) => setCoordComment(e.target.value)}
            />
          </div>
        </div>

        {err && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {err}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit Rating"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- presence utilities --------------------------- */
/**
 * Three-state presence:
 * - ONLINE: actively in this room
 * - AWAY: online but not in this room
 * - OFFLINE: not online
 *
 * We track presence by room with a small member list. Each item:
 *   { id: "PM"|"Engineer"|"Client"|string, role, name, status }
 */
const STATUS_ONLINE = "online";
const STATUS_AWAY = "away";
const STATUS_OFFLINE = "offline";

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
  const members = cur.members.map((m) =>
    (m.id || m.role) === idKey ? { ...m, status } : m
  );
  return { ...map, [roomId]: { members } };
}

function ensureSeedParticipants(map, roomId, meta) {
  let next = { ...map };
  // Always seed client (You) => ONLINE in this room
  next = upsertMember(next, roomId, "Client", "Client", "You", STATUS_ONLINE);

  // Seed PM/Engineer as AWAY by default (online but not yet active in this room)
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

/* ----------------------- main component ----------------------- */
export default function ClientChat() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);

  const [header, setHeader] = useState({
    name: "Chat",
    status: "Online",
    avatar: "",
  });
  const [messages, setMessages] = useState([]);

  const [typingByRoom, setTypingByRoom] = useState({});
  const [toast, setToast] = useToast();

  const [ratingOpen, setRatingOpen] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [reopenRequested, setReopenRequested] = useState(false);

  // UI
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Presence (role-keyed & 3-state)
  const [presenceByRoom, setPresenceByRoom] = useState({});
  const [presenceOpen, setPresenceOpen] = useState(false);

  // Context menu
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const lastRightClickText = useRef("");

  const scrollerRef = useRef(null);
  const atBottomRef = useRef(true);
  const lastCountRef = useRef(0);
  const messageRefs = useRef({});

  const typingText = useMemo(() => {
    if (!activeRoomId) return "";
    const map = typingByRoom[activeRoomId] || {};
    const others = Object.values(map);
    if (!others.length) return "";
    const first = others[0];
    const label = first.role || "PM/Engineer";
    return others.length === 1
      ? `${label} is typing…`
      : `${label} and ${others.length - 1} other(s) are typing…`;
  }, [typingByRoom, activeRoomId]);

  /* ------------------ typing expiry ticker ------------------ */
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
              // decay presence to AWAY (not OFFLINE) when typing expires
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
        setLoading(true);
        setErr("");

        const data = await fetchMyClientRooms();
        const list = Array.isArray(data?.rooms) ? data.rooms : [];
        list.sort(
          (a, b) =>
            new Date(b.updatedAtISO || b.updatedAt) -
            new Date(a.updatedAtISO || a.updatedAt)
        );
        setRooms(list);

        const firstReal = list.find((r) => r.hasRoom);
        setActiveRoomId(firstReal?.id || null);
      } catch (e) {
        setErr(
          e?.response?.data?.message || e?.message || "Failed to load rooms"
        );
      } finally {
        setLoading(false);
      }
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
        setErr("");

        const res = await fetchClientRoomMessages(activeRoomId, { limit: 100 });
        const shaped = (res?.messages || []).map(shapeForClient);
        setMessages(shaped);

        // Room meta – seed participants (PM/Engineer if available) + Client (You)
        let roomMeta = {};
        try {
          const metaRes = await Projects.getRoomMeta(activeRoomId);
          roomMeta = metaRes?.data?.room || metaRes?.room || metaRes || {};
        } catch {}

        setPresenceByRoom((prev) => {
          // Client = ONLINE, PM/Engineer = AWAY by default
          let next = ensureSeedParticipants(prev, activeRoomId, roomMeta);
          return next;
        });

        // header + reopen flag
        let closed = Boolean(
          active?.isClosed === true || active?.isClosed === "true"
        );
        let reopen = !!roomMeta?.reopenRequested;
        if (typeof roomMeta?.isClosed === "boolean") closed = roomMeta.isClosed;

        setHeader({
          name: shortName(active?.title || "Project Chat"),
          status: closed ? "Closed" : "Online",
          avatar: "",
        });
        setReopenRequested(reopen);

        // scroller & scroll listener
        const el = scrollerRef.current;
        if (el) {
          const onScroll = () => {
            const threshold = 120;
            const atBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
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
          unsub = () => {
            try {
              el.removeEventListener("scroll", onScroll);
            } catch {}
          };
        }

        const s = connectSocket();
        await waitForSocketConnected(getSocket());
        await joinSocketRoom(activeRoomId);

        // message
        const onMessage = (m) => {
          const rid = String(m.room?._id || m.room);
          const shapedMsg = shapeForClient(m);

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

          safeAppend(setMessages, shapedMsg);

          if (atBottomRef.current || shapedMsg.isMine) {
            requestAnimationFrame(() => {
              scrollerRef.current?.scrollTo({
                top: scrollerRef.current.scrollHeight,
                behavior: "smooth",
              });
              setIsAtBottom(true);
              setUnreadCount(0);
            });
          } else {
            setUnreadCount((c) => c + 1);
          }
        };

        // typing -> mark role ONLINE in this room; decay to AWAY via ticker above
        const onTyping = ({ roomId, role, isTyping, name }) => {
          const displayRole = normalizeRole(role) || "PM/Engineer";
          if (String(roomId) !== String(activeRoomId)) return;

          setTypingByRoom((prev) => {
            const map = { ...(prev[roomId] || {}) };
            const key = displayRole; // stable key by role
            if (isTyping) map[key] = { role: displayRole, until: Date.now() + 2500 };
            else delete map[key];
            return { ...prev, [roomId]: map };
          });

          if (isTyping) {
            const idKey = displayRole;
            setPresenceByRoom((prev) =>
              upsertMember(
                prev,
                activeRoomId,
                idKey,
                displayRole,
                name || displayRole,
                STATUS_ONLINE
              )
            );
          }
        };

        // system events: update inline notices + presence states
        const onSystem = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          const type = String(payload.type || "").toLowerCase();
          const pm = payload.pm || payload.user || {};
          const eng = payload.engineer || {};

          // inline banner only for this room
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
                  scrollerRef.current?.scrollTo({
                    top: scrollerRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                });
              }
            }
          }

          // presence updates (role-keyed)
          setPresenceByRoom((prev) => {
            let next = { ...prev };
            const pmName = [pm?.firstName, pm?.lastName].filter(Boolean).join(" ").trim() || "PM";
            const engName = [eng?.firstName, eng?.lastName].filter(Boolean).join(" ").trim() || "Engineer";

            if (!rid || rid === String(activeRoomId)) {
              if (type === "pm_assigned") {
                // PM exists but may not be in the room yet -> AWAY
                next = upsertMember(next, activeRoomId, "PM", "PM", pmName, STATUS_AWAY);
              }
              if (type === "pm_online") {
                // When we do receive it (if broadcast), consider ACTIVE in room now
                next = upsertMember(next, activeRoomId, "PM", "PM", pmName, STATUS_ONLINE);
              }
              if (type === "pm_assigned_engineer" || type === "engineer_joined") {
                next = upsertMember(next, activeRoomId, "Engineer", "Engineer", engName, STATUS_ONLINE);
              }
              if (type === "engineer_online") {
                next = upsertMember(next, activeRoomId, "Engineer", "Engineer", engName, STATUS_ONLINE);
              }
            }
            return next;
          });
        };

        const onRoomClosed = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;

          setRooms((prev) =>
            prev.map((r) =>
              String(r.id) === String(activeRoomId) ? { ...r, isClosed: true } : r
            )
          );
          setHeader((h) => ({ ...h, status: "Closed" }));
          setToast({ text: "This room has been closed.", kind: "warn" });
          setNotifications((n) => [
            ...n,
            {
              id: `notif-${Date.now()}`,
              type: "warning",
              message: "Room closed",
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ]);
        };

        const onRoomReopened = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;

          setRooms((prev) =>
            prev.map((r) =>
              String(r.id) === String(activeRoomId) ? { ...r, isClosed: false } : r
            )
          );
          setReopenRequested(false);
          setHeader((h) => ({ ...h, status: "Online" }));
          setToast({ text: "This room has been reopened.", kind: "ok" });
          setNotifications((n) => [
            ...n,
            {
              id: `notif-${Date.now()}`,
              type: "success",
              message: "Room reopened",
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ]);
        };

        const onReopenRequested = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;
          setReopenRequested(true);
          setToast({ text: "Reopen request sent.", kind: "ok" });
          setNotifications((n) => [
            ...n,
            {
              id: `notif-${Date.now()}`,
              type: "success",
              message: "Reopen request sent",
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
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
                ? {
                    ...r,
                    lastMessage: `${pmName} has been assigned as your PM. They’ll join shortly.`,
                    updatedAtISO: payload?.at || new Date().toISOString(),
                  }
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
            if (last?.inlineNotice && last.noticeText === inline.noticeText)
              return prev;
            return [...prev, inline];
          });

          // PM appears as AWAY (until they type / join)
          setPresenceByRoom((prev) =>
            upsertMember(prev, activeRoomId, "PM", "PM", pmName, STATUS_AWAY)
          );

          if (atBottomRef.current) {
            requestAnimationFrame(() => {
              scrollerRef.current?.scrollTo({
                top: scrollerRef.current.scrollHeight,
                behavior: "smooth",
              });
            });
          }
        };

        // de-dup
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
  }, [activeRoomId, rooms]);

  /* ----- ensure "You" is ONLINE when switching rooms ----- */
  useEffect(() => {
    if (!activeRoomId) return;
    setPresenceByRoom((prev) => setStatus(prev, activeRoomId, "Client", STATUS_ONLINE));
    setPresenceOpen(false);
  }, [activeRoomId]);

  /* ----- unread & autoscroll on change ----- */
  useEffect(() => {
    if (!scrollerRef.current) return;
    const count = messages.length;
    const added = count - (lastCountRef.current || 0);
    if (added > 0 && !isAtBottom) setUnreadCount((c) => c + added);
    lastCountRef.current = count;
  }, [messages, isAtBottom]);

  /* ------------------------------- actions ------------------------------ */
  const onSend = async (text, files = []) => {
    const active = rooms.find((r) => r.id === activeRoomId);
    if (!activeRoomId || !active?.hasRoom || active?.isClosed || header.status === "Closed") return;

    const trimmed = (text || "").trim();

    if (trimmed === "/rate") {
      try {
        const metaRes = await Projects.getRoomMeta(activeRoomId);
        const pr = metaRes?.data?.project || metaRes?.project || {};
        const status = String(pr?.status || "").toLowerCase();
        const already = !!pr?.hasRatings || hasRated;

        if (status !== "review") {
          setToast({ text: "You can only rate when the project is in Review.", kind: "warn" });
          return;
        }
        if (already) {
          setToast({ text: "You’ve already submitted a rating.", kind: "error" });
          return;
        }
        setRatingOpen(true);
      } catch {
        setToast({ text: "Unable to open rating right now.", kind: "error" });
      }
      return;
    }

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
    const hasFiles = fileArray.length > 0;

    if (!trimmed && !hasFiles) {
      setErr("Please type a message or attach a file.");
      return;
    }

    try {
      const res = await sendClientRoomMessage(activeRoomId, {
        text: trimmed,
        files: fileArray,
      });

      if (res?.message) {
        const shaped = shapeForClient(res.message);
        safeAppend(setMessages, shaped);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === activeRoomId
              ? {
                  ...r,
                  lastMessage: previewText(shaped),
                  updatedAtISO: new Date().toISOString(),
                }
              : r
          )
        );

        requestAnimationFrame(() => {
          scrollerRef.current?.scrollTo({
            top: scrollerRef.current.scrollHeight,
            behavior: "smooth",
          });
          setIsAtBottom(true);
          setUnreadCount(0);
        });
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to send");
    }
  };

  const onTypingChange = (isTyping) => {
    const s = getSocket();
    const active = rooms.find((r) => r.id === activeRoomId);
    if (!s || !activeRoomId || header.status === "Closed" || active?.isClosed) return;
    s.emit("typing", {
      roomId: activeRoomId,
      userId: "client",
      role: "Client",
      isTyping: !!isTyping,
      name: "Client",
    });
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
        {
          id: `notif-${Date.now()}`,
          type: "success",
          message: "Reopen request sent",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (e) {
      setToast({
        text:
          e?.response?.data?.message || e?.message || "Failed to request reopen",
        kind: "error",
      });
    }
  };

  const handleSearchResultSelect = (index) => {
    const flat = messages;
    const m = flat[index];
    if (!m) return;
    setHighlightedMessageId(m._id);
    const node = messageRefs.current[m._id];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  /* ----------------------- context menu handlers ----------------------- */
  const handleContextMenu = (e) => {
    e.preventDefault();
    const sel = window.getSelection?.();
    const selectedText = sel && String(sel.toString()).trim();
    lastRightClickText.current =
      selectedText ||
      (e.target?.innerText ? String(e.target.innerText).trim().slice(0, 2000) : "");
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  const contextMenuItems = [
    {
      id: "copy-text",
      label: "Copy selected text",
      onClick: () => {
        const sel = window.getSelection?.();
        const s = sel && String(sel.toString());
        if (s) navigator.clipboard?.writeText(s);
      },
    },
    {
      id: "copy-msg",
      label: "Copy message",
      onClick: () => {
        const t = lastRightClickText.current || "";
        if (t) navigator.clipboard?.writeText(t);
      },
    },
    { id: "reply", label: "Reply", onClick: () => {} },
    { id: "delete", label: "Delete (if allowed)", onClick: () => {} },
  ];

  /* --------------------------------- render --------------------------------- */

  if (loading) return <div className="h-screen grid place-items-center">Loading chat…</div>;
  if (err) return <div className="h-screen grid place-items-center text-red-600">{err}</div>;

  if (!rooms.length) {
    return (
      <div className="h-screen grid place-items-center text-black/60">
        No conversations yet — we’ll open one as soon as a PM is assigned.
      </div>
    );
  }

  const active = rooms.find((r) => r.id === activeRoomId);
  const requestIdForRating = active?.requestId;

  // Presence model -> participants for header
  const members = (presenceByRoom[activeRoomId]?.members || []);
  const totalUsers = members.length;

  const participantsForHeader = members.map((m) => ({
    id: m.id || m.role,
    name: m.name,
    role: m.role,
    // Map our 3-state to ChatHeader expectations:
    isOnline: m.status !== STATUS_OFFLINE,   // online or away
    inRoom: m.status === STATUS_ONLINE,      // active in this room
  }));

  // Header data (status line uses typingText when online)
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
      scrollerRef.current.scrollTo({
        top: scrollerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    setIsAtBottom(true);
    setUnreadCount(0);
  };

  return (
    <div className="h-screen flex flex-col bg-white text-black">
      {/* Fixed minimal top bar (brand/back) */}
      <div className="flex-none h-12 md:h-14 w-full border-b z-40 bg-white border-gray-200">
        <div className="h-full max-w-[1920px] mx-auto px-3 md:px-4 flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition hover:bg-gray-100"
            title="Back"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="hidden sm:inline">Back</span>
          </a>
          <div className="text-sm font-medium text-gray-600">Client Chat</div>
          <button
            onClick={() => setShowSidebar(true)}
            className="sm:hidden px-3 py-1.5 text-sm font-medium rounded-lg transition hover:bg-gray-100"
          >
            Rooms
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <div
              className="absolute inset-0 bg-black/40 animate-fade-in"
              onClick={() => setShowSidebar(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-[85%] max-w-sm shadow-2xl flex flex-col animate-slide-left bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                <h2 className="font-semibold">Conversations</h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-2 rounded-lg text-xl leading-none hover:bg-gray-100"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                <ConversationList
                  conversations={rooms.map((r) => ({
                    id: r.id,
                    name: shortName(r.title),
                    avatar: "",
                    lastMessage: r.lastMessage || "",
                    time: new Date(r.updatedAtISO || r.updatedAt || Date.now()).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    unreadCount: 0,
                    isOnline: !r.isClosed,
                    isPinned: false,
                    typing: !!typingByRoom[r.id] && Object.keys(typingByRoom[r.id]).length > 0,
                  }))}
                  activeConversationId={activeRoomId}
                  onConversationSelect={(id) => {
                    setActiveRoomId(id);
                    setShowSidebar(false);
                  }}
                  loading={false}
                  error={""}
                />
              </div>
            </aside>
          </div>
        )}

        {/* Desktop Sidebar */}
        <aside className="hidden sm:flex w-80 lg:w-96 flex-col border-r border-gray-200 bg-white">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold">Conversations</h2>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ConversationList
              conversations={rooms.map((r) => ({
                id: r.id,
                name: shortName(r.title),
                avatar: "",
                lastMessage: r.lastMessage || "",
                time: new Date(r.updatedAtISO || r.updatedAt || Date.now()).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
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

        {/* Chat Area */}
        <section className="relative flex-1 flex flex-col overflow-hidden bg-gray-50">
          {/* Non-scrolling background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <ChatBackground variant="client" />
          </div>

          {/* Chat Header */}
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
                    <button
                      onClick={() => setPresenceOpen(false)}
                      className="px-2 py-1 rounded-lg hover:bg-gray-100"
                    >
                      ×
                    </button>
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
                      ) : (
                        <div className="mt-1 text-xs text-gray-500">No one active</div>
                      )}
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
                      ) : (
                        <div className="mt-1 text-xs text-gray-500">No one away</div>
                      )}
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
                      ) : (
                        <div className="mt-1 text-xs text-gray-500">No one offline</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="px-4 pt-2 z-10 animate-slide-down">
              <SearchBar
                messages={messages}
                onClose={() => setShowSearch(false)}
                onResultSelect={handleSearchResultSelect}
              />
            </div>
          )}

          {/* Inline Notifications */}
          {notifications.length > 0 && (
            <div className="px-4 pt-3 space-y-2 z-10">
              {notifications.map((notif) => (
                <InlineNotification
                  key={notif.id}
                  notification={notif}
                  onDismiss={(id) =>
                    setNotifications((prev) => prev.filter((n) => n.id !== id))
                  }
                />
              ))}
            </div>
          )}

          {/* Room Status Banner */}
          {active?.isClosed && (
            <div className="z-10 border-b px-4 py-3 flex items-center justify-between gap-2 bg-gray-100 border-gray-200">
              <div className="text-sm text-gray-700">This room is closed.</div>
              {!reopenRequested ? (
                <button
                  onClick={handleRequestReopen}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition text-white bg-black hover:bg-gray-800"
                >
                  Request to Reopen
                </button>
              ) : (
                <span className="text-sm rounded-lg px-3 py-1.5 border text-green-700 bg-green-50 border-green-200">
                  Request sent
                </span>
              )}
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={scrollerRef}
            className="flex-1 overflow-y-auto px-4 py-4 relative z-10"
            onContextMenu={handleContextMenu}
          >
            {activeRoomId && active?.hasRoom ? (
              groupMessagesByDate(messages).map((group, idx) => (
                <div key={idx} className="mb-6">
                  {/* Date Separator */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="border shadow-sm rounded-full px-4 py-1.5 text-xs font-medium bg-white border-gray-200 text-gray-600">
                      {group.date}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="space-y-1">
                    {group.messages.map((m) =>
                      m.inlineNotice ? (
                        <InlineNotice key={m._id} text={m.noticeText} />
                      ) : (
                        <div key={m._id} ref={(el) => (messageRefs.current[m._id] = el)}>
                          <MessageBubble message={m} highlighted={highlightedMessageId === m._id} />
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

          {/* Typing Indicator */}
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

          {/* Composer */}
          <div className="border-t px-3 md:px-4 py-2 bg-white border-gray-200 z-10">
            <ChatInput
              onSendMessage={onSend}
              onTypingChange={onTypingChange}
              typingText=""
              disabled={Boolean(active?.isClosed)}
            />
            <div className="mt-1 h-6" />
          </div>

          {/* Unread Messages CTA */}
          {unreadCount > 0 && !isAtBottom && (
            <UnreadMessagesIndicator count={unreadCount} onClick={scrollToBottom} />
          )}
        </section>
      </div>

      {/* Rating modal (new) */}
      {ratingOpen && requestIdForRating && (
        <RatingModal
          requestId={requestIdForRating}
          roomId={activeRoomId} // lets the modal validate status=Review & not already rated
          onClose={() => setRatingOpen(false)}
          onRated={() => {
            setHasRated(true);
            setRatingOpen(false);
            setToast({ text: "Thanks for the feedback!", kind: "ok" });
          }}
        />
      )}

      {/* Tiny toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70]">
          <div className="rounded-xl border border-black/10 bg-white px-4 py-2 shadow">
            <span className="text-sm text-black">{toast.text}</span>
          </div>
        </div>
      )}

      {/* Viewport-bounded context menu (portal) */}
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

/* --------------------------- socket ready helper --------------------------- */
async function waitForSocketConnected(s, timeout = 4000) {
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
