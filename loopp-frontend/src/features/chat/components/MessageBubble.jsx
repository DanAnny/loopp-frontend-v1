import React, { useState, useEffect } from "react";
import {
  Download,
  ExternalLink,
  X,
  FileText,
  File,
  Check,
  CheckCheck,
  RefreshCw,
  Loader2
} from "lucide-react";
import MessageContextMenu from "./MessageContextMenu";
import { fileHref } from "../../utils/fileHref";

/* ----------------------------- content-type utils ---------------------------- */
const isImageCT = (ct = "") => String(ct).startsWith("image/");
const isPdfCT = (ct = "") => String(ct).toLowerCase() === "application/pdf";

/* ----------------------- secure image thumb (no CORS leak) ------------------- */
function ImageThumb({ url, alt }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    let localBlobUrl = null;
    (async () => {
      try {
        const resp = await fetch(url, { credentials: "include" });
        const ct = resp.headers.get("content-type") || "";
        if (!resp.ok || ct.includes("text/html")) throw new Error("Not authorized or bad response");
        const b = await resp.blob();
        localBlobUrl = URL.createObjectURL(b);
        if (alive) setBlobUrl(localBlobUrl);
      } catch (e) {
        if (alive) setErr(e.message || "Preview failed");
      }
    })();
    return () => {
      alive = false;
      try { localBlobUrl && URL.revokeObjectURL(localBlobUrl); } catch {}
    };
  }, [url]);

  if (err) {
    return (
      <div className="h-32 w-32 rounded bg-red-100 text-[10px] grid place-items-center" title={err}>
        !
      </div>
    );
  }
  if (!blobUrl) {
    return (
      <div className="h-32 w-32 rounded bg-gray-200 animate-pulse grid place-items-center text-[10px]">
        …
      </div>
    );
  }
  return <img src={blobUrl} alt={alt} className="h-32 w-32 rounded object-cover" />;
}

/* -------------------------- link rendering in content ------------------------- */
const urlRegex = /https?:\/\/[^\s)]+/gi;
const isStripeInvoiceUrl = (u) => /(invoice\.stripe\.com\/i\/|pay\.stripe\.com\/invoice\/)/i.test(u);

