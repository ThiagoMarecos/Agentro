"use client";

import { forwardRef, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  primaryColor: string;
  placeholder?: string;
}

export const ChatInput = forwardRef<HTMLInputElement, ChatInputProps>(
  function ChatInput(
    {
      value,
      onChange,
      onSend,
      sending,
      primaryColor,
      placeholder = "Escribe tu mensaje...",
    },
    ref
  ) {
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSend();
        }
      },
      [onSend]
    );

    return (
      <div className="shrink-0 border-t border-gray-200/60 bg-white px-5 py-5">
        <div className="max-w-2xl mx-auto flex gap-3">
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={sending}
            className="flex-1 px-5 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all duration-200 disabled:opacity-50"
          />
          <button
            onClick={onSend}
            disabled={sending || !value.trim()}
            className="px-4 py-3.5 rounded-xl text-white transition-all duration-200 shrink-0 disabled:opacity-40 hover:brightness-110 hover:shadow-md active:scale-95"
            style={{ backgroundColor: primaryColor }}
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    );
  }
);
