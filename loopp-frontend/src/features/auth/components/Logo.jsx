import React from "react";
import { motion } from "framer-motion";

export default function Logo() {
  return (
    <motion.div 
      className="relative inline-block group"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
    >
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-black via-slate-800 to-black rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-500" />
      
      {/* Main logo container */}
      <div className="relative bg-gradient-to-br from-black via-slate-900 to-black px-4 py-2 rounded-lg border border-slate-700/50 shadow-lg flex items-center justify-center">
        {/* Text */}
        <div className="flex items-baseline gap-0.5">
          <motion.span 
            className="text-white tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            l
          </motion.span>
          <motion.span 
            className="text-white tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            o
          </motion.span>
          <motion.span 
            className="text-white tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            o
          </motion.span>
          <motion.span 
            className="text-white tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            p
          </motion.span>
          <motion.span 
            className="text-white tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.7 }}
          >
            p
          </motion.span>
        </div>
        
        {/* Shine effect */}
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}