function shortenUrl(u) {
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, "");
    let path = parsed.pathname || "/";
    if (path.length > 18) path = path.slice(0, 17) + "…";
    return `${host}${path}`;
  } catch {
    return u.length > 28 ? u.slice(0, 27) + "…" : u;
  }
}
function labelForUrl(u) {
  if (isStripeInvoiceUrl(u))
    return <span className="no-underline text-red-500 underline-offset-0">Pay</span>;
  return shortenUrl(u);
}
function renderWithLinks(text) {
  if (!text) return null;
  const parts = [];
  let lastIndex = 0, m;
  while ((m = urlRegex.exec(text)) !== null) {
    const url = m[0], start = m.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(
      <a key={`${start}-${url}`} href={url} target="_blank" rel="noreferrer" className="break-words underline" title={url}>
        {labelForUrl(url)}
      </a>
    );
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/* ------------------------------- UI theme map -------------------------------- */
const themeStyles = {
  me: "bg-black text-white ml-auto",
  client: "bg-gray-100 text-black",
  pm: "bg-gray-100 text-black border-l-2 border-purple-500",
  engineer: "bg-gray-100 text-black border-l-2 border-green-500",
  admin: "bg-gray-100 text-black border-l-2 border-orange-500",
  superadmin: "bg-gray-100 text-black border-l-2 border-red-500",
  system: "bg-gray-50 text-black/70 italic text-center mx-auto",
  user: "bg-gray-100 text-black",
};

/* ----------------------------- attachment meta shim -------------------------- */
function normalizeAttachment(att) {
  const hasFileId = !!att.fileId;
  const filename = att.filename || att.name || "file";
  const contentType = att.contentType || att.type || "";
  const length = typeof att.length === "number" ? att.length : undefined;

  const previewUrl = hasFileId ? fileHref(att.fileId, { download: false }) : att.url;
  const downloadUrl = hasFileId ? fileHref(att.fileId, { download: true }) : att.url;

  return { filename, contentType, length, previewUrl, downloadUrl };
}

/* --------------------------- delivery status UI --------------------------- */
function DeliveryBadge({ status, createdAtISO, onRetry }) {
  // status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  const time = new Date(createdAtISO || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (status === "failed") {
    return (
      <div className="mt-1 mb-2 text-[10px] flex items-center gap-2 justify-end text-red-300">
        <span>Failed • {time}</span>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-100"
          title="Retry send"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="mt-1 mb-2 text-[10px] flex items-center gap-1.5 justify-end text-white/70 whitespace-nowrap">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>{time}</span>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className="mt-1 mb-2 text-[10px] flex items-center gap-1.5 justify-end text-white/70 whitespace-nowrap">
        <Check className="w-3.5 h-3.5 opacity-80" />
        <span>{time}</span>
      </div>
    );
  }

  if (status === "delivered") {
    return (
      <div className="mt-1 mb-2 text-[10px] flex items-center gap-1.5 justify-end text-white/70 whitespace-nowrap">
        <CheckCheck className="w-3.5 h-3.5 opacity-80" />
        <span>{time}</span>
      </div>
    );
  }

  if (status === "read") {
    return (
      <div className="mt-1 mb-2 text-[10px] flex items-center gap-1.5 justify-end text-emerald-200 whitespace-nowrap">
        <CheckCheck className="w-3.5 h-3.5" />
        <span>{time}</span>
      </div>
    );
  }

  // fallback (for non-mine messages)
  return (
    <div className="mt-1 mb-2 text-[10px] flex items-center gap-1.5 justify-end text-black/50 whitespace-nowrap">
      <span>{time}</span>
    </div>
  );
}

/* ---------------------------------- main ---------------------------------- */
export default function MessageBubble({
  message,
  highlighted = false,
  onEdit,
  onDelete,
  onRetry, // <- added for failed resend
}) {
  const [imgError, setImgError] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || "");
  const [previewUrl, setPreviewUrl] = useState(null);

  const theme = themeStyles[message.bubbleTheme] || themeStyles.user;
  const maxWidth =
    message.bubbleTheme === "system"
      ? "max-w-md"
      : "max-w-[75%] md:max-w-[65%]";

  const formatTime = (isoString) => {
    if (!isoString && message.timestamp) return message.timestamp;
    const date = new Date(isoString || Date.now());
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  /* --------------------------- system chip variant -------------------------- */
  if (message.bubbleTheme === "system") {
    return (
      <div className="flex justify-center my-6">
        <div className="bg-yellow-50 border border-yellow-200 shadow-sm rounded-2xl px-5 py-3 max-w-lg">
          <div className="flex items-center gap-2 justify-center">
            <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm font-medium text-yellow-900">{message.content}</div>
          </div>
          <div className="text-[10px] text-yellow-700/60 text-center mt-1">
            {formatTime(message.createdAtISO)}
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------- handlers (UI only) -------------------------- */
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };
  const handleCopy = () => {
    if (message.content) navigator.clipboard.writeText(message.content);
  };
  const handleEditSave = () => {
    const next = (editContent || "").trim();
    if (next && next !== message.content) onEdit?.(message._id, next);
    setIsEditing(false);
  };
  const handleEditCancel = () => {
    setEditContent(message.content || "");
    setIsEditing(false);
  };

  /* ----------------------------- header name/role ---------------------------- */
  const rawRole = (message.senderRole || message.sender?.role || "User").toString();
  const isClientRole =
    rawRole.toLowerCase() === "client" ||
    String(message.senderType || "").toLowerCase() === "client";

  const fullFromSender =
    [message?.sender?.firstName, message?.sender?.lastName].filter(Boolean).join(" ").trim();

  const emailLocal =
    (message?.clientEmail || message?.sender?.email || "").split("@")[0] || "";

  const headerName = (
    fullFromSender ||
    (isClientRole && (message.clientName || "")) ||
    ((message.senderName || "").trim().toLowerCase() !== "client"
      ? (message.senderName || "").trim()
      : "") ||
    (isClientRole ? emailLocal : "") ||
    (message?.sender?.displayName ||
      message?.sender?.fullName ||
      message?.sender?.username ||
      message?.sender?.email ||
      "").trim() ||
    rawRole
  ).trim();

  let _headerName = headerName;
  if (_headerName.toLowerCase() === "client" && (message.clientName || message.clientEmail)) {
    _headerName = (message.clientName || (message.clientEmail || "").split("@")[0] || "Client").trim();
  }

  const headerRole = rawRole;
  const showHeader = message.bubbleTheme !== "system";

  /* --------------------------------- render --------------------------------- */
  return (
    <div
      className={`flex flex-col mb-2 ${message.isMine ? "items-end" : "items-start"} group transition-all duration-300 ${highlighted ? "scale-105" : ""}`}
    >
      {showHeader && (
        <div className="text-[11px] mb-1 px-2 font-medium flex items-center gap-1.5 text-gray-700">
          <span className="truncate max-w-[40ch]">{_headerName}</span>
          <span className="text-black/30">•</span>
          <span className="text-black/60">{headerRole}</span>
        </div>
      )}

      <div
        className={`${theme} ${maxWidth} rounded-2xl shadow-sm ${message.isMine ? "rounded-tr-md" : "rounded-tl-md"} ${highlighted ? "ring-2 ring-blue-500 ring-offset-2" : ""} transition-all duration-300`}
        onContextMenu={handleContextMenu}
      >
        <div className="px-3 pt-2">
          {!isEditing && message.content && (
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {renderWithLinks(message.content)}
            </div>
          )}

          {isEditing && (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className={`w-full px-2 py-1 text-[15px] rounded-lg border outline-none resize-none ${
                  message.isMine
                    ? "bg-white/10 border-white/20 focus:border-white/40"
                    : "bg-white border-gray-200 focus:border-gray-400"
                }`}
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleEditCancel}
                  className={`px-3 py-1 text-xs rounded-lg transition ${
                    message.isMine ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  className={`px-3 py-1 text-xs rounded-lg transition ${
                    message.isMine ? "bg-white/20 hover:bg-white/30" : "bg-black/10 hover:bg-black/20"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {Array.isArray(message.attachments) && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((att, idx) => {
                const meta = normalizeAttachment(att);
                const { filename, contentType, length, previewUrl, downloadUrl } = meta;
                const isImage = isImageCT(contentType) || /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
                const isPdf = isPdfCT(contentType) || filename.toLowerCase().endsWith(".pdf");

                if (isImage && !imgError[previewUrl]) {
                  return (
                    <div key={idx} className="relative group/img inline-block">
                      <a href={previewUrl} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden" title={filename}>
                        <ImageThumb url={previewUrl} alt={filename} />
                      </a>
                      <a
                        href={downloadUrl}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </a>
                    </div>
                  );
                }

                return (
                  <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${message.isMine ? "bg-white/10" : "bg-black/5"}`}>
                    <div className={`p-1.5 rounded ${message.isMine ? "bg-white/20" : "bg-black/10"}`}>
                      {isPdf ? <FileText className="w-4 h-4" /> : <File className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs truncate block">{filename}</span>
                      <span className="text-[10px] opacity-70 truncate block">
                        {contentType || "file"}
                        {typeof length === "number" ? ` • ${(length / (1024 * 1024)).toFixed(2)} MB` : ""}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {(isPdf || isImageCT(contentType)) && (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`${message.isMine ? "hover:bg-white/20" : "hover:bg-black/10"} p-1 rounded transition`}
                          title="Preview"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <a
                        href={downloadUrl}
                        className={`${message.isMine ? "hover:bg-white/20" : "hover:bg-black/10"} p-1 rounded transition`}
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer: time + delivery checks */}
          <div className={`mt-1 mb-2 text-[10px] flex items-center gap-1.5 ${message.isMine ? "justify-end" : "justify-end"} whitespace-nowrap`}>
            {message.isMine ? (
              <DeliveryBadge status={message.status} createdAtISO={message.createdAtISO} onRetry={onRetry} />
            ) : (
              <div className={`${message.isMine ? "text-white/70" : "text-black/50"}`}>
                {new Date(message.createdAtISO || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
        </div>
      </div>

      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onEdit={() => setIsEditing(true)}
          onCopy={handleCopy}
          onDelete={onDelete ? () => onDelete(message._id) : undefined}
          onClose={() => setContextMenu(null)}
          canEdit={message.isMine}
        />
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          {previewUrl.toLowerCase().endsWith(".pdf") ? (
            <iframe
              src={previewUrl}
              className="w-full h-full max-w-5xl max-h-[90vh] bg-white rounded-lg"
              onClick={(e) => e.stopPropagation()}
              title="Attachment Preview"
            />
          ) : (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
