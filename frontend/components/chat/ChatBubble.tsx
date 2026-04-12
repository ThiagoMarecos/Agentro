"use client";

import { Bot, User } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

interface ChatBubbleProps {
  message: ChatMessage;
  primaryColor: string;
}

export function ChatBubble({ message, primaryColor }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
          isUser ? "text-white" : "bg-indigo-50 text-indigo-600"
        }`}
        style={isUser ? { backgroundColor: primaryColor } : undefined}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[70%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`rounded-2xl px-5 py-3 text-sm leading-relaxed ${
            isUser
              ? "text-white rounded-br-md shadow-sm"
              : "bg-gray-100 text-gray-800 rounded-bl-md"
          }`}
          style={isUser ? { backgroundColor: primaryColor } : undefined}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 px-2">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
