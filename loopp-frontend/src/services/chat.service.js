import { apiClient, formClient } from "@/services/http";

// Rooms
export const myRooms = () => apiClient.get("/chat/my-rooms");
export const getRoomByKey = (key) =>
  apiClient.get(`/chat/room/key/${encodeURIComponent(key)}`);

// Messages (list)
export const getMessages = (roomId, params = {}) =>
  apiClient.get(`/chat/${roomId}/messages`, { params });

// Send message (+ attachments) — field name MUST be "files"
export const send = ({ roomId, text, files = [] }) => {
  const form = new FormData();
  form.append("roomId", roomId);
  if (text) form.append("text", text);
  files.forEach((f) => form.append("files", f));
  // Let the browser set the multipart boundary
  return formClient.post("/chat/send", form);
};

export default { myRooms, getRoomByKey, getMessages, send };
