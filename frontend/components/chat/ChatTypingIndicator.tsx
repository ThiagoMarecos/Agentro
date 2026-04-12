"use client";

import { Bot } from "lucide-react";

export function ChatTypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 shadow-sm">
        <Bot className="w-4 h-4 text-indigo-600" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
