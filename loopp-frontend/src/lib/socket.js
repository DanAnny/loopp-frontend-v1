// frontend/src/lib/socket.js
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/services/http";

let socket = null;

/** Return current socket instance (may be null). */
export function getSocket() {
  return socket;
}

/** True if connected. */
export function isSocketConnected() {
  return !!(socket && socket.connected);
}

/** Connect once per app session. Safe to call multiple times. */
export function connectSocket(userId = null, options = {}) {
  if (socket && (socket.connected || socket.connecting)) return socket;

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    // carry a lightweight auth payload if provided
    auth: userId ? { userId: String(userId) } : undefined,
    ...options,
  });

  // defensive: drop noisy default listeners if re-created
  socket.removeAllListeners?.("connect_error");
  socket.on?.("connect_error", () => {
    // no-op: caller can read connection state via isSocketConnected()
  });

  return socket;
}

/** Cleanly disconnect and forget the socket (used by hard reset). */
export function disconnectSocket() {
  try {
    if (socket) {
      socket.removeAllListeners?.();
      // guard: prevent auto-reconnect loop during logout/reset
      try { socket.io.opts.reconnection = false; } catch {}
      socket.disconnect?.();
    }
  } catch {}
  socket = null;
}

/**
 * Join a room with a timeout guard; resolves when server emits "joined".
 * `userId` is optional and sent only if provided.
 */
export function joinRoom(roomId, userId = null, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (!s) return reject(new Error("Socket not connected"));
    if (!roomId) return reject(new Error("Missing roomId"));

    // if already joined, many servers still emit "joined"—we'll just resolve on the first one
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

    // keep payload shape compatible with your server
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
};
