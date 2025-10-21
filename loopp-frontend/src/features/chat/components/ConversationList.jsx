// frontend/src/features/chat/components/ConversationList.jsx
import React from "react";
import { Search } from "lucide-react";

export default function ConversationList({
  conversations = [],
  activeConversationId,
  onConversationSelect,
  loading,
  error,
  mobileOpen,
  setMobileOpen,
}) {
  return (
    <>
      {/* Desktop / Large screens persistent sidebar */}
      <div className="hidden sm:flex w-72 lg:w-80 h-full flex-col border-r border-border bg-background">
        <Header />
        <Body
          conversations={conversations}
          activeConversationId={activeConversationId}
          onConversationSelect={onConversationSelect}
          loading={loading}
          error={error}
        />
      </div>

      {/* Mobile / Tablet drawer */}
      <div
        className={`sm:hidden fixed inset-0 z-40 transition ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {/* backdrop */}
        <div
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* panel */}
        <div
          className={`absolute left-0 top-0 h-full w-[86%] max-w-[320px] bg-background border-r border-border shadow-xl transform transition-transform ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Header onClose={() => setMobileOpen(false)} />
          <Body
            conversations={conversations}
            activeConversationId={activeConversationId}
            onConversationSelect={(id) => {
              onConversationSelect?.(id);
              setMobileOpen(false);
            }}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </>
  );
}

function Header({ onClose }) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-foreground">Messages</h1>
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm rounded-lg px-2 py-1 border border-border hover:bg-muted"
            >
              Close
            </button>
          )}
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search conversations…"
            className="pl-10 w-full bg-muted/50 border border-border/60 rounded-lg h-10 outline-none focus:ring-1 focus:ring-foreground/20"
          />
        </div>
      </div>
    </div>
  );
}

function Body({ conversations, activeConversationId, onConversationSelect, loading, error }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {error && !loading && (
        <div className="px-4 py-3 text-xs text-red-600">{error}</div>
      )}
      {loading && (
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}
      {!loading && (
        <div className="p-2">
          {conversations.map((c) => {
            const active = activeConversationId === c.id;
            const initials = c.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase();

            return (
              <button
                key={c.id}
                onClick={() => onConversationSelect?.(c.id)}
                className={`
                  w-full text-left p-3 rounded-lg transition-all duration-200 mb-1 relative group
                  ${active ? "bg-foreground text-background shadow-lg" : "hover:bg-muted/70"}
                `}
              >
                {c.isPinned && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-foreground/40 rounded-full" />
                )}

                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    {c.avatar ? (
                      <img
                        src={c.avatar}
                        alt={c.name}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={`h-11 w-11 rounded-full grid place-items-center text-sm font-semibold ${
                          active
                            ? "bg-background text-foreground"
                            : "bg-foreground text-background"
                        }`}
                      >
                        {initials}
                      </div>
                    )}
                    {c.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3
                        className={`font-medium truncate ${
                          active ? "text-background" : "text-foreground"
                        }`}
                      >
                        {c.name}
                      </h3>
                      <span
                        className={`text-[11px] ${
                          active ? "text-background/70" : "text-muted-foreground"
                        }`}
                      >
                        {c.time}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate ${
                          active ? "text-background/85" : "text-muted-foreground"
                        }`}
                      >
                        {c.typing ? "Typing…" : c.lastMessage || "—"}
                      </p>
                      {c.unreadCount > 0 && (
                        <span
                          className={`ml-2 rounded-full h-5 min-w-5 px-1.5 text-[11px] grid place-items-center ${
                            active
                              ? "bg-background text-foreground"
                              : "bg-foreground text-background"
                          }`}
                        >
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
