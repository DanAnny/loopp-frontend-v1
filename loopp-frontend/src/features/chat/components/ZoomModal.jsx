// src/features/chat/components/ZoomModal.jsx
import { useState } from "react";

export default function ZoomModal({ projectTitle, onCancel, onSubmit, defaultDuration = 45 }) {
  const [topic, setTopic] = useState(projectTitle ? `${projectTitle} — Sync` : "Project Sync");
  const [duration, setDuration] = useState(defaultDuration);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setLoading(true);
    try {
      await onSubmit({ topic: topic.trim(), durationMinutes: Number(duration) || defaultDuration });
    } catch (e) {
      setErr(e?.message || "Failed to create Zoom meeting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="p-4 border-b">
          <h3 className="text-base font-semibold">Generate Zoom meeting link</h3>
          <p className="text-xs text-gray-500 mt-1">
            Create an instant Zoom room and post the link into this chat.
          </p>
        </div>

        <div className="p-4 space-y-3">
          <label className="block text-sm">
            <span className="text-gray-600">Topic</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Project Sync"
            />
          </label>

          <label className="block text-sm">
            <span className="text-gray-600">Duration (minutes)</span>
            <input
              type="number"
              min={15}
              max={180}
              className="mt-1 w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>

          {err && <div className="text-xs text-red-600">{err}</div>}
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button className="px-4 py-2 text-sm rounded-full border" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm rounded-full bg-black text-white disabled:opacity-60"
            onClick={submit}
            disabled={loading}
          >
            {loading ? "Creating…" : "Create & Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
