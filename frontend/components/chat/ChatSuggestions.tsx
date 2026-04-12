"use client";

import { Sparkles } from "lucide-react";

interface ChatSuggestionsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  primaryColor: string;
}

const DEFAULT_SUGGESTIONS = [
  "Que productos tienen disponibles?",
  "Cuales son los mas vendidos?",
  "Tienen envio gratis?",
  "Necesito ayuda con mi pedido",
];

export function ChatSuggestions({
  suggestions = DEFAULT_SUGGESTIONS,
  onSelect,
  primaryColor,
}: ChatSuggestionsProps) {
  return (
    <div className="px-5 pb-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-400 font-medium">
          Preguntas sugeridas
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((text, i) => (
          <button
            key={i}
            onClick={() => onSelect(text)}
            className="px-4 py-2.5 rounded-xl text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
