// frontend/src/lib/socket.js
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/services/http";

let socket = null;
let heartbeatTimer = null;
let idleTimer = null;

/** Return current socket instance (may be null). */
export function getSocket() {
  return socket;
}

/** True if connected. */
export function isSocketConnected() {
  return !!(socket && socket.connected);
}

/** Internal: start presence heartbeats (every 5s). */
function startHeartbeat() {
  stopHeartbeat();
  if (!socket) return;
  heartbeatTimer = setInterval(() => {
    try {
      socket.emit("presence:active");
    } catch {}
  }, 5000);
  try {
    socket.emit("presence:active"); // fast mark online
  } catch {}
}

/** Internal: stop presence heartbeats. */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/** Idle detection: if no activity for 10s → stop heartbeats */
function setupIdleDetection() {
  const reportActivity = () => {
    try {
      socket?.emit("presence:active");
    } catch {}
    startHeartbeat(); // ensure heartbeats continue
    resetIdleTimer();
  };

  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      stopHeartbeat(); // → backend marks offline
    }, 10000); // 10 seconds
  };

  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(evt => {
    document.addEventListener(evt, reportActivity);
  });

  resetIdleTimer();
}

/** Clear tokens + user data and redirect properly */
export function handleLogout(force = false) {
  let redirect = "/signin"; // default for staff
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const storedUser = JSON.parse(raw);
      if (storedUser?.role === "Client") {
        redirect = "/client-sign-in";
      }
    }
  } catch {}

  try {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  } catch {}

  stopHeartbeat();
  try {
    if (socket && socket.io && socket.io.opts) {
      socket.io.opts.reconnection = false;
    }
  } catch {}
  try {
    socket?.disconnect?.();
  } catch {}
  socket = null;

  if (force) {
    window.location.replace(redirect);
  } else {
    window.location.href = redirect;
  }
}

/** Connect once per app session. Safe to call multiple times. */
export function connectSocket(userId = null, options = {}) {
  if (socket && (socket.connected || socket.connecting)) return socket;

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    auth: userId ? { userId: String(userId) } : undefined,
    ...options,
  });

  socket.removeAllListeners?.("connect_error");
  socket.on?.("connect_error", () => {});

  socket.on?.("connect", () => {
    startHeartbeat();
    setupIdleDetection();
  });

  socket.on?.("disconnect", () => {
    stopHeartbeat();
  });

  // Server instructs to force logout (idle timeout, token bump, etc.)
  socket.on?.("auth:force_logout", () => {
    handleLogout(true);
  });

  // Keep presence tight when tab is foregrounded
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!socket) return;
      if (document.visibilityState === "visible") {
        try {
          socket.emit("presence:active");
        } catch {}
        startHeartbeat();
      }
    });
  }

  return socket;
}

/** Cleanly disconnect and forget the socket (used by hard reset). */
export function disconnectSocket() {
  try {
    if (socket) {
      socket.removeAllListeners?.();
      try { socket.io.opts.reconnection = false; } catch {}
      socket.disconnect?.();
    }
  } catch {}
  stopHeartbeat();
  socket = null;
}

/** Join a room with a timeout guard */
export function joinRoom(roomId, userId = null, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (!s) return reject(new Error("Socket not connected"));
    if (!roomId) return reject(new Error("Missing roomId"));

    const onJoined = (payload) => {
      const rid = (payload && (payload.roomId || payload))?.toString?.() || "";
      if (rid === roomId.toString()) {
        cleanup();
        resolve(true);
      }
    };
    const onError = (msg) => {
      cleanup();
      reject(new Error(msg || "Failed to join room"));
    };
    const to = setTimeout(() => {
      cleanup();
      reject(new Error("Join room timeout"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(to);
      s.off("joined", onJoined);
      s.off("join_error", onError);
      s.off("error", onError);
    }

    s.on("joined", onJoined);
    s.on("join_error", onError);
    s.on("error", onError);

    const payload = { roomId: String(roomId) };
    if (userId) payload.userId = String(userId);

    s.emit("join", payload);
  });
}

export default {
  connectSocket,
  getSocket,
  isSocketConnected,
  disconnectSocket,
  joinRoom,
  handleLogout,
};
