import { Edit2, Copy, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

export default function MessageContextMenu({
  x,
  y,
  onEdit,
  onCopy,
  onDelete,
  onClose,
  canEdit,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let nx = x;
      let ny = y;
      if (rect.right > vw) nx = vw - rect.width - 10;
      if (rect.bottom > vh) ny = vh - rect.height - 10;
      menuRef.current.style.left = `${nx}px`;
      menuRef.current.style.top = `${ny}px`;
    }
  }, [x, y]);

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-[100] bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 min-w-[180px] animate-scale-in"
        style={{ left: x, top: y }}
      >
        {canEdit && (
          <button
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition text-left"
          >
            <Edit2 className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">Edit message</span>
          </button>
        )}

        <button
          onClick={() => {
            onCopy();
            onClose();
          }}
          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition text-left"
        >
          <Copy className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Copy text</span>
        </button>

        {onDelete && canEdit && (
          <>
            <div className="h-px bg-gray-100 my-1.5" />
            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-50 transition text-left"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-600">Delete message</span>
            </button>
          </>
        )}
      </div>
    </>
  );
}
