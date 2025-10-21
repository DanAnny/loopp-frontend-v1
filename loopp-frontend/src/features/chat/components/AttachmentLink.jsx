// frontend/src/features/chat/components/AttachmentLink.jsx
import React, { useCallback, useRef, useState, useEffect } from "react";
import { Eye, Download, Paperclip } from "lucide-react";
import { downloadMember } from "@/services/files.service";

const isImage = (ct = "") => String(ct).startsWith("image/");
const isPdf = (ct = "") => String(ct).toLowerCase() === "application/pdf";

export default function AttachmentLink({
  fileId,
  filename = "file",
  contentType = "application/octet-stream",
  length,
  className = "",
}) {
  const [thumbUrl, setThumbUrl] = useState(null);
  const revokeRef = useRef([]);

  const makeBlobUrl = (blob) => {
    const url = URL.createObjectURL(blob);
    revokeRef.current.push(url);
    return url;
  };

  const getBlob = async (forceDownload = false) => {
    const { data, headers } = await downloadMember(fileId, forceDownload);
    const type = headers?.["content-type"] || contentType || "application/octet-stream";
    return new Blob([data], { type });
  };

  const handlePreview = useCallback(async (e) => {
    e.preventDefault();
    try {
      const blob = await getBlob(false);
      const url = makeBlobUrl(blob);
      // open in a new tab safely
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Preview error:", err);
      alert("Could not preview this file.");
    }
  }, []);

  const handleDownload = useCallback(async (e) => {
    e.preventDefault();
    try {
      // either ask server to force `Content-Disposition: attachment` OR just download the blob client-side
      const blob = await getBlob(true);
      const url = makeBlobUrl(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Download error:", err);
      alert("Could not download this file.");
    }
  }, [filename]);

  // Optional: build a small thumbnail for images (auth-safe)
  useEffect(() => {
    let mounted = true;
    if (isImage(contentType)) {
      getBlob(false)
        .then((blob) => {
          if (!mounted) return;
          setThumbUrl(makeBlobUrl(blob));
        })
        .catch(() => {
          /* ignore thumb errors */
        });
    }
    return () => {
      mounted = false;
      revokeRef.current.forEach((u) => URL.revokeObjectURL(u));
      revokeRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, contentType]);

  const prettySize = typeof length === "number" ? `${(length / (1024 * 1024)).toFixed(2)} MB` : "";

  return (
    <div className={`flex items-center gap-2 p-2 rounded-xl border text-xs ${className}`}>
      {/* Thumbnail or icon */}
      {isImage(contentType) && thumbUrl ? (
        <button onClick={handlePreview} title="Preview" className="shrink-0">
          <img src={thumbUrl} alt={filename} className="h-10 w-10 rounded object-cover" />
        </button>
      ) : (
        <div className="h-10 w-10 rounded bg-background/20 grid place-items-center">
          <Paperclip className="h-4 w-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate">{filename}</div>
        <div className="opacity-70 text-[10px] truncate">
          {contentType || "file"} {prettySize ? `• ${prettySize}` : ""}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {(isImage(contentType) || isPdf(contentType)) && (
          <button
            onClick={handlePreview}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:opacity-90 border"
            title="Preview"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        )}
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:opacity-90 border"
          title="Download"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
      </div>
    </div>
  );
}
