import React, {useState, useEffect} from "react";
import { CheckCheck, Paperclip, Eye, Download } from "lucide-react";
import { fileHref } from "../../utils/fileHref";

const isImage = (ct = "") => String(ct).startsWith("image/");
const isPdf = (ct = "") => String(ct).toLowerCase() === "application/pdf";

function ImageThumb({ url, alt }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await fetch(url, { credentials: "include" });
        const ct = resp.headers.get("content-type") || "";
        if (!resp.ok || ct.includes("text/html")) throw new Error("Not authorized or bad response");
        const b = await resp.blob();
        const u = URL.createObjectURL(b);
        if (alive) setBlobUrl(u);
      } catch (e) {
        if (alive) setErr(e.message || "Preview failed");
      }
    })();
    return () => {
      alive = false;
      try { blobUrl && URL.revokeObjectURL(blobUrl); } catch {}
    };
  }, [url]);

  if (err) return <div className="h-10 w-10 rounded bg-red-100 text-[10px] grid place-items-center">!</div>;
  if (!blobUrl) return <div className="h-10 w-10 rounded bg-muted grid place-items-center text-[10px]">…</div>;
  return <img src={blobUrl} alt={alt} className="h-10 w-10 rounded object-cover" />;
}

/* ---------- link rendering helpers (only affect message.content text) ---------- */
const urlRegex = /https?:\/\/[^\s)]+/gi;

function isStripeInvoiceUrl(u) {
  // handles invoice.stripe.com/i/... and pay.stripe.com/invoice/...
  return /(invoice\.stripe\.com\/i\/|pay\.stripe\.com\/invoice\/)/i.test(u);
}

function shortenUrl(u) {
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, "");
    let path = parsed.pathname || "/";
    if (path.length > 18) path = path.slice(0, 17) + "…";
    return `${host}${path}`;
  } catch {
    // fallback: show very short piece
    return u.length > 28 ? u.slice(0, 27) + "…" : u;
  }
}

function labelForUrl(u) {
  if (isStripeInvoiceUrl(u)) {
    return <span className="no-underline text-red-500 underline-offset-0">Pay</span>;
  }
  return shortenUrl(u);
}

function renderWithLinks(text) {
  if (!text) return null;
  const parts = [];
  let lastIndex = 0;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const url = m[0];
    const start = m.index;
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    parts.push(
      <a
        key={`${start}-${url}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-words"
        title={url}
      >
        {labelForUrl(url)}
      </a>
    );
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/**
 * message = {
 *   _id, content, timestamp, isMine, senderRole, senderName,
 *   attachments: [{ fileId, filename, contentType, length }]
 * }
 */
export default function MessageBubble({ message }) {
  const sent = !!message.isMine;

  // role-based colors for incoming bubbles
  const roleColors = {
    PM: "bg-gray-200 text-gray-900",
    Engineer: "bg-indigo-100 text-indigo-900",
    Client: "bg-emerald-100 text-emerald-900",
    User: "bg-muted text-foreground",
  };
  const incomingClass = roleColors[message.senderRole] || roleColors.User;

  const bubbleClass = sent
    ? "bg-foreground text-background ml-auto rounded-br-md"
    : `${incomingClass} mr-auto rounded-bl-md`;

  return (
    <div className={`flex ${sent ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`
          max-w-[88%] sm:max-w-[80%] lg:max-w-[68%] px-3.5 py-2 rounded-2xl shadow-sm relative group
          transition-all duration-200 hover:shadow-md ${bubbleClass}
        `}
      >
        {!sent && (
          <div className="text-[10px] opacity-70 mb-1">
            {message.senderName} • {message.senderRole}
          </div>
        )}

        {message.content && (
          <p className="break-words whitespace-pre-wrap text-sm leading-relaxed">
            {renderWithLinks(message.content)}
          </p>
        )}

        {/* Attachments */}
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.attachments.map((a, idx) => {
              const previewUrl = fileHref(a.fileId, { download: false });
              const downloadUrl = fileHref(a.fileId, { download: true });

              return (
                <div
                  key={`${message._id}-att-${idx}`}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs ${
                    sent ? "border-background/30" : "border-foreground/20"
                  }`}
                >
                  {/* Thumbnail for images */}
                  {isImage(a.contentType) ? (
                    <a href={previewUrl} target="_blank" rel="noreferrer" className="shrink-0" title="Preview">
                      <ImageThumb url={previewUrl} alt={a.filename} />
                    </a>
                  ) : (
                    <div className="h-10 w-10 rounded bg-background/20 grid place-items-center">
                      <Paperclip className="h-4 w-4" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate">{a.filename}</div>
                    <div className="opacity-70 text-[10px] truncate">
                      {a.contentType || "file"} • {(a.length / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>

                  {/* Actions: Preview (inline for images/PDF), Download */}
                  <div className="flex items-center gap-1">
                    {(isImage(a.contentType) || isPdf(a.contentType)) && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:opacity-90 border"
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </a>
                    )}

                    <a
                      href={downloadUrl}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:opacity-90 border"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div
          className={`flex items-center gap-1 mt-1 justify-end ${
            sent ? "text-background/70" : "text-muted-foreground"
          }`}
        >
          <span className="text-[10px]">{message.timestamp}</span>
          {sent && (
            <span className="flex items-center">
              <CheckCheck className="h-3 w-3 opacity-80" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
