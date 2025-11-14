import { useState } from "react";

export default function MeetModal({ projectTitle, onCancel, onSubmit }) {
  const [mode, setMode] = useState("now"); // "now" | "schedule"
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const defaultStart = new Date(now.getTime() + 15 * 60 * 1000); // +15 min
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000); // +1h

  const [date, setDate] = useState(
    defaultStart.toISOString().slice(0, 10) // yyyy-mm-dd
  );
  const [startTime, setStartTime] = useState(
    defaultStart.toTimeString().slice(0, 5) // HH:MM
  );
  const [endTime, setEndTime] = useState(
    defaultEnd.toTimeString().slice(0, 5)
  );

  const buildISO = (d, t) => {
    if (!d || !t) return null;
    const [h, m] = t.split(":").map(Number);
    const dt = new Date(d);
    dt.setHours(h || 0, m || 0, 0, 0);
    return dt.toISOString();
  };

  const handleCreateNow = async () => {
    if (submitting) return; // avoid double-clicks

    const start = new Date();
    const startISO = new Date(start.getTime() + 2 * 60 * 1000).toISOString(); // 2 min from now
    const endISO = new Date(
      new Date(startISO).getTime() + 45 * 60 * 1000
    ).toISOString(); // +45 min

    try {
      setSubmitting(true);
      await onSubmit({ startISO, endISO });
      // parent will usually close the modal on success
    } catch (err) {
      console.error("Create Meet now failed:", err);
      setSubmitting(false); // keep modal open if parent didn't close it
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const startISO = buildISO(date, startTime);
    const endISO = buildISO(date, endTime);

    if (!startISO || !endISO) return;
    if (new Date(endISO) <= new Date(startISO)) return;

    try {
      setSubmitting(true);
      await onSubmit({ startISO, endISO });
      // parent will usually close the modal on success
    } catch (err) {
      console.error("Schedule Meet failed:", err);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Create Google Meet
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {projectTitle
                ? `Project: ${projectTitle}`
                : "Pick when you want this meeting to happen."}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </div>

        <div className="px-5 pt-4 pb-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex rounded-full bg-gray-100 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => !submitting && setMode("now")}
              className={`flex-1 rounded-full px-3 py-1.5 transition ${
                mode === "now"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
              disabled={submitting}
            >
              Meet now
            </button>
            <button
              type="button"
              onClick={() => !submitting && setMode("schedule")}
              className={`flex-1 rounded-full px-3 py-1.5 transition ${
                mode === "schedule"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
              disabled={submitting}
            >
              Schedule
            </button>
          </div>

          {mode === "now" ? (
            <div className="text-xs text-gray-600 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2.5">
              We’ll create a Meet that starts in the next few minutes and lasts
              about 45 minutes. Everyone in this room will see the link in chat.
            </div>
          ) : (
            <form className="space-y-3" onSubmit={handleSchedule}>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                  disabled={submitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-700">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                    disabled={submitting}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-700">
                    End time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-full text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-black/90 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  {submitting && (
                    <svg
                      className="w-3.5 h-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="opacity-75"
                        d="M4 12a8 8 0 018-8"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  <span>
                    {submitting ? "Creating…" : "Create scheduled Meet"}
                  </span>
                </button>
              </div>
            </form>
          )}

          {mode === "now" && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="px-3 py-1.5 rounded-full text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNow}
                disabled={submitting}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-black/90 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {submitting && (
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      d="M4 12a8 8 0 018-8"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                <span>
                  {submitting ? "Creating…" : "Create Meet now"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
