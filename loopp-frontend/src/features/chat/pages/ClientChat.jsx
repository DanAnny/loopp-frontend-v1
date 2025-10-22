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

/* ----------------------- helpers ----------------------- */
const shortName = (s, m = 28) => {
  const t = (s || "").toString().trim();
  return t.length <= m ? t : t.slice(0, m - 1) + "…";
};

const STAFF_ROLES = ["SuperAdmin", "Admin", "PM", "Engineer"];
const norm = (r = "") => (r || "").toString();
const normalizeRole = (r = "") => {
  const s = norm(r);
  if (/super\s*admin/i.test(s)) return "SuperAdmin";
  if (/admin/i.test(s) && !/super/i.test(s)) return "Admin";
  if (/pm|project\s*manager/i.test(s)) return "PM";
  if (/engineer/i.test(s)) return "Engineer";
  return "";
};
const isStaff = (role) => STAFF_ROLES.includes(role);

const roleToTheme = (role, isMine) => {
  if (isMine) return "me";
  if (role === "SuperAdmin") return "superadmin";
  if (role === "Admin") return "admin";
  if (role === "PM") return "pm";
  if (role === "Engineer") return "engineer";
  return "client";
};

// Detect & shape for normal messages (including System-persisted)
const shapeForClient = (m) => {
  const created = m.createdAt || m.createdAtISO || m.timestamp || new Date().toISOString();
  const attachments = Array.isArray(m.attachments) ? m.attachments : [];

  // Persisted system messages (senderType === "System") render as inline notices
  if (String(m.senderType || "").toLowerCase() === "system") {
    return {
      _id: m._id || `${Date.now()}-${Math.random()}`,
      room: String(m.room?._id || m.room || ""),
      inlineNotice: true,
      noticeText: m.text || m.content || "",
      createdAtISO: new Date(created).toISOString(),
    };
  }

  const rawRole = m.senderRole || m.role || (m.sender && (m.sender.role || m.sender.type)) || "";
  const role = normalizeRole(rawRole);
  const mine = !isStaff(role);

  const senderName =
    m.senderName ||
    (mine
      ? "You"
      : (m.sender && [m.sender.firstName, m.sender.lastName].filter(Boolean).join(" ")) ||
        role ||
        "PM/Engineer");

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
    bubbleTheme: roleToTheme(role, mine),
  };
};

const msgSignature = (m) =>
  [
    String(m.room || ""),
    String(m.inlineNotice ? "sys" : m.senderRole || ""),
    String(m.inlineNotice ? "0" : m.isMine ? "1" : "0"),
    (m.inlineNotice ? m.noticeText : m.content || "").slice(0, 200),
    (m.createdAtISO || "").slice(0, 19),
    m.inlineNotice ? "0" : String(Array.isArray(m.attachments) ? m.attachments.length : 0),
  ].join("|");

function safeAppend(setMessages, incoming) {
  setMessages((prev) => {
    const sig = msgSignature(incoming);
    if (prev.some((x) => x._id === incoming._id || msgSignature(x) === sig)) return prev;
    return [...prev, incoming];
  });
}

function previewText(m) {
  if (m.inlineNotice) return m.noticeText;
  if (m.attachments?.length && !m.content) return `📎 ${m.attachments.length} attachment(s)`;
  return m.content || "—";
}

/* ------------------ Inline notice UI ------------------ */
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
    case "pm_assigned":
      return "----- A PM HAS BEEN ASSIGNED -----";
    case "pm_online":
      return "----- PM IS ACTIVELY ONLINE -----";
    case "pm_assigned_engineer":
      return `----- PM HAS ASSIGNED THE PROJECT TO AN ENGINEER${engName ? ` — (${engName})` : ""} -----`;
    case "engineer_accepted":
      return "----- ENGINEER HAS ACCEPTED THE TASK AND WILL BE JOINING THE ROOM -----";
    case "engineer_joined":
    case "engineer_online":
      return "----- ENGINEER IS IN THE ROOM -----";
    case "inline":
      return ev.text || "";
    default:
      return "";
  }
}

