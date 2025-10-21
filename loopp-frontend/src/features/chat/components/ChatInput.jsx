// frontend/src/features/chat/components/ChatInput.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, Smile, Paperclip, X, Search, Lock } from "lucide-react";

/** ------------------------ Emoji data ------------------------ */
const EMOJI_CATEGORIES = [
  { name: "Smileys", emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 ☹️😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 🤯".split(" ") },
  { name: "Gestures", emojis: "👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👋 🤚 ✋ 🖖 👌 🤌 🤏 👈 👉 👆 👇 ☝️ ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🙏".split(" ") },
  { name: "People", emojis: "👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🧔 👱 👱‍♂️ 👱‍♀️ 👨‍🦰 👩‍🦰 👨‍🦱 👩‍🦱 👨‍🦳 👩‍🦳 👨‍🦲 👩‍🦲".split(" ") },
  { name: "Animals", emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🦆 🦅 🦉 🐺 🐗 🐴 🦄".split(" ") },
  { name: "Food", emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🥒 🥬 🧄 🧅".split(" ") },
  { name: "Objects", emojis: "⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📀 📷 🎥 📹 📸 📟 📞 ☎️ 📺 📻 🎙️ 🎚️ 🎛️ ⏰ ⏱️ ⏲️ 🕰️".split(" ") },
];

function InlineEmojiPicker({ onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const filtered = EMOJI_CATEGORIES.map((c) => ({
    ...c,
    emojis: q ? c.emojis.filter((e) => e.includes(q)) : c.emojis,
  }));

  return (
    <div className="w-[320px] sm:w-[360px] bg-white border border-border rounded-2xl shadow-xl p-2">
      <div className="flex items-center gap-2 px-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search emoji…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border/60 bg-muted/40 outline-none focus:border-foreground/30"
          />
        </div>
        <button className="px-3 py-2 text-xs rounded-lg hover:bg-muted transition" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="flex gap-1 mt-2 px-2 overflow-auto">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.name}
            onClick={() => setActive(i)}
            className={`px-2 py-1 rounded-lg text-xs whitespace-nowrap ${
              active === i ? "bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-2 max-h-56 overflow-y-auto px-1 pb-2">
        <div className="grid grid-cols-8 gap-1 text-xl">
          {filtered[active].emojis.map((e, idx) => (
            <button
              key={`${filtered[active].name}-${idx}-${e}`}
              className="h-10 w-10 grid place-items-center rounded-lg hover:bg-muted"
              onClick={() => onSelect?.(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** ------------------------ ChatInput with Slash Commands ------------------------ */
export default function ChatInput({
  onSendMessage,
  onTypingChange,
  typingText,
  disabled = false,              // room closed (read-only)
  // NEW props for slash commands:
  commands = [],                 // [{id, title, subtitle, hint}]
  onCommandRun,                  // (command) => Promise<void>
  role,                          // "PM" | "Engineer" | "Client" | ...
}) {
  const [message, setMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileRef = useRef(null);

  // typing debounce
  const typingRef = useRef(null);
  const lastValueRef = useRef("");

  // ---- Slash palette state
  const pmEnabled = role === "PM" && commands.length > 0;
  const [showCmd, setShowCmd] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdActiveIdx, setCmdActiveIdx] = useState(0);

  const filteredCommands = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      [c.title, c.subtitle, c.hint].filter(Boolean).some((s) => s.toLowerCase().includes(q))
    );
  }, [commands, cmdQuery]);

  useEffect(() => {
    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
      onTypingChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitTyping = (val) => {
    if (disabled) return;
    if (val !== lastValueRef.current) {
      onTypingChange?.(true);
      if (typingRef.current) clearTimeout(typingRef.current);
      typingRef.current = setTimeout(() => onTypingChange?.(false), 900);
      lastValueRef.current = val;
    }
  };

  const handleSend = () => {
    if (disabled) return;
    const text = message.trim();
    if (!text && attachments.length === 0) return;
    onSendMessage?.(text, attachments);
    setMessage("");
    setAttachments([]);
    onTypingChange?.(false);
    setShowEmoji(false);
    closeCmdPalette();
  };

  const openCmdPalette = () => {
    if (!pmEnabled) return;
    setShowCmd(true);
    setCmdQuery("");
    setCmdActiveIdx(0);
  };
  const closeCmdPalette = () => {
    setShowCmd(false);
    setCmdQuery("");
    setCmdActiveIdx(0);
  };

  const handleCommandChoose = async (cmd) => {
    closeCmdPalette();
    setMessage("");
    await onCommandRun?.(cmd);
  };

  const onKeyDown = (e) => {
    if (disabled) return;

    // Slash palette key handling
    if (showCmd) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCmdActiveIdx((i) => Math.min(i + 1, Math.max(filteredCommands.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCmdActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const chosen = filteredCommands[cmdActiveIdx];
        if (chosen) handleCommandChoose(chosen);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeCmdPalette();
        return;
      }
    }

    // Open palette if user hits "/" at start or after space
    if (pmEnabled && e.key === "/") {
      const caret = e.currentTarget.selectionStart ?? 0;
      const before = (message || "").slice(0, caret);
      const atStartOrAfterSpace = caret === 0 || /\s$/.test(before);
      if (atStartOrAfterSpace) {
        // Let "/" insert, then open palette on next tick so query starts empty
        setTimeout(openCmdPalette, 0);
      }
    }

    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onChange = (e) => {
    const val = e.target.value;
    setMessage(val);
    emitTyping(val);

    // Keep slash query synced while palette is open
    if (showCmd) {
      const caret = e.target.selectionStart ?? val.length;
      const left = val.slice(0, caret);
      const slashPos = left.lastIndexOf("/");
      const token = slashPos >= 0 ? left.slice(slashPos + 1) : "";
      setCmdQuery(token);
      // Close if the "/" was removed
      if (slashPos < 0) closeCmdPalette();
    }
  };

  const triggerAttach = () => !disabled && fileRef.current?.click();
  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };
  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };
  const onEmojiSelect = (emojiChar) => {
    if (disabled) return;
    setMessage((m) => m + emojiChar);
    emitTyping(message + emojiChar);
  };

  return (
    <div className="border-t border-border bg-background">
      <div className="p-3 md:p-4">
        {/* Closed ribbon */}
        {disabled && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Room is closed — view only
          </div>
        )}

        {/* Attachments preview */}
        {attachments.length > 0 && !disabled && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((f, idx) => (
              <div
                key={`${f.name}-${idx}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/40 text-xs"
              >
                <span className="truncate max-w-[160px]">{f.name}</span>
                <button type="button" className="p-1 rounded hover:bg-muted" onClick={() => removeAttachment(idx)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          {/* Slash command palette */}
          {pmEnabled && showCmd && (
            <div className="absolute -top-40 left-2 right-2 md:left-4 md:right-4 z-30 rounded-xl border bg-popover shadow-xl overflow-hidden">
              <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                Actions — type to filter, ↑/↓ then Enter
              </div>
              {filteredCommands.length ? (
                filteredCommands.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => handleCommandChoose(c)}
                    className={`w-full text-left px-4 py-3 transition flex items-start gap-3 ${
                      i === cmdActiveIdx ? "bg-muted/70" : "hover:bg-muted/40"
                    }`}
                    role="option"
                    aria-selected={i === cmdActiveIdx}
                  >
                    <div className="mt-0.5 text-lg leading-none">
                      {c.id === "invoice" ? "🧾" : "📹"}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{c.subtitle}</div>
                    </div>
                    <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">Enter</kbd>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-muted-foreground">No matches</div>
              )}
            </div>
          )}

          <div className="flex items-end gap-2 md:gap-3">
            {/* Attach */}
            <button
              type="button"
              onClick={triggerAttach}
              disabled={disabled}
              className="h-10 w-10 rounded-full hover:bg-muted transition grid place-items-center disabled:opacity-40"
              title={disabled ? "Room closed" : "Attach file"}
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />

            {/* Input */}
            <div className="flex-1 relative">
              <div
                className={`flex items-end rounded-2xl border transition-colors ${
                  disabled
                    ? "bg-muted/40 border-border/60"
                    : "bg-input-background border-border/60 focus-within:border-foreground/20"
                }`}
              >
                <textarea
                  value={message}
                  onChange={onChange}
                  onKeyDown={onKeyDown}
                  placeholder={
                    disabled
                      ? "Room is closed — view only"
                      : pmEnabled
                      ? "Type a message…  (hint: / for actions)"
                      : "Type a message… (hint: type '/rate' to rate this chat)"
                  }
                  rows={1}
                  className={`flex-1 bg-transparent border-0 outline-none rounded-2xl px-4 py-3 resize-none ${
                    disabled ? "cursor-not-allowed select-none opacity-60" : ""
                  }`}
                  readOnly={disabled}
                  aria-disabled={disabled}
                />

                {/* typing indicator */}
                {!!typingText && !disabled && (
                  <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground pr-2">
                    <TypingDots /> <span className="pr-2">{typingText}</span>
                  </div>
                )}

                <div className="relative">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full hover:bg-muted m-1 grid place-items-center disabled:opacity-40"
                    title={disabled ? "Room closed" : "Emoji"}
                    onClick={() => !disabled && setShowEmoji((s) => !s)}
                    disabled={disabled}
                  >
                    <Smile className="h-4 w-4" />
                  </button>

                  {showEmoji && !disabled && (
                    <div className="absolute bottom-11 right-0 z-50">
                      <InlineEmojiPicker onSelect={onEmojiSelect} onClose={() => setShowEmoji(false)} />
                    </div>
                  )}
                </div>
              </div>

              {/* typing on mobile */}
              {!!typingText && !disabled && (
                <div className="md:hidden flex items-center gap-2 text-xs text-muted-foreground pl-2 pt-1">
                  <TypingDots /> <span>{typingText}</span>
                </div>
              )}
            </div>

            {/* Send */}
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || (!message.trim() && attachments.length === 0)}
              className="h-10 w-10 rounded-full bg-foreground text-background grid place-items-center transition-all duration-200 hover:bg-foreground/90 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
              title={disabled ? "Room closed" : "Send"}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <Dot delay="0ms" />
      <Dot delay="120ms" />
      <Dot delay="240ms" />
    </span>
  );
}
function Dot({ delay }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}
