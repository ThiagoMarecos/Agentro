"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  listSimulatorStores,
  getSimulatorConversation,
  sendSimulatorMessage,
  resetSimulator,
  getGlobalLearningMode,
  setGlobalLearningMode,
  type SimStore,
  type SimMessage,
} from "@/lib/api/admin-simulator";
import {
  MessageSquare,
  Send,
  RotateCcw,
  User,
  Bot,
  Loader2,
  Sparkles,
  AlertCircle,
  Settings2,
  Phone,
  Mail,
  Image as ImageIcon,
} from "lucide-react";

interface ChatTurn {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  media?: Array<{ url: string; b64?: string | null; caption?: string }>;
  ts: number;
}

const DEFAULT_IDENTIFIER = "+5959990000001";

export default function ChatSimulatorPage() {
  const [stores, setStores] = useState<SimStore[]>([]);
  const [storeId, setStoreId] = useState<string>("");
  const [identifier, setIdentifier] = useState<string>(DEFAULT_IDENTIFIER);
  const [identifierType, setIdentifierType] = useState<"phone" | "email">("phone");

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");

  const [learningGlobal, setLearningGlobal] = useState<boolean>(false);
  const [learningCount, setLearningCount] = useState({ agents: 0, stores: 0 });
  const [learningSaving, setLearningSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── load tiendas + learning status ──
  useEffect(() => {
    listSimulatorStores()
      .then((s) => {
        setStores(s);
        if (s.length > 0 && !storeId) setStoreId(s[0].id);
      })
      .catch((e) => setError(e.message || "Error cargando tiendas"));

    getGlobalLearningMode()
      .then((s) => {
        setLearningGlobal(s.enabled);
        setLearningCount({ agents: s.affected_agents, stores: s.affected_stores });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── load history al cambiar tienda/identifier ──
  const loadHistory = useCallback(async () => {
    if (!storeId || !identifier.trim()) return;
    setLoadingHistory(true);
    try {
      const data = await getSimulatorConversation(storeId, identifier.trim());
      setTurns(
        (data.messages || []).map((m: SimMessage, i: number) => ({
          id: m.id || `h-${i}`,
          role: (m.role as ChatTurn["role"]) || "assistant",
          content: m.content,
          ts: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
        }))
      );
      setStage(data.stage);
      setError("");
    } catch (e: any) {
      setError(e.message || "Error cargando historial");
    } finally {
      setLoadingHistory(false);
    }
  }, [storeId, identifier]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── auto-scroll ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !storeId || sending) return;
    setError("");

    // Optimistic — agregamos el mensaje del user al toque
    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      ts: Date.now(),
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setSending(true);

    try {
      const r = await sendSimulatorMessage(storeId, identifier.trim(), text);
      setStage(r.stage);
      setPaused(r.agent_paused);
      const assistantTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: r.response || (r.agent_paused ? "(agente pausado — vendedor humano tiene control)" : ""),
        media: (r.pending_media || []).map((m) => ({
          url: m.url,
          b64: m.b64,
          caption: m.caption,
        })),
        ts: Date.now(),
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (e: any) {
      setError(e.message || "Error al enviar");
      setTurns((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "system",
          content: `❌ ${e.message || "Error"}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onReset = async () => {
    if (!storeId) return;
    if (!confirm(`¿Borrar la conversación entera con ${identifier}?\nTambién se borrará el customer asociado para empezar como nuevo.`)) return;
    try {
      await resetSimulator(storeId, identifier.trim(), true);
      setTurns([]);
      setStage(null);
      setPaused(false);
      setError("");
    } catch (e: any) {
      setError(e.message || "Error al resetear");
    }
  };

  const onToggleLearning = async () => {
    setLearningSaving(true);
    try {
      const r = await setGlobalLearningMode(!learningGlobal);
      setLearningGlobal(r.enabled);
      setLearningCount({ agents: r.affected_agents, stores: r.affected_stores });
    } catch (e: any) {
      setError(e.message || "Error al cambiar learning mode");
    } finally {
      setLearningSaving(false);
    }
  };

  const onIdentifierTypeChange = (t: "phone" | "email") => {
    setIdentifierType(t);
    if (t === "phone" && !identifier.startsWith("+")) {
      setIdentifier(DEFAULT_IDENTIFIER);
    } else if (t === "email" && identifier.startsWith("+")) {
      setIdentifier("test@cliente.simulador");
    }
  };

  const newRandomIdentifier = () => {
    const rnd = Math.floor(Math.random() * 90000000) + 10000000;
    setIdentifier(identifierType === "phone" ? `+5959${rnd}` : `cliente-${rnd}@sim.local`);
  };

  return (
    <div className="min-h-[calc(100vh-7rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 inline-flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-500" /> Simulador de chat
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Actúa como un cliente de cualquier tienda sin necesitar WhatsApp ni números reales.
          </p>
        </div>
        <button
          onClick={onToggleLearning}
          disabled={learningSaving}
          className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition ${
            learningGlobal
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
          title={
            learningGlobal
              ? "Modo aprendizaje ACTIVO en todas las tiendas. Click para desactivar."
              : "Modo aprendizaje DESACTIVADO. Click para activarlo en TODAS las tiendas."
          }
        >
          {learningSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Settings2 className="w-3.5 h-3.5" />
          )}
          Modo aprendizaje:{" "}
          {learningGlobal ? (
            <span className="text-emerald-700">ON</span>
          ) : (
            <span className="text-gray-400">OFF</span>
          )}
          {learningGlobal && learningCount.agents > 0 && (
            <span className="text-[10px] text-emerald-600">
              · {learningCount.agents} agentes / {learningCount.stores} tiendas
            </span>
          )}
        </button>
      </div>

      {/* Config bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3 grid grid-cols-1 md:grid-cols-[1fr,1.5fr,auto] gap-3">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Tienda</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900"
          >
            {stores.length === 0 && <option>(cargando…)</option>}
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">
            Identifier (cliente virtual)
          </label>
          <div className="flex gap-1">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => onIdentifierTypeChange("phone")}
                className={`px-2 py-2 text-xs font-medium ${identifierType === "phone" ? "bg-indigo-50 text-indigo-700" : "text-gray-500"}`}
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onIdentifierTypeChange("email")}
                className={`px-2 py-2 text-xs font-medium ${identifierType === "email" ? "bg-indigo-50 text-indigo-700" : "text-gray-500"}`}
              >
                <Mail className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={identifierType === "phone" ? "+5959..." : "cliente@example.com"}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 font-mono"
            />
            <button
              onClick={newRandomIdentifier}
              className="px-2 py-2 text-xs border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600"
              title="Generar identifier aleatorio (cliente nuevo)"
            >
              ↻
            </button>
          </div>
        </div>
        <div className="flex items-end">
          <button
            onClick={onReset}
            disabled={turns.length === 0 || sending}
            className="px-3 py-2 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            title="Borra mensajes + sesión + customer (empezás de cero)"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="bg-white border border-gray-200 rounded-xl flex-1 flex flex-col overflow-hidden">
        {/* Stage indicator */}
        {stage && (
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 text-xs text-gray-600 flex items-center justify-between">
            <span>
              Stage actual: <strong className="text-gray-900">{stage}</strong>
            </span>
            {paused && (
              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                <AlertCircle className="w-3 h-3" /> agente pausado
              </span>
            )}
          </div>
        )}

        {/* Mensajes */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingHistory ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Cargando…
            </div>
          ) : turns.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-gray-500 mb-1">Conversación vacía</p>
              <p className="text-xs text-gray-400">
                Escribí "Hola" abajo para empezar. El agente te responderá como si fueras un cliente real.
              </p>
            </div>
          ) : (
            turns.map((t) => (
              <div
                key={t.id}
                className={`flex gap-2 ${t.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {t.role !== "user" && (
                  <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${
                    t.role === "system" ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                  }`}>
                    {t.role === "system" ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                )}
                <div className={`max-w-[70%]`}>
                  {t.content && (
                    <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      t.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-md"
                        : t.role === "system"
                        ? "bg-red-50 border border-red-200 text-red-700"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}>
                      {t.content}
                    </div>
                  )}
                  {t.media && t.media.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {t.media.map((m, i) => {
                        const src = m.b64
                          ? `data:image/jpeg;base64,${m.b64}`
                          : m.url.startsWith("/")
                          ? m.url
                          : m.url;
                        return (
                          <div key={i} className="rounded-xl overflow-hidden bg-gray-50 border border-gray-200 max-w-xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={m.caption || "media"} className="w-full h-auto block" loading="lazy" />
                            {m.caption && (
                              <p className="text-xs text-gray-600 px-3 py-1.5 border-t border-gray-100">{m.caption}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {t.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 grid place-items-center shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex gap-2 justify-start">
              <div className="w-8 h-8 rounded-full bg-indigo-100 grid place-items-center">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-100 p-3 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            autoFocus
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Escribí un mensaje como cliente…"
            disabled={sending || !storeId}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || sending || !storeId}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm inline-flex items-center gap-1.5"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
