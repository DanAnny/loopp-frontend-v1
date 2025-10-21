import { apiClient, formClient } from "./http";

/** Authenticated (clientId) — list */
export const fetchMyClientRooms = async () => {
  const { data } = await apiClient.get("/chat/my-client-rooms");
  return data;
};

/** Authenticated (clientId) — messages */
export const fetchClientRoomMessages = async (roomId, { limit = 100 } = {}) => {
  const { data } = await apiClient.get(`/chat/client-room/${encodeURIComponent(roomId)}/messages`, {
    params: { limit },
  });
  return data;
};

const isObjectId = (s) => typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

/** Authenticated (clientId) — send */
export const sendClientRoomMessage = async (roomId, { text = "", files = [] } = {}) => {
  if (!isObjectId(roomId)) {
    // Prevents 400s from ever leaving the client if someone selects a request placeholder
    throw new Error("Invalid roomId (not a 24-hex ObjectId). Pick a room that hasRoom=true.");
  }

  // Normalize files: accept FileList or array
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

  const form = new FormData();
  form.append("roomId", roomId);
  form.append("text", text); // keep even if empty; server allows files-only
  for (const f of fileArray) form.append("files", f); // field name MUST be "files"

  // IMPORTANT: use formClient to keep multipart boundary & cookies
  const { data } = await formClient.post("/chat/client-room/send", form);
  return data;
};

export default {
  fetchMyClientRooms,
  fetchClientRoomMessages,
  sendClientRoomMessage,
};
