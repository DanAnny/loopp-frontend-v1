import { Search, Circle } from "lucide-react";
import { useState } from "react";

export default function ConversationList({
  conversations = [],
  activeConversationId = null,
  onConversationSelect,
  loading = false,
  error = "",
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter((conv) =>
    (conv.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="p-4 text-center text-sm text-gray-500">Loading conversations...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 py-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:bg-gray-200 transition"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {searchQuery ? "No conversations found" : "No conversations yet"}
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onConversationSelect?.(conv.id)}
              className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition border-b border-gray-100 ${
                activeConversationId === conv.id ? "bg-gray-100" : ""
              }`}
            >
              <div className="relative flex-shrink-0">
                {conv.avatar ? (
                  <img src={conv.avatar} alt={conv.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 grid place-items-center">
                    <span className="text-sm font-semibold text-gray-700">
                      {(conv.name || "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                {conv.isOnline !== false ? (
                  <Circle className="absolute bottom-0 right-0 w-3 h-3 fill-green-500 text-green-500 border-2 border-white rounded-full" />
                ) : (
                  <Circle className="absolute bottom-0 right-0 w-3 h-3 fill-gray-400 text-gray-400 border-2 border-white rounded-full" />
                )}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="font-semibold text-[15px] text-black truncate">{conv.name}</div>
                  <div className="text-[11px] text-gray-500 flex-shrink-0">{conv.time}</div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] text-gray-600 truncate">
                    {conv.typing ? <span className="italic text-blue-600">typing...</span> : conv.lastMessage || "Click to view chat"}
                  </div>

                  {conv.unreadCount > 0 ? (
                    <div className="flex-shrink-0 min-w-[18px] h-[18px] px-1.5 bg-black text-white text-[11px] rounded-full grid place-items-center font-medium">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </div>
                  ) : null}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
