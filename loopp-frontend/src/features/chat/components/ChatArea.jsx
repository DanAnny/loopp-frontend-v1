import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

export default function ChatArea({ messages }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
      {messages.map((m) => <MessageBubble key={m._id || m.id} message={toBubble(m)} />)}
    </div>
  );
}

function toBubble(m) {
  const ts = m.createdAt ? new Date(m.createdAt) : new Date();
  return {
    id: m._id || m.id,
    content: m.text || m.content || "",
    timestamp: ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    isSent: m.senderType === "User" ? m.isMine === true : false,
    isDelivered: true,
    isRead: m.isRead || false,
  };
}
