"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Mail,
  Bot,
  User,
  Sparkles,
} from "lucide-react";
import { sendChatMessage } from "@/lib/api/chat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

/* ── Widget Typing Indicator ─────────────────────── */
function WidgetTyping() {
  return (
    <div className="flex items-end gap-2.5">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <Bot className="w-3.5 h-3.5" style={{ color: "var(--color-primary)" }} />
      </div>
      <div
        className="rounded-2xl rounded-bl-md px-4 py-3"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Widget Message Bubble ───────────────────────── */
function WidgetBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={
          isUser
            ? { backgroundColor: "var(--color-primary)" }
            : { backgroundColor: "var(--color-surface)" }
        }
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5" style={{ color: "var(--color-primary)" }} />
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser ? "text-white rounded-br-md" : "rounded-bl-md"
          }`}
          style={
            isUser
              ? { backgroundColor: "var(--color-primary)" }
              : {
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text)",
                }
          }
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
        <p
          className="text-[10px] mt-1 px-1.5"
          style={{ color: "var(--color-text)", opacity: 0.4 }}
        >
          {formatTime(msg.timestamp)}
        </p>
      </div>
    </div>
  );
}

/* ── Quick Suggestions ───────────────────────────── */
function WidgetSuggestions({ onSelect }: { onSelect: (text: string) => void }) {
  const suggestions = [
    "Que productos tienen?",
    "Los mas vendidos",
    "Info de envio",
  ];

  return (
    <div className="px-4 pb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles
          className="w-3 h-3"
          style={{ color: "var(--color-text)", opacity: 0.4 }}
        />
        <span
          className="text-[10px] font-medium"
          style={{ color: "var(--color-text)", opacity: 0.4 }}
        >
          Sugerencias
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((text, i) => (
          <button
            key={i}
            onClick={() => onSelect(text)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 hover:brightness-110"
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
/*              CHAT WIDGET                            */
/* ════════════════════════════════════════════════════ */

export function ChatWidget({ storeId }: { storeId?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [identified, setIdentified] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (identified && open) inputRef.current?.focus();
  }, [identified, open]);

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim()) return;
    setIdentified(true);
    setMessages([
      {
        role: "assistant",
        content:
          "Hola! Soy el asistente de esta tienda. En que puedo ayudarte?",
        timestamp: new Date(),
      },
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || sending || !storeId) return;

    const userMessage = input.trim();
    setInput("");
    setShowSuggestions(false);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, timestamp: new Date() },
    ]);
    setSending(true);

    try {
      const res = await sendChatMessage(
        storeId,
        "web_chat",
        customerEmail,
        userMessage
      );
      setConversationId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.response,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Disculpa, tuve un problema procesando tu mensaje. Podrias intentarlo de nuevo?",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionSelect = (text: string) => {
    setInput(text);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 z-50 hover:scale-105 hover:brightness-110"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {open ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 w-[400px] max-w-[calc(100vw-3rem)] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
          style={{
            height: "520px",
            backgroundColor: "var(--color-background)",
            border: "1px solid var(--color-border)",
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 border-b flex items-center gap-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--color-surface)" }}
            >
              <MessageCircle
                className="w-5 h-5"
                style={{ color: "var(--color-primary)" }}
              />
            </div>
            <div className="flex-1">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--color-text)" }}
              >
                Asistente IA
              </h3>
              <p className="text-xs text-green-500 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                En linea
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg transition-all duration-200 hover:brightness-125"
              style={{ color: "var(--color-text)", opacity: 0.5 }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!identified ? (
            /* ── Identification form ─────────────── */
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ backgroundColor: "var(--color-surface)" }}
              >
                <Mail
                  className="w-7 h-7"
                  style={{ color: "var(--color-primary)" }}
                />
              </div>
              <h4
                className="text-base font-semibold mb-1.5"
                style={{ color: "var(--color-text)" }}
              >
                Bienvenido!
              </h4>
              <p
                className="text-xs text-center mb-8 max-w-[240px] leading-relaxed"
                style={{ color: "var(--color-text)", opacity: 0.6 }}
              >
                Ingresa tu email para que podamos atenderte mejor
              </p>
              <form onSubmit={handleIdentify} className="w-full space-y-3">
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full px-4 py-3.5 rounded-xl text-sm placeholder:text-gray-400 focus:ring-1 focus:outline-none transition-all duration-200"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-primary)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border)";
                  }}
                />
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:brightness-110 hover:shadow-lg active:scale-[0.98]"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  Comenzar chat
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div className="flex-1 px-4 py-4 overflow-auto space-y-4">
                {messages.map((msg, i) => (
                  <WidgetBubble key={i} msg={msg} />
                ))}
                {sending && <WidgetTyping />}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions */}
              {showSuggestions && messages.length <= 1 && (
                <WidgetSuggestions onSelect={handleSuggestionSelect} />
              )}

              {/* Input area */}
              <div
                className="px-4 py-4 border-t"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex gap-2.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu mensaje..."
                    disabled={sending}
                    className="flex-1 px-4 py-3 rounded-xl text-sm placeholder:text-gray-400 focus:ring-1 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor =
                        "var(--color-primary)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-border)";
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    className="p-3 rounded-xl text-white transition-all duration-200 flex-shrink-0 disabled:opacity-40 hover:brightness-110 hover:shadow-md active:scale-95"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
