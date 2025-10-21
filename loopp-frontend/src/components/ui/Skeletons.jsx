import { motion } from "framer-motion";

export const CardSkeleton = ({ delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="rounded-2xl border border-black/10 bg-white p-6"
  >
    <div className="h-5 w-40 bg-black/5 rounded mb-3 animate-pulse" />
    <div className="h-4 w-24 bg-black/5 rounded animate-pulse" />
  </motion.div>
);

export const TableSkeleton = ({ rows = 6 }) => (
  <div className="space-y-4">
    {Array.from({ length: rows }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: i * 0.05 }}
        className="flex gap-4 p-4"
      >
        <div className="h-4 flex-1 bg-black/5 rounded animate-pulse" />
        <div className="h-4 w-24 bg-black/5 rounded animate-pulse" />
        <div className="h-4 w-32 bg-black/5 rounded animate-pulse" />
        <div className="h-4 w-24 bg-black/5 rounded animate-pulse" />
        <div className="h-4 w-40 bg-black/5 rounded animate-pulse" />
      </motion.div>
    ))}
  </div>
);
