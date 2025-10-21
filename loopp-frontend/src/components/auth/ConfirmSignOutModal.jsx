import { motion, AnimatePresence } from "framer-motion";
import { LogOut, X } from "lucide-react";

export default function ConfirmSignOutModal({ open, onCancel, onConfirm, loading }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
      />
      <div className="fixed inset-0 grid place-items-center z-[90] p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="pointer-events-auto w-full max-w-md bg-white rounded-2xl border border-black/10 shadow-2xl p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-foreground text-lg font-semibold">Sign out?</h3>
            <button onClick={onCancel} className="p-2 rounded-lg hover:bg-black/5">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            You’ll need to sign in again to continue.
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 rounded-xl border border-black/20 px-4 py-2 hover:bg-black/5 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-black text-white px-4 py-2 hover:bg-black/90 transition disabled:opacity-60"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