/* ------------------ Rating UI ------------------ */
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
              ${value >= n ? "bg-black text-white" : "bg-white hover:bg-black/[0.05]"}`}
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
      setErr(e?.response?.data?.message || e?.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] md:left-[max(0px,calc(50%-44rem))] md:right-[max(0px,calc(50%-44rem))]
                 bg-white border-t border-black/10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
      role="dialog"
      aria-modal="true"
    >
      <div className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-lg font-semibold text-black">Rate your experience</h4>
            <p className="text-sm text-black/60">
              Please rate your Project Manager, Engineer, and Teamwork. Comments are required.
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

/* ---------------------- tiny toast (auto-dismiss) ---------------------- */
function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast];
}

/* ----------------------- component ----------------------- */
export default function ClientChat() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);

  const [header, setHeader] = useState({ name: "Chat", status: "Online", avatar: "" });
  const [messages, setMessages] = useState([]);

  const [typingByRoom, setTypingByRoom] = useState({});
  const [toast, setToast] = useToast();

  // rating sheet state
  const [ratingOpen, setRatingOpen] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  // reopen state for the active room
  const [reopenRequested, setReopenRequested] = useState(false);

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

  const scrollerRef = useRef(null);
  const atBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const threshold = 120;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distanceFromBottom < threshold;
  };

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

  // initial rooms load
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        const data = await fetchMyClientRooms();
        const list = Array.isArray(data?.rooms) ? data.rooms : [];

        list.sort(
          (a, b) =>
            new Date(b.updatedAtISO || b.updatedAt) - new Date(a.updatedAtISO || a.updatedAt)
        );

        setRooms(list);

        const firstReal = list.find((r) => r.hasRoom);
        setActiveRoomId(firstReal?.id || null);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load rooms");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // join room + load messages + listeners
  useEffect(() => {
    if (!activeRoomId) return;
    const active = rooms.find((r) => r.id === activeRoomId);
    if (!active?.hasRoom) return;

    let unsub = () => {};

    (async () => {
      try {
        setErr("");

        const res = await fetchClientRoomMessages(activeRoomId, { limit: 200 });
        const shaped = (res?.messages || []).map(shapeForClient);
        setMessages(shaped);

        let closed = Boolean(active?.isClosed === true || active?.isClosed === "true");
        let reopen = false;
        try {
          const metaRes = await Projects.getRoomMeta(activeRoomId);
          const roomMeta = metaRes?.data?.room || metaRes?.room || {};
          if (typeof roomMeta?.isClosed === "boolean") closed = roomMeta.isClosed;
          reopen = !!roomMeta?.reopenRequested;
        } catch {}

        setHeader({
          name: shortName(active?.title || "Project Chat"),
          status: closed ? "Closed" : "Online",
          avatar: "",
        });
        setReopenRequested(reopen);

        const el = scrollerRef.current;
        if (el) {
          el.addEventListener("scroll", handleScroll, { passive: true });
          requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
            atBottomRef.current = true;
          });
        }

        const s = connectSocket();
        await waitForSocketConnected(getSocket());
        await joinSocketRoom(activeRoomId);

        const onMessage = (m) => {
          const rid = String(m.room?._id || m.room);

          // Shape persisted messages (includes System)
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

          if (atBottomRef.current || shapedMsg.isMine || shapedMsg.inlineNotice) {
            requestAnimationFrame(() => {
              scrollerRef.current?.scrollTo({
                top: scrollerRef.current.scrollHeight,
                behavior: "smooth",
              });
            });
          }
        };

        const onTyping = ({ roomId, userId, role, isTyping }) => {
          if (String(roomId) !== String(activeRoomId)) return;
          const displayRole = normalizeRole(role) || "PM/Engineer";
          setTypingByRoom((prev) => {
            const map = { ...(prev[roomId] || {}) };
            if (isTyping) {
              map[userId] = { role: displayRole, until: Date.now() + 2500 };
            } else {
              delete map[userId];
            }
            return { ...prev, [roomId]: map };
          });
        };

        // For any ephemeral "system" (just in case), mirror as inline (non-persistent)
        const onSystem = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;

          const label = noticeFromSystemEvent(payload);
          if (!label) return;

          const msg = {
            _id: `sys-${payload.type}-${payload.timestamp || Date.now()}-${Math.random()}`,
            room: rid || String(activeRoomId),
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
        };

        const onRoomClosed = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;

          setRooms((prev) =>
            prev.map((r) => (String(r.id) === String(activeRoomId) ? { ...r, isClosed: true } : r))
          );
          setHeader((h) => ({ ...h, status: "Closed" }));
          setToast({ text: "This room has been closed.", kind: "warn" });
        };

        const onRoomReopened = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;

          setRooms((prev) =>
            prev.map((r) => (String(r.id) === String(activeRoomId) ? { ...r, isClosed: false } : r))
          );
          setReopenRequested(false);
          setHeader((h) => ({ ...h, status: "Online" }));
          setToast({ text: "This room has been reopened.", kind: "ok" });
        };

        const onReopenRequested = (payload = {}) => {
          const rid = String(payload.roomId || payload.room || "");
          if (rid && rid !== String(activeRoomId)) return;
          setReopenRequested(true);
          setToast({ text: "Reopen request sent.", kind: "ok" });
        };

        s.off("message", onMessage);
        s.off("typing", onTyping);
        s.off("system", onSystem);
        s.off("room:closed", onRoomClosed);
        s.off("room:reopened", onRoomReopened);
        s.off("reopen:requested", onReopenRequested);

        s.on("message", onMessage);
        s.on("typing", onTyping);
        s.on("system", onSystem);
        s.on("room:closed", onRoomClosed);
        s.on("room:reopened", onRoomReopened);
        s.on("reopen:requested", onReopenRequested);

        unsub = () => {
          try {
            s.off("message", onMessage);
            s.off("typing", onTyping);
            s.off("system", onSystem);
            s.off("room:closed", onRoomClosed);
            s.off("room:reopened", onRoomReopened);
            s.off("reopen:requested", onReopenRequested);
          } catch {}
          if (el) el.removeEventListener("scroll", handleScroll);
        };
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load messages");
      }
    })();

    return () => unsub();
  }, [activeRoomId, rooms]);

  /* -------------------- /rate command -------------------- */
  const onSend = async (text, files = []) => {
    const active = rooms.find((r) => r.id === activeRoomId);
    if (!activeRoomId || !active?.hasRoom || active?.isClosed || header.status === "Closed") return;

    const trimmed = (text || "").trim();

    // Only open rating when status === 'Review' and not previously rated
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
      return; // do not send "/rate" as a message
    }

    // proceed with normal send
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
            r.id === activeRoomId ? { ...r, lastMessage: previewText(shaped), updatedAtISO: new Date().toISOString() } : r
          )
        );
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

  const BackIcon = () => (
    <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

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

  const handleRequestReopen = async () => {
    try {
      const reqId = active?.requestId;
      if (!reqId) throw new Error("Missing request id.");
      await Projects.requestReopen({ requestId: reqId });
      setReopenRequested(true);
      setToast({ text: "Reopen request sent to your PM.", kind: "ok" });
    } catch (e) {
      setToast({ text: e?.response?.data?.message || e?.message || "Failed to request reopen", kind: "error" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {/* Global top bar fixed */}
      <div className="fixed top-0 left-0 right-0 z-40 w-full bg-white/95 border-b border-black/10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-3 md:px-4 h-12 md:h-14 flex items-center justify-between">
          <a
            href="/"
            className="backlink inline-flex items-center gap-2 px-2 py-1 rounded-full text-sm font-medium hover:bg-black/[0.03] focus-visible:bg-black/[0.05] transition"
            title="Back"
          >
            <span className="ico text-black/80">
              <BackIcon />
            </span>
            <span className="hidden sm:inline">Back</span>
          </a>
          <div className="text-sm text-black/60 px-2">Client Chat</div>
        </div>
      </div>

      {/* Spacer for fixed bar */}
      <div className="h-12 md:h-14" />

      {/* -------------- Two-column app area (independent scroll) -------------- */}
      <div className="h-[calc(100vh-48px)] md:h-[calc(100vh-56px)] flex bg-white text-black overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden sm:flex w-80 max-w-[22rem] flex-col border-r border-black/10 overflow-y-auto">
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
        </aside>

        {/* Chat column */}
        <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="sticky top-0 z-30 bg-white border-b border-black/10">
            <ChatHeader
              contact={{
                ...header,
                status: header.status === "Online" ? typingText || "Online" : header.status,
              }}
              onBack={() => {}}
            />
          </div>

          {/* Closed banner */}
          {active?.isClosed && (
            <div className="sticky top-[48px] md:top-[56px] z-20 bg-white/95 border-b border-black/10 px-3 md:px-4 py-2 flex items-center justify-between gap-2">
              <div className="text-sm text-black/60">This room is closed.</div>
              {!reopenRequested ? (
                <button
                  onClick={handleRequestReopen}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white bg-black hover:bg-black/90"
                >
                  Request to Reopen
                </button>
              ) : (
                <span className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                  Request sent
                </span>
              )}
            </div>
          )}

          {/* Messages */}
          <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6 bg-white">
            {activeRoomId && active?.hasRoom ? (
              messages.map((m) =>
                m.inlineNotice ? (
                  <InlineNotice key={m._id} text={m.noticeText} />
                ) : (
                  <MessageBubble key={m._id} message={m} />
                )
              )
            ) : (
              <div className="h-full w-full grid place-items-center text-black/60">
                Waiting for a PM to join — we’ll connect you automatically.
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="sticky bottom-0 border-t border-black/10 bg-white">
            <div className="max-w-6xl mx-auto px-3 md:px-4 py-2">
              <ChatInput
                onSendMessage={onSend}
                onTypingChange={onTypingChange}
                typingText=""
                disabled={Boolean(active?.isClosed)}
              />
              <div className="mt-1 h-6">
                {typingText && header.status !== "Closed" && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1 text-xs text-black/70">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-black/60" />
                    {typingText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Rating sheet */}
      {ratingOpen && requestIdForRating && (
        <RatingSheet
          requestId={requestIdForRating}
          onClose={() => setRatingOpen(false)}
          onRated={() => {
            setHasRated(true);
            setRatingOpen(false);
            setToast({ text: "Thanks for the feedback!", kind: "ok" });
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70]">
          <div className="rounded-xl border border-black/10 bg-white px-4 py-2 shadow">
            <span className="text-sm text-black">{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------- socket helper ----------------------- */
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
