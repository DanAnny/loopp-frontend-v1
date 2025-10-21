// frontend/src/features/chat/components/AuthImage.jsx
import React, { useEffect, useState, useRef } from "react";
import { downloadMember } from "@/services/files.service";

export default function AuthImage({ fileId, alt = "", className = "" }) {
  const [url, setUrl] = useState(null);
  const urlRef = useRef(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data, headers } = await downloadMember(fileId, false);
        const type = headers["content-type"] || data.type || "application/octet-stream";
        const blob = data instanceof Blob ? data : new Blob([data], { type });
        const objectUrl = URL.createObjectURL(blob);
        if (alive) {
          // Revoke any previous URL before replacing
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = objectUrl;
          setUrl(objectUrl);
        }
      } catch (err) {
        // optional: keep a placeholder or show fallback
        // console.warn("AuthImage load failed", err);
      }
    })();

    return () => {
      alive = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [fileId]);

  if (!url) return <div className="h-10 w-10 rounded bg-muted animate-pulse" />;

  return <img src={url} alt={alt} className={className} />;
}
