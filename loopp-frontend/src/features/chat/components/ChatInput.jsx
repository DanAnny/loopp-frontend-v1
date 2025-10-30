import { useState, useRef, useEffect } from "react";
import { Paperclip, Send, Smile, X, FileText, File } from "lucide-react";

const EMOJIS = [
  "😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘",
  "😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒",
  "😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡",
  "👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐",
  "👋","🤝","🙏","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🦷","🦴","👀","👁",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖",
  "🔥","✨","💫","⭐","🌟","💥","💯","✅","❌","⚠️","🚀","🎉","🎊","🎈","🎁","🏆",
];

export default function ChatInput({
  onSendMessage,
  onTypingChange,
  disabled = false,
  commands = [],
  onCommandRun,
}) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [attachments, setAttachments] = useState([]); // [{ file, name, size, type, preview? }]
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiRef = useRef(null);

  const filteredCommands = commands.filter(
    (cmd) => text.startsWith("/") && (cmd.hint || "").toLowerCase().includes(text.slice(1).toLowerCase())
  );

  useEffect(() => {
    if (text.trim()) {
      onTypingChange?.(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTypingChange?.(false), 1000);
    } else {
      onTypingChange?.(false);
    }
    return () => typingTimeoutRef.current && clearTimeout(typingTimeoutRef.current);
  }, [text, onTypingChange]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    if (showEmoji) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmoji]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (disabled) return;

    if (trimmed.startsWith("/") && filteredCommands.length > 0) {
      const cmd = filteredCommands[0];
      onCommandRun?.(cmd);
      setText("");
      setShowCommands(false);
      return;
    }

    // ✅ Send raw File objects (backend expects multipart "files")
    const files = attachments.map((a) => a.file).filter(Boolean);
    onSendMessage(trimmed, files);

    setText("");
    setAttachments([]);
    setShowCommands(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const picked = Array.from(files).filter((f) => f && typeof f.size === "number");
      const newAttachments = picked.map((file) => {
        const att = { file, name: file.name, size: file.size, type: file.type };
        if ((file.type || "").startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setAttachments((prev) =>
              prev.map((p) => (p.file === file ? { ...p, preview: reader.result } : p))
            );
          };
          reader.readAsDataURL(file);
        }
        return att;
      });

      setAttachments((prev) => {
        const seen = new Set(prev.map((p) => `${p.name}:${p.size}`));
        const dedup = newAttachments.filter((n) => !seen.has(`${n.name}:${n.size}`));
        return [...prev, ...dedup];
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const insertEmoji = (emoji) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setText(newText);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setText((prev) => prev + emoji);
    }
  };

  return (
    <div className="relative">
      {showCommands && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-[60]">
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.id}
              onClick={() => {
                onCommandRun?.(cmd);
                setText("");
                setShowCommands(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0"
            >
              <div className="text-sm font-medium text-black">{cmd.title}</div>
              {cmd.subtitle && <div className="text-xs text-gray-500 mt-0.5">{cmd.subtitle}</div>}
            </button>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, idx) => {
            const isImg = (att.type || "").startsWith("image/");
            const isPdf = att.type === "application/pdf" || att.name?.toLowerCase?.().endsWith(".pdf");
            return (
              <div key={idx} className="relative bg-gray-100 rounded-lg overflow-hidden group">
                {isImg && att.preview ? (
                  <div className="relative">
                    <img src={att.preview} alt={att.name} className="h-24 w-24 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="p-1.5 bg-red-500 hover:bg-red-600 rounded-full transition"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                      <span className="text-white text-[10px] truncate block">{att.name}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 min-w-[200px]">
                    <div className="p-2 bg-gray-200 rounded">
                      {isPdf ? <FileText className="w-5 h-5 text-red-600" /> : <File className="w-5 h-5 text-gray-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate font-medium">{att.name}</div>
                      <div className="text-[10px] text-gray-500">{(att.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button onClick={() => removeAttachment(idx)} className="p-1 hover:bg-gray-200 rounded transition">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2 p-2 rounded-2xl border border-gray-200 bg-white transition-all focus-within:border-gray-400">
        <button
          onClick={handleFileSelect}
          disabled={disabled}
          className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50 flex-shrink-0"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5 text-gray-600" />
        </button>

        <div className="relative flex-shrink-0" ref={emojiRef}>
          <button
            onClick={() => setShowEmoji((s) => !s)}
            disabled={disabled}
            className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
            aria-label="Insert emoji"
          >
            <Smile className="w-5 h-5 text-gray-600" />
          </button>

          {showEmoji && (
            <div className="absolute bottom-full left-0 mb-2 w-80 max-h-64 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 overflow-y-auto z-50">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => insertEmoji(emoji)}
                    className="text-2xl hover:bg-gray-100 rounded p-1 transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setShowCommands(e.target.value.startsWith("/"));
          }}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Chat is closed" : "Type a message..."}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent px-2 py-2 text-[15px] text-black placeholder:text-gray-500 resize-none outline-none disabled:opacity-50 max-h-[120px]"
        />

        <button
          onClick={handleSend}
          disabled={(!text.trim() && attachments.length === 0) || disabled}
          className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>

        <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" />
      </div>
    </div>
  );
}
