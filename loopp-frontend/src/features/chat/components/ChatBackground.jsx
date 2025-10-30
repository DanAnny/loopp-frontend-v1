// src/features/chat/components/ChatBackground.jsx
export default function ChatBackground({ variant = "client" }) {
  if (variant === "client") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1642789237369-f675f31576ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdWJ0bGUlMjBwYXR0ZXJuJTIwdGV4dHVyZSUyMGJhY2tncm91bmR8ZW58MXx8fHwxNzYxNjYyNTcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')",
            backgroundSize: "400px 400px",
            backgroundRepeat: "repeat",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/40 via-blue-50/20 to-blue-50/30" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="client-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#3b82f6" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#client-dots)" />
        </svg>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1642789237369-f675f31576ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdWJ0bGUlMjBwYXR0ZXJuJTIwdGV4dHVyZSUyMGJhY2tncm91bmR8ZW58MXx8fHwxNzYxNjYyNTcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')",
          backgroundSize: "350px 350px",
          backgroundRepeat: "repeat",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          filter: "grayscale(1) brightness(1.1)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/40" />
      <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="staff-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#000000" strokeWidth="0.5" opacity="0.2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#staff-grid)" />
      </svg>
    </div>
  );
}
