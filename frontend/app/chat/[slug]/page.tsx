"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Store, Loader2 } from "lucide-react";
import { getStore } from "@/lib/api/storefront";
import { sendChatMessage } from "@/lib/api/chat";
import {
  ChatHeader,
  ChatBubble,
  ChatTypingIndicator,
  ChatInput,
  ChatSuggestions,
  ChatIdentifyForm,
  type ChatMessage,
} from "@/components/chat";

/* ── Types ─────────────────────────────────────────── */

interface StoreData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  currency?: string;
  theme?: {
    template_name: string;
    custom_config?: {
      colors?: {
        primary?: string;
        background?: string;
        surface?: string;
        text?: string;
        border?: string;
      };
    };
  };
}

/* ── Date separator ────────────────────────────────── */

function DateSeparator({ date }: { date: Date }) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const label = isToday
    ? "Hoy"
    : isYesterday
    ? "Ayer"
    : date.toLocaleDateString("es", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex-1 h-px bg-gray-200/60" />
      <span className="text-[11px] text-gray-400 font-medium px-1">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-200/60" />
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
/*              CHAT PAGE                              */
/* ════════════════════════════════════════════════════ */

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-gray-50 flex items-center justify-center"
          style={{ colorScheme: "light" }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Cargando chat...</p>
          </div>
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const isEmbed = searchParams.get("embed") === "1";

  /* ── Store state ───────────────────────────────── */
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [suspended, setSuspended] = useState(false);

  /* ── Chat state ────────────────────────────────── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [identified, setIdentified] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Effects ───────────────────────────────────── */

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Load store data
  useEffect(() => {
    if (!slug) return;
    getStore(slug)
      .then((data) => {
        setStore(data);
        if (data.favicon_url) {
          let link = document.querySelector(
            "link[rel='icon']"
          ) as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = data.favicon_url;
        }
        if (data.name) document.title = `Chat - ${data.name}`;
      })
      .catch((e) => {
        if (e.message === "STORE_SUSPENDED") setSuspended(true);
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // Focus input after identification
  useEffect(() => {
    if (identified) inputRef.current?.focus();
  }, [identified]);

  const primaryColor =
    store?.theme?.custom_config?.colors?.primary || "#6366f1";

  /* ── Handlers ──────────────────────────────────── */

  const handleIdentify = (name: string, email: string) => {
    setCustomerName(name);
    setCustomerEmail(email);
    setIdentified(true);

    const greeting = name
      ? `Hola ${name}! Soy el asistente de ${store?.name || "esta tienda"}. En que puedo ayudarte?`
      : `Hola! Soy el asistente de ${store?.name || "esta tienda"}. En que puedo ayudarte?`;

    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: greeting,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !store?.id) return;

    const userMessage = input.trim();
    setInput("");
    setShowSuggestions(false);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await sendChatMessage(
        store.id,
        "web_chat",
        customerEmail,
        userMessage
      );
      setConversationId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: res.response,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
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
  }, [input, sending, store?.id, customerEmail]);

  const handleSuggestionSelect = (text: string) => {
    setInput(text);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  /* ── Loading state ─────────────────────────────── */
  if (loading) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center"
        style={{ colorScheme: "light" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Cargando chat...</p>
        </div>
      </div>
    );
  }

  /* ── Not found state ───────────────────────────── */
  if (notFound) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center px-6"
        style={{ colorScheme: "light" }}
      >
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-8">
            <Store className="w-9 h-9 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tienda no encontrada
          </h1>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            No encontramos la tienda que buscas. Verifica el link e intenta de
            nuevo.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200 shadow-sm"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  /* ── Suspended state ───────────────────────────── */
  if (suspended) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center px-6"
        style={{ colorScheme: "light" }}
      >
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-8">
            <Store className="w-9 h-9 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tienda no disponible
          </h1>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            Esta tienda no esta disponible en este momento. Intenta de nuevo mas
            tarde.
          </p>
        </div>
      </div>
    );
  }

  /* ── Main chat layout ──────────────────────────── */
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      style={{ colorScheme: "light" }}
    >
      {/* Header */}
      <ChatHeader
        storeName={store?.name || "Tienda"}
        storeSlug={slug}
        logoUrl={store?.logo_url}
        primaryColor={primaryColor}
        isEmbed={isEmbed}
      />

      {/* Chat area */}
      <div
        className={`flex-1 flex flex-col w-full ${
          isEmbed ? "" : "max-w-2xl mx-auto"
        }`}
      >
        {!identified ? (
          <ChatIdentifyForm
            storeName={store?.name || "nosotros"}
            primaryColor={primaryColor}
            onIdentify={handleIdentify}
          />
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
              <DateSeparator date={new Date()} />

              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  primaryColor={primaryColor}
                />
              ))}

              {sending && <ChatTypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {showSuggestions && messages.length <= 1 && (
              <ChatSuggestions
                suggestions={[
                  "Que productos tienen disponibles?",
                  "Cuales son los mas vendidos?",
                  "Tienen envio gratis?",
                  "Necesito ayuda con mi pedido",
                ]}
                onSelect={handleSuggestionSelect}
                primaryColor={primaryColor}
              />
            )}

            {/* Input */}
            <ChatInput
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSend={handleSend}
              sending={sending}
              primaryColor={primaryColor}
            />
          </>
        )}
      </div>

      {/* Footer */}
      {!isEmbed && (
        <div className="shrink-0 py-4 text-center border-t border-gray-100 bg-white">
          <p className="text-[11px] text-gray-400">
            Powered by{" "}
            <Link
              href="/"
              className="font-semibold text-indigo-600 hover:text-indigo-700 transition"
            >
              Nexora
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
