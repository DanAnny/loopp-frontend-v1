// frontend/src/features/chat/pages/Room.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import { connectSocket, getSocket, joinRoom } from "@/lib/socket";
import chatApi from "@/services/chat.service";
import projects from "@/services/projects.service";
// import zoom from "@/services/zoom.service";
import invoices from "@/services/invoice.service";

import ConversationList from "../components/ConversationList";
import ChatHeader from "../components/ChatHeader";
import ChatInput from "../components/ChatInput";
import MessageBubble from "../components/MessageBubble";

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
  m[roomId] = { count: cur + 0, lastReadAt: m[roomId]?.lastReadAt || null };
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
  const s = norm(r);
  if (/super\s*admin/i.test(s)) return "SuperAdmin";
  if (/admin/i.test(s) && !/super/i.test(s)) return "Admin";
  if (/pm|project\s*manager/i.test(s)) return "PM";
  if (/engineer/i.test(s)) return "Engineer";
  if (/client/i.test(s)) return "Client";
  return "User";
}
function roleToTheme(role, isMine) {
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
function normalizeIncoming(m, meId) {
  const senderId =
    typeof m.sender === "string" ? m.sender : m.sender?._id || m.sender?.id || "";
  const isMine = senderId && String(senderId) === String(meId);
  const rawRole =
    m.senderRole || m.role || (m.senderType === "Client" ? "Client" : m.sender?.role || "User");
  const role = normalizeRole(rawRole);

  const senderName =
    m.senderName ||
    (m.sender?.firstName || m.sender?.lastName
      ? [m.sender.firstName, m.sender.lastName].filter(Boolean).join(" ")
      : role);

  const created = m.createdAt || m.createdAtISO || m.timestamp || new Date().toISOString();

  const shaped = {
    _id: m._id || m.id || `${Date.now()}-${Math.random()}`,
    room: m.room?._id || m.room || "",
    content: m.text || m.content || "",
    timestamp: new Date(created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    createdAtISO: new Date(created).toISOString(),
    isMine,
    senderRole: role,
    senderName,
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
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
  ].join("|");
}
function safeAppend(setMessages, incoming) {
  setMessages((prev) => {
    const sig = msgSignature(incoming);
    if (prev.some((x) => x._id === incoming._id || msgSignature(x) === sig)) return prev;
    return [...prev, incoming];
  });
}
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
    unreadCount: 0,
    isOnline: !r.isClosed,
    isPinned: false,
    typing,
  };
};

