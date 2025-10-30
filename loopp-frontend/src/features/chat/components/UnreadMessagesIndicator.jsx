import { ChevronDown } from "lucide-react";

export default function UnreadMessagesIndicator({ count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 z-20 flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-gray-800 transition-all hover:scale-105 active:scale-95 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <ChevronDown className="w-4 h-4" />
      <span className="font-medium">
        {count} {count === 1 ? "new message" : "new messages"}
      </span>
    </button>
  );
}
