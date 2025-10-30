// frontend/src/features/chat/components/InvoiceModal.jsx
import { useEffect, useState } from "react";
import { DollarSign, FileText, Globe, X, CreditCard, Loader2 } from "lucide-react";

/**
 * InvoiceModal
 * Mirrors the behavior/validation used in Room.jsx:
 * - Validates amount & currency
 * - Uppercases currency
 * - Trims memo
 * - Calls onSubmit({ amountDecimal, currency, memo })
 *
 * Props:
 * - projectTitle?: string   // used to seed the memo like Room.jsx
 * - onCancel: () => void
 * - onSubmit: ({ amountDecimal, currency, memo }) => Promise<void>
 */
export default function InvoiceModal({ projectTitle, onCancel, onSubmit }) {
  const [amountDecimal, setAmountDecimal] = useState("199.00");
  const [currency, setCurrency] = useState("USD");
  const [memo, setMemo] = useState(
    projectTitle ? `Invoice for ${projectTitle}` : "Invoice for project"
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // ESC to close (matches general modal behavior across app)
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    // Validation (same semantics as Room.jsx)
    if (!amountDecimal || isNaN(Number(amountDecimal)) || Number(amountDecimal) <= 0) {
      setErr("Enter a valid amount (e.g., 199.00).");
      return;
    }
    if (!currency || currency.length < 3) {
      setErr("Enter a valid 3-letter currency (e.g., USD).");
      return;
    }

    try {
      setBusy(true);
      await onSubmit({
        amountDecimal: String(amountDecimal),
        currency: currency.toUpperCase(),
        memo: (memo || "").trim(),
      });
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.message || "Failed to create invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="relative bg-black px-6 py-6 text-white">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Create Invoice</h2>
              <p className="text-white/70 text-sm mt-0.5">Generate a Stripe payment page</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <DollarSign className="w-4 h-4 text-gray-600" />
              Amount
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amountDecimal}
              onChange={(e) => setAmountDecimal(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 text-lg outline-none focus:border-black transition-all"
              placeholder="199.00"
              autoFocus
            />
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Globe className="w-4 h-4 text-gray-600" />
              Currency
            </label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 outline-none focus:border-black transition-all uppercase"
              placeholder="USD"
              maxLength={3}
            />
          </div>

          {/* Description / Memo */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <FileText className="w-4 h-4 text-gray-600" />
              Description
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 outline-none focus:border-black transition-all resize-none"
              placeholder="What is this invoice for?"
              rows={2}
            />
          </div>

          {/* Error */}
          {err && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <p className="text-sm text-red-800 flex-1 break-words">{err}</p>
            </div>
          )}

          {/* Preview */}
          <div className="p-4 rounded-lg bg-gray-50 border-2 border-gray-200">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">Preview</p>
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-gray-700">Amount:</span>
                <span className="text-xl font-bold text-black">
                  {amountDecimal || "0.00"} {currency || "USD"}
                </span>
              </div>
              {memo && <p className="text-sm text-gray-700 mt-2 italic">"{memo}"</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-5 py-2.5 rounded-lg border-2 border-gray-300 hover:bg-gray-100 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-6 py-2.5 rounded-lg text-white bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex items-center gap-2 shadow-sm hover:shadow-md"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Create Invoice
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