/* --------------------------------- page --------------------------------- */
export default function Room() {
  const user = useSelector((s) => s.auth.user);
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

  const [messages, setMessages] = useState([]);
  const [typingByRoom, setTypingByRoom] = useState({});
  const [project, setProject] = useState(null);
  const [roomClosed, setRoomClosed] = useState(false);

  // PM actions
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // scroller controls
  const scrollerRef = useRef(null);
  const atBottomRef = useRef(true);

  // prevent page scroll when invoice modal opens
  useEffect(() => {
    if (!showInvoiceModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showInvoiceModal]);

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

        // sort by updated desc
        list.sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
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

        const s = connectSocket(userId);
        await waitForSocketConnected(getSocket());
        await joinRoom(activeRoomId, userId);
        if (cancelled) return;

        // messages
        const { data } = await chatApi.getMessages(activeRoomId);
        const list = Array.isArray(data?.messages) ? data.messages : [];
        const normalized = list.map((m) => normalizeIncoming(m, userId));
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

        if (userRole === "PM") {
          try {
            const resFull = await projects.getByRoom(activeRoomId);
            const full = resFull?.data?.project || {};
            metaProject = {
              ...full,
              _id: full?._id || full?.id || metaProject?._id || null,
              hasRatings: full?.ratings ? true : metaProject?.hasRatings || false,
              reopenRequested: typeof full?.reopenRequested === "boolean"
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
          }
        });

        // wire socket listeners (scoped)
        const onMessage = (msg) => {
          const shaped = normalizeIncoming(msg, userId);
          const rid = String(shaped.room || activeRoomId);

          // update room preview
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

          // handle unread when message is not for active room and not mine
          if (rid !== String(activeRoomId) && !shaped.isMine) {
            incUnread(userId, rid);
            setRooms((prev) =>
              prev.map((r) =>
                r.id === rid ? { ...r, unreadCount: unreadCountFor(userId, rid) } : r
              )
            );
            return;
          }

          // active room → append & maybe scroll
          safeAppend(setMessages, shaped);
          const el = scrollerRef.current;
          if (!el) return;

          // only autoscroll if at bottom or it's our message
          if (atBottomRef.current || shaped.isMine) {
            requestAnimationFrame(() => {
              scrollerRef.current?.scrollTo({
                top: scrollerRef.current.scrollHeight,
                behavior: "smooth",
              });
            });
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

        const onRated = ({ ratings }) =>
          setProject((p) => (p ? { ...p, ratings: ratings || p.ratings, hasRatings: true } : p));

        const onRoomClosed = ({ roomId }) => {
          if (String(roomId) !== String(activeRoomId)) return;
          setRoomClosed(true);
        };
        const onRoomReopened = ({ roomId }) => {
          if (String(roomId) !== String(activeRoomId)) return;
          setRoomClosed(false);
          // when reopened, clear the reopenRequested flag locally
          setProject((p) => (p ? { ...p, reopenRequested: false, status: "In-Progress" } : p));
        };

        // ✅ when client requests reopen, PM should see banner/button appear
        const onReopenRequested = ({ roomId }) => {
          if (String(roomId) !== String(activeRoomId)) return;
          setProject((p) => (p ? { ...p, reopenRequested: true } : p));
        };

        s.off("message", onMessage);
        s.off("typing", onTyping);
        s.off("rated", onRated);
        s.off("room:closed", onRoomClosed);
        s.off("room:reopened", onRoomReopened);
        s.off("reopen:requested", onReopenRequested);

        s.on("message", onMessage);
        s.on("typing", onTyping);
        s.on("rated", onRated);
        s.on("room:closed", onRoomClosed);
        s.on("room:reopened", onRoomReopened);
        s.on("reopen:requested", onReopenRequested);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to join room");
      } finally {
        if (!cancelled) setJoining(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeRoomId, userId, userRole]);

  /* ------------------------------ derived flags ----------------------------- */
  const rated = useMemo(() => {
    if (project?.hasRatings) return true;
    const r = project?.ratings || {};
    return !!(r?.pm?.score && r?.engineer?.score);
  }, [project]);

  const canShowClose = userRole === "PM" && rated && !roomClosed;
  const canShowReopen = userRole === "PM" && roomClosed && !!project?.reopenRequested;

  const typingText = useMemo(() => {
    if (!activeRoomId || roomClosed) return "";
    const others = Object.values(typingByRoom[activeRoomId] || {});
    if (!others.length) return "";
    const first = normalizeRole(others[0].role);
    return others.length === 1 ? `${first} is typing…` : `${first} and ${others.length - 1} other(s) are typing…`;
  }, [typingByRoom, activeRoomId, roomClosed]);

  /* -------------------------------- commands -------------------------------- */
  const commands = useMemo(() => {
    if (userRole !== "PM") return [];
    return [
      { id: "invoice", title: "Generate an invoice", subtitle: "Create a Stripe hosted invoice for this project", hint: "invoice" },
      // { id: "zoom", title: "Create a Zoom meeting link", subtitle: "Instant 30-min meeting", hint: "zoom meeting" },
    ];
  }, [userRole]);

  const handleRunCommand = async (cmd) => {
    try {
      if (!activeRoomId) return;

      if (cmd.id === "invoice") {
        setShowInvoiceModal(true);
        return;
      }

  //     if (cmd.id === "zoom") {
  //       const topic = `Project sync — ${
  //         project?.projectTitle || rooms.find((r) => r.id === activeRoomId)?.title || "Chat"
  //       }`;
  //       const { data } = await zoom.createMeeting({ topic, duration: 30 });
  //       const join = data?.joinUrl;
  //       if (!join) throw new Error("No Zoom join URL returned.");
  //       await chatApi.send({ roomId: activeRoomId, text: `📹 Zoom meeting: ${join}` });
  //     }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to run command");
    }
  };

  /* --------------------------------- actions -------------------------------- */
  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const threshold = 120;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distanceFromBottom < threshold;
  };

  const handleSendMessage = async (text, files = []) => {
    if (!activeRoomId || roomClosed) return;

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

    try {
      await chatApi.send({ roomId: activeRoomId, text: trimmed, files: fileArray });
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to send");
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
      // backend will emit room:reopened; proactively clear local flag too
      setProject((p) => (p ? { ...p, reopenRequested: false, status: "In-Progress" } : p));
      setRoomClosed(false);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to reopen room");
    }
  };

  const BackIcon = () => (
    <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  /* ---------------------------------- UI ---------------------------------- */
  if (loading) return <div className="h-screen grid place-items-center">Loading chat…</div>;
  if (err) return <div className="h-screen grid place-items-center text-red-600 px-4 text-center break-words">{err}</div>;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Global top bar fixed */}
      <div className="fixed top-0 left-0 right-0 z-40 w-full bg-background/95 border-b border-border backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="max-w-6xl mx-auto px-3 md:px-4 h-12 md:h-14 flex items-center justify-between">
          <Link
            to="/"
            className="bg-black backlink inline-flex items-center gap-2 px-2 py-1 rounded-full text-sm font-medium hover:bg-muted focus-visible:bg-muted transition"
            title="Back"
          >
            <span className="ico text-white/80">
              <BackIcon />
            </span>
            <span className="hidden sm:inline text-white">Back to Dashboard</span>
          </Link>
          <div className="text-sm text-muted-foreground px-2 truncate">Team Chat</div>

          {/* Mobile open conversation list */}
          <button
            className="sm:hidden text-sm px-2 py-1 rounded-lg border border-border hover:bg-muted"
            onClick={() => setShowListMobile(true)}
          >
            Chats
          </button>
        </div>
      </div>

      {/* Spacer for fixed bar */}
      <div className="h-12 md:h-14" />

      {/* -------------- Two-column app area (independent scroll) -------------- */}
      <div className="h-[calc(100vh-48px)] md:h-[calc(100vh-56px)] flex bg-background text-foreground overflow-hidden">
        {/* Sidebar: its own scroll container */}
        <aside className="hidden sm:flex w-72 max-w-[22rem] flex-col border-r border-border overflow-y-auto">
          <ConversationList
            conversations={rooms.map(toConversation(typingByRoom))}
            activeConversationId={activeRoomId}
            onConversationSelect={(id) => setActiveRoomId(id)}
            loading={false}
            error={""}
          />
        </aside>

        {/* Chat column: header sticky, messages scroll, composer sticky */}
        <section className={`flex-1 min-w-0 flex flex-col overflow-hidden ${!activeRoomId && "hidden sm:flex"}`}>
          {activeRoomId ? (
            <>
              {/* Header sticky */}
              <div className="sticky top-0 z-30 bg-background border-b border-border">
                <ChatHeader
                  contact={{
                    name: shortName(rooms.find((r) => r.id === activeRoomId)?.title || "Chat"),
                    avatar: "",
                    status: roomClosed ? "Closed" : typingText || (joining ? "Joining…" : "Online"),
                    isOnline: !joining && !roomClosed,
                  }}
                  onBack={() => {}}
                />
              </div>

              {/* Inline banner for close/reopen (sticky under chat header) */}
              {(canShowClose || canShowReopen) && (
                <div className="sticky top-[48px] md:top-[56px] z-20 border-b border-border bg-background/95 px-3 md:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
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
                          <span className="text-xs text-muted-foreground truncate max-w-[46ch]">
                            “{project.ratings.pm.comment}”
                          </span>
                        )}
                      </div>

                      <button
                        onClick={handleCloseRoom}
                        className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm
                                   bg-gradient-to-r from-indigo-600 to-violet-600
                                   hover:from-indigo-500 hover:to-violet-500
                                   active:scale-[.98] transition"
                        title="Close this room and mark the project Complete"
                      >
                        Close Room
                      </button>
                    </>
                  )}

                  {canShowReopen && (
                    <div className="w-full sm:w-auto flex items-center justify-between gap-2">
                      <div className="text-sm text-muted-foreground">
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

              {/* Messages — ONLY scroller in the chat column */}
              <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6 bg-background"
              >
                {messages.length ? (
                  messages.map((m) => <MessageBubble key={m._id} message={m} />)
                ) : (
                  <div className="h-full w-full grid place-items-center text-center text-muted-foreground px-4">
                    No messages yet
                  </div>
                )}
              </div>

              {/* Composer pinned (does not scroll out) */}
              <div className="sticky bottom-0 border-t border-border bg-background">
                <div className="max-w-6xl mx-auto px-3 md:px-4 py-2">
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    onTypingChange={handleTypingChange}
                    typingText=""
                    disabled={roomClosed}
                    commands={commands}
                    onCommandRun={handleRunCommand}
                    role={userRole}
                  />
                  {/* Typing hint just under composer */}
                  <div className="mt-1 h-6">
                    {typingText && !roomClosed && (
                      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/60" />
                        {typingText}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Invoice Modal */}
              {showInvoiceModal && userRole === "PM" && (
                <InvoiceModal
                  // className="text-sm" // work on the pay color button later
                  projectTitle={project?.projectTitle}
                  onCancel={() => setShowInvoiceModal(false)}
                  onSubmit={async ({ amountDecimal, currency, memo }) => {
                    try {
                      const pid = project?.['_id'] || project?.id;
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

                      const msg =
                        `🧾 Invoice created — Click here to ${url}.\n`;

                      // send markdown link (the bubble will render it as a clickable text)
                      await chatApi.send({ roomId: activeRoomId, text: msg });
                      setShowInvoiceModal(false);
                    } catch (e) {
                      setErr(e?.response?.data?.message || e?.message || "Failed to create invoice");
                    }
                  }}
                />
              )}
            </>
          ) : (
            <div className="hidden sm:grid flex-1 place-items-center text-muted-foreground p-6">
              {loading ? "Loading your rooms…" : "Select a conversation to start chatting"}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------- Invoice Modal ------------------------------- */
function InvoiceModal({ projectTitle, onCancel, onSubmit }) {
  const [amountDecimal, setAmountDecimal] = useState("199.00");
  const [currency, setCurrency] = useState("USD");
  const [memo, setMemo] = useState(projectTitle ? `Invoice for ${projectTitle}` : "Invoice");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!amountDecimal || isNaN(Number(amountDecimal)) || Number(amountDecimal) <= 0) {
      setErr("Enter a valid amount (e.g., 199.00).");
      return;
    }
    if (!currency || currency.length < 3) {
      setErr("Enter a valid 3-letter currency (e.g., USD).");
      return;
    }
    try {
      setBusy(true);
      await onSubmit({
        amountDecimal: String(amountDecimal),
        currency: currency.toUpperCase(),
        memo: (memo || "").trim(),
      });
    } catch (e) {
      setErr(e?.message || "Failed to create invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm grid place-items-center p-3">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl p-4 max-h-[90vh] overflow-auto"
      >
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Generate Invoice</h2>
          <p className="text-xs text-muted-foreground">Stripe hosted payment page</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Amount</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amountDecimal}
              onChange={(e) => setAmountDecimal(e.target.value)}
              className="w-full rounded-xl border border-border bg-input-background px-3 py-2 outline-none focus:border-foreground/30"
              placeholder="199.00"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Currency</span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-border bg-input-background px-3 py-2 outline-none focus:border-foreground/30"
              placeholder="USD"
              maxLength={3}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Memo (optional)</span>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-xl border border-border bg-input-background px-3 py-2 outline-none focus:border-foreground/30"
              placeholder="What is this invoice for?"
            />
          </label>
        </div>

        {err && <div className="mt-3 text-sm text-red-600 break-words">{err}</div>}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-border hover:bg-muted">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-xl text-white bg-black hover:bg-black/90 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
