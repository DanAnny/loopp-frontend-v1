// frontend/src/features/chat/components/ChatHeader.jsx
import React from "react";
import { MoreVertical, Search, ArrowLeft } from "lucide-react";

export default function ChatHeader({ contact, onBack, canClose=false, onClose, roomClosed=false }) {
  const initials = contact?.name
    ? contact.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "U";

  return (
    <div className="sticky top-0 z-10 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-3 md:px-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            className="sm:hidden h-9 w-9 rounded-full hover:bg-muted grid place-items-center"
            onClick={onBack}
            aria-label="Back to conversations"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <div className="relative">
          {contact?.avatar ? (
            <img src={contact.avatar} alt={contact.name} className="h-10 w-10 rounded-full ring-2 ring-foreground/10 object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full ring-2 ring-foreground/10 bg-foreground text-background grid place-items-center text-xs font-semibold">
              {initials}
            </div>
          )}
          {contact?.isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
          )}
        </div>

        <div className="flex flex-col">
          <h2 className="font-medium text-foreground">{contact?.name || "Unknown"}</h2>
          <p className="text-xs text-muted-foreground">
            {roomClosed ? "Closed" : contact?.status || "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* PM-only close action */}
        {canClose && !roomClosed && (
          <button
            type="button"
            onClick={onClose}
            className="hidden sm:inline-flex items-center px-3 h-9 rounded-full bg-foreground text-background hover:bg-foreground/90"
            title="Close Room"
          >
            Close Room
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1">
          <IconButton><Search className="h-4 w-4" /></IconButton>
          <IconButton><MoreVertical className="h-4 w-4" /></IconButton>
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="h-9 w-9 rounded-full hover:bg-muted transition grid place-items-center"
    >
      {children}
    </button>
  );
}
