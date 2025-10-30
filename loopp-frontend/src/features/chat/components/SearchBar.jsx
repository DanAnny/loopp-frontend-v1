// src/features/chat/components/SearchBar.jsx
import { useState, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

// props: messages (array of {content: string,...}), onClose(), onResultSelect(index)

export default function SearchBar({ messages, onClose, onResultSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setCurrentIndex(0);
      return;
    }

    const searchResults = messages
      .map((msg, idx) => ({ ...msg, originalIndex: idx }))
      .filter(
        (msg) =>
          typeof msg.content === "string" &&
          msg.content.toLowerCase().includes(query.toLowerCase())
      );

    setResults(searchResults);
    setCurrentIndex(0);
  }, [query, messages]);

  const handleNext = () => {
    if (results.length === 0) return;
    const newIndex = (currentIndex + 1) % results.length;
    setCurrentIndex(newIndex);
    onResultSelect?.(results[newIndex].originalIndex);
  };

  const handlePrev = () => {
    if (results.length === 0) return;
    const newIndex =
      currentIndex === 0 ? results.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
    onResultSelect?.(results[newIndex].originalIndex);
  };

  useEffect(() => {
    if (results.length > 0) {
      onResultSelect?.(results[currentIndex].originalIndex);
    }
  }, [currentIndex, results, onResultSelect]);

  return (
    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search in conversation..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 transition"
        />
      </div>

      {results.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-600 font-medium">
            {currentIndex + 1} / {results.length}
          </div>
          <button
            onClick={handlePrev}
            className="p-1.5 hover:bg-gray-200 rounded transition"
            aria-label="Previous result"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 hover:bg-gray-200 rounded transition"
            aria-label="Next result"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      <button
        onClick={onClose}
        className="p-2 hover:bg-gray-200 rounded-lg transition"
        aria-label="Close search"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
