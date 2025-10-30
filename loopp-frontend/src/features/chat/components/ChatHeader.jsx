import { Search } from "lucide-react";


export default function ChatHeader({
  contact,
  onBack,
  onSearchToggle,
}) {

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-white border-gray-200">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            className="sm:hidden p-2 -ml-2 rounded-full transition hover:bg-gray-100"
            aria-label="Back"
            type="button"
          >
            <svg className="w-5 h-5 text-gray-900" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            {contact?.avatar ? (
              <img
                src={contact.avatar}
                alt={contact?.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full grid place-items-center bg-gradient-to-br from-gray-200 to-gray-300">
                <span className="text-sm font-semibold text-gray-700">
                  {(contact?.name || "U").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {contact?.isOnline ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
            ) : null}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px] truncate text-gray-900">
              {contact?.name || "Unknown"}
            </div>
            <div className="text-xs truncate flex items-center gap-3 text-gray-600">
              <span className="truncate">{contact?.status || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onSearchToggle}
          className="p-2 rounded-full transition hover:bg-gray-100"
          aria-label="Search messages"
          type="button"
        >
          <Search className="w-4 h-4 text-gray-700" />
        </button>
      </div>
    </div>
  );
}
