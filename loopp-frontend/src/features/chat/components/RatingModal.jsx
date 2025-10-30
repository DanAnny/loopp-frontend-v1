// src/features/clientChat/components/RatingModal.jsx
import { useState, useEffect, useMemo } from "react";
import { X, Star } from "lucide-react";
import * as Projects from "@/services/projects.service";

function StarRating({ value, onChange, label, description }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-black">{label}</div>
        {description && (
          <div className="text-xs text-gray-500 mt-0.5">{description}</div>
        )}
      </div>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="group transition-transform hover:scale-110 active:scale-95"
            aria-label={`${label}: ${star} star${star > 1 ? "s" : ""}`}
          >
            <Star
              className={`w-9 h-9 transition-all ${
                star <= (hover || value)
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-none text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>

      {value > 0 && (
        <div className="text-xs text-gray-600">
          {value === 5 && "⭐ Excellent!"}
          {value === 4 && "👍 Very Good"}
          {value === 3 && "👌 Good"}
          {value === 2 && "😐 Fair"}
          {value === 1 && "👎 Needs Improvement"}
        </div>
      )}
    </div>
  );
}

/**
 * Props:
 * - requestId (string)            // required – the ProjectRequest id to rate
 * - roomId? (string)              // optional – if provided we validate status/hasRatings like ClientChat
 * - onClose()                     // close handler
 * - onRated()                     // called after successful submit
 */
export default function RatingModal({ requestId, roomId, onClose, onRated }) {
  const [pmScore, setPmScore] = useState(0);
  const [engScore, setEngScore] = useState(0);
  const [teamScore, setTeamScore] = useState(0);
  const [pmComment, setPmComment] = useState("");
  const [engComment, setEngComment] = useState("");
  const [coordComment, setCoordComment] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [guardMsg, setGuardMsg] = useState(""); // reasons why rating cannot proceed
  const [checking, setChecking] = useState(false);

  // Keyboard escape
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Mirror the guard logic from ClientChat's RatingSheet:
  // - Only allow when project status is "Review"
  // - Disallow when already rated
  useEffect(() => {
    let alive = true;
    (async () => {
      // requestId is mandatory
      if (!requestId) {
        setGuardMsg("Missing request id. Please reopen this window from your chat.");
        return;
      }
      // If no roomId, assume parent already gated it (like ClientChat) – we still allow submit.
      if (!roomId) return;

      try {
        setChecking(true);
        setErr("");
        setGuardMsg("");

        const metaRes = await Projects.getRoomMeta(roomId);
        const pr =
          metaRes?.data?.project || metaRes?.project || metaRes?.data?.pr || {};

        const status = String(pr?.status || "").toLowerCase();
        const already = !!pr?.hasRatings;

        if (status !== "review") {
          if (!alive) return;
          setGuardMsg("You can only rate when the project is in Review.");
        } else if (already) {
          if (!alive) return;
          setGuardMsg("You have already submitted a rating for this project.");
        }
      } catch (e) {
        if (!alive) return;
        // Don't hard-fail; show a soft warning but keep the form (in case parent gated already)
        setGuardMsg(
          e?.response?.data?.message ||
            e?.message ||
            "Unable to verify rating status right now."
        );
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [roomId, requestId]);

  const canSubmit = useMemo(() => {
    return (
      pmScore > 0 &&
      engScore > 0 &&
      teamScore > 0 &&
      pmComment.trim() &&
      engComment.trim() &&
      coordComment.trim() &&
      !!requestId &&
      !guardMsg
    );
  }, [
    pmScore,
    engScore,
    teamScore,
    pmComment,
    engComment,
    coordComment,
    requestId,
    guardMsg,
  ]);

  const submit = async (e) => {
    e.preventDefault();
    if (!requestId) {
      setErr("Missing request id. Please reopen this window from your chat.");
      return;
    }
    if (guardMsg) {
      // Surface the guard reason clearly
      setErr(guardMsg);
      return;
    }
    if (!canSubmit) {
      setErr(
        "Please rate each category (1–5 stars) and provide the three comments."
      );
      return;
    }

    try {
      setSubmitting(true);
      setErr("");

      // Mirror the exact payload keys used in ClientChat's RatingSheet
      await Projects.rate({
        requestId,
        pmScore,
        pmComment,
        engineerScore: engScore,
        engineerComment: engComment,
        coordinationScore: teamScore,
        coordinationComment: coordComment,
      });

      onRated?.();
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to submit rating. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
            <div>
              <h2 className="text-xl font-bold text-black">Rate Your Experience</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Your feedback helps us improve our service
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Guard / Info banner (mirrors gating behavior) */}
          {(checking || guardMsg) && (
            <div className="px-6 pt-4">
              <div
                className={`rounded-xl border px-3 py-2 text-sm ${
                  checking
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                }`}
              >
                {checking
                  ? "Checking if your project is eligible for rating…"
                  : guardMsg}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-8">
              <div className="grid md:grid-cols-3 gap-8">
                <div className="p-5 bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-100">
                  <StarRating
                    label="Project Manager"
                    description="Communication, guidance, and support"
                    value={pmScore}
                    onChange={setPmScore}
                  />
                </div>
                <div className="p-5 bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100">
                  <StarRating
                    label="Engineer"
                    description="Technical expertise and quality"
                    value={engScore}
                    onChange={setEngScore}
                  />
                </div>
                <div className="p-5 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100">
                  <StarRating
                    label="Team Coordination"
                    description="Collaboration and workflow"
                    value={teamScore}
                    onChange={setTeamScore}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Project Manager Feedback <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none transition resize-none"
                    placeholder="What did you appreciate most about your PM's work?"
                    value={pmComment}
                    onChange={(e) => setPmComment(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Engineer Feedback <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none transition resize-none"
                    placeholder="How would you describe the engineer's technical work?"
                    value={engComment}
                    onChange={(e) => setEngComment(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Team Coordination Feedback <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none transition resize-none"
                    placeholder="How well did the team work together on your project?"
                    value={coordComment}
                    onChange={(e) => setCoordComment(e.target.value)}
                  />
                </div>
              </div>

              {err && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 bg-red-500 rounded-full grid place-items-center mt-0.5">
                    <X className="w-3 h-3 text-white" />
                  </div>
                  <div className="text-sm text-red-700">{err}</div>
                </div>
              )}
            </div>

            <div className="px-6 py-5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                <span className="text-red-500">*</span> All fields are required
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 transition font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="px-6 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm shadow-lg shadow-black/10"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit Feedback"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
