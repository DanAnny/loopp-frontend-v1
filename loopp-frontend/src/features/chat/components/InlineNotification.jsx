// src/features/chat/components/InlineNotification.jsx
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";

export default function InlineNotification({ notification, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(notification.id), 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const styles = {
    success: {
      bg: "bg-gradient-to-r from-green-50 to-emerald-50",
      border: "border-green-200",
      icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
      text: "text-green-900",
    },
    error: {
      bg: "bg-gradient-to-r from-red-50 to-rose-50",
      border: "border-red-200",
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      text: "text-red-900",
    },
    info: {
      bg: "bg-gradient-to-r from-blue-50 to-cyan-50",
      border: "border-blue-200",
      icon: <Info className="w-5 h-5 text-blue-600" />,
      text: "text-blue-900",
    },
    warning: {
      bg: "bg-gradient-to-r from-yellow-50 to-amber-50",
      border: "border-yellow-200",
      icon: <AlertCircle className="w-5 h-5 text-yellow-600" />,
      text: "text-yellow-900",
    },
  };

  const style = styles[notification.type] || styles.info;

  return (
    <div
      className={`${style.bg} ${style.border} border shadow-lg rounded-2xl p-4 mb-3 backdrop-blur-sm transition-all duration-300 ${
        isExiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      } animate-slide-down`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${style.text} leading-relaxed`}>
            {notification.message}
          </div>
          {notification.timestamp && (
            <div className="text-xs text-black/40 mt-1">
              {notification.timestamp}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => onDismiss(notification.id), 300);
          }}
          className="flex-shrink-0 p-1 hover:bg-black/5 rounded-lg transition"
          aria-label="Dismiss"
        >
          <svg
            className="w-4 h-4 text-black/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
