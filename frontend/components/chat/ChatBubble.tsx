"use client";

import { Bot, User } from "lucide-react";

export interface ChatMessageMedia {
  type: string;       // "image"
  url: string;        // URL pública (ej: /uploads/xxx.jpg o https://...)
  caption?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  media?: ChatMessageMedia[];
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
        {message.content && (
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
        )}

        {/* Imágenes adjuntas (productos enviados por el agente) */}
        {message.media && message.media.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {message.media.map((m, idx) =>
              m.type === "image" ? (
                <div
                  key={idx}
                  className="rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 max-w-xs"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={m.caption || "producto"}
                    className="block w-full h-auto"
                    loading="lazy"
                  />
                  {m.caption && (
                    <p className="text-xs text-gray-600 px-3 py-2 border-t border-gray-100">
                      {m.caption}
                    </p>
                  )}
                </div>
              ) : null
            )}
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-1.5 px-2">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
