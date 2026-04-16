"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Terminal as TerminalIcon,
  Brain,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Shield,
  Zap,
  RefreshCw,
} from "lucide-react";
import {
  aiDiagnose,
  aiAutoFix,
  DiagnoseResult,
  AutoFixResult,
} from "@/lib/api/terminal";

/* ── AI Panel ───────────────────────────────────────────────── */

function AIPanel({
  serviceName,
  serviceContext,
  onCommandExecuted,
  onLog,
}: {
  serviceName: string | null;
  serviceContext: string | null;
  onCommandExecuted?: () => void;
  onLog?: (text: string) => void;
}) {
  const [diagnosing, setDiagnosing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnoseResult | null>(null);
  const [fixResult, setFixResult] = useState<AutoFixResult | null>(null);
  const [error, setError] = useState("");

  const handleDiagnose = async () => {
    if (!serviceName || !serviceContext) return;
    setDiagnosing(true);
    setError("");
    setDiagnosis(null);
    setFixResult(null);
    try {
      const res = await aiDiagnose(serviceName, serviceContext);
      setDiagnosis(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDiagnosing(false);
    }
  };

  const handleAutoFix = async () => {
    if (!diagnosis || !serviceName || !serviceContext) return;
    setFixing(true);
    setError("");
    try {
      onLog?.(`\r\n\x1b[1;35m═══ AI Auto-Fix: ${serviceName} ═══\x1b[0m\r\n`);
      const res = await aiAutoFix(serviceName, serviceContext, diagnosis.commands);
      setFixResult(res);
      // Mostrar cada resultado en la terminal
      for (const r of res.results) {
        onLog?.(`\x1b[36m$ ${r.command}\x1b[0m\r\n`);
        if (r.stdout) onLog?.(r.stdout.replace(/\n/g, "\r\n"));
        if (r.stderr) onLog?.(`\x1b[31m${r.stderr.replace(/\n/g, "\r\n")}\x1b[0m`);
        onLog?.(`\x1b[${r.exit_code === 0 ? "32" : "31"}m[exit: ${r.exit_code}]\x1b[0m\r\n`);
      }
      onLog?.(`\r\n\x1b[1;35m═══ ${res.summary} ═══\x1b[0m\r\n\r\n`);
      onCommandExecuted?.();
    } catch (e: any) {
      setError(e.message);
      onLog?.(`\r\n\x1b[31mError: ${e.message}\x1b[0m\r\n`);
    } finally {
      setFixing(false);
    }
  };

  const riskColors = {
    low: "text-emerald-600 bg-emerald-50 border-emerald-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    high: "text-red-600 bg-red-50 border-red-200",
  };

  const riskLabels = {
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-600" />
            <h3 className="text-sm font-semibold text-gray-900">Asistente IA</h3>
          </div>
          {serviceName && (
            <span className="text-xs font-medium text-violet-600 bg-violet-100 px-2.5 py-1 rounded-full">
              {serviceName}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {!serviceName ? (
          <div className="text-center py-8">
            <Brain className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Ve a <strong>Sistema</strong> y clickeá un servicio con problemas para diagnosticar con IA
            </p>
          </div>
        ) : (
          <>
            {/* Context */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200/60">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contexto</p>
              <p className="text-sm text-gray-700">{serviceContext}</p>
            </div>

            {/* Diagnose button */}
            {!diagnosis && (
              <button
                onClick={handleDiagnose}
                disabled={diagnosing}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50"
              >
                {diagnosing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando con IA...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    Diagnosticar con IA
                  </>
                )}
              </button>
            )}

            {/* Diagnosis result */}
            {diagnosis && (
              <div className="space-y-3">
                {/* Analysis */}
                <div className="bg-violet-50 rounded-lg p-4 border border-violet-200/60">
                  <p className="text-sm text-violet-900 leading-relaxed">{diagnosis.analysis}</p>
                </div>

                {/* Risk Level */}
                <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${riskColors[diagnosis.risk_level]}`}>
                  <Shield className="w-3 h-3" />
                  Riesgo: {riskLabels[diagnosis.risk_level]}
                </div>

                {/* Commands */}
                {diagnosis.commands.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Comandos sugeridos ({diagnosis.commands.length})
                    </p>
                    {diagnosis.commands.map((cmd, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
                        <ChevronRight className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <code className="text-xs text-gray-100 font-mono break-all">{cmd}</code>
                      </div>
                    ))}
                  </div>
                )}

                {/* Auto-fix button */}
                {!fixResult && diagnosis.commands.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleAutoFix}
                      disabled={fixing}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white text-sm font-medium transition disabled:opacity-50 ${
                        diagnosis.risk_level === "high"
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {fixing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Ejecutando...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          {diagnosis.risk_level === "high" ? "Ejecutar (alto riesgo)" : "Ejecutar solución"}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => { setDiagnosis(null); setFixResult(null); }}
                      className="px-4 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Fix results */}
            {fixResult && (
              <div className="space-y-3">
                <div className={`rounded-lg p-4 border ${
                  fixResult.summary.includes("✅")
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-amber-50 border-amber-200"
                }`}>
                  <p className="text-sm font-medium">{fixResult.summary}</p>
                </div>

                {fixResult.results.map((r, i) => (
                  <div key={i} className="bg-gray-900 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
                      {r.exit_code === 0 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <code className="text-xs text-gray-300 font-mono">{r.command}</code>
                      <span className={`ml-auto text-[10px] font-mono ${
                        r.exit_code === 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        exit: {r.exit_code}
                      </span>
                    </div>
                    {(r.stdout || r.stderr) && (
                      <pre className="px-3 py-2 text-xs text-gray-400 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {r.stdout || r.stderr}
                      </pre>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => { setDiagnosis(null); setFixResult(null); }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Diagnosticar de nuevo
                </button>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Terminal Component ─────────────────────────────────────── */

function TerminalView({
  onConnectedChange,
  writeRef,
}: {
  onConnectedChange?: (connected: boolean) => void;
  writeRef?: React.MutableRefObject<((text: string) => void) | null>;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termInstance = useRef<any>(null);
  const fitAddon = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const connect = useCallback(async () => {
    if (connected || connecting) return;
    setConnecting(true);
    setError("");

    try {
      // Cargar xterm dinámicamente (solo cliente)
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      // Importar CSS
      // @ts-ignore
      await import("xterm/css/xterm.css");

      // Crear terminal
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        theme: {
          background: "#0f172a",
          foreground: "#e2e8f0",
          cursor: "#a78bfa",
          selectionBackground: "#334155",
          black: "#1e293b",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#f1f5f9",
          brightBlack: "#475569",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#facc15",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#f8fafc",
        },
        scrollback: 5000,
        convertEol: true,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);

      if (termRef.current) {
        termRef.current.innerHTML = "";
        term.open(termRef.current);
        fit.fit();
      }

      termInstance.current = term;
      fitAddon.current = fit;

      // Exponer write para que el AI panel pueda escribir
      if (writeRef) {
        writeRef.current = (text: string) => term.write(text);
      }

      term.writeln("\x1b[1;35m═══ Agentro VPS Terminal ═══\x1b[0m");
      term.writeln("\x1b[90mConectando al servidor...\x1b[0m\r\n");

      // WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/v1/admin/terminal/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Enviar token de autenticación
        const token = localStorage.getItem("agentro_access_token") || "";
        ws.send(JSON.stringify({ token }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "connected") {
            setConnected(true);
            setConnecting(false);
            onConnectedChange?.(true);
            term.writeln(`\x1b[32m${msg.data}\x1b[0m\r\n`);
          } else if (msg.type === "output") {
            term.write(msg.data);
          } else if (msg.type === "error") {
            term.writeln(`\r\n\x1b[31mError: ${msg.data}\x1b[0m\r\n`);
            setError(msg.data);
            setConnecting(false);
          }
        } catch {
          term.write(event.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        onConnectedChange?.(false);
        term.writeln("\r\n\x1b[33m[Desconectado]\x1b[0m\r\n");
      };

      ws.onerror = () => {
        setError("Error de conexión WebSocket");
        setConnecting(false);
      };

      // Terminal input → WebSocket
      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });

      // Resize
      const handleResize = () => {
        if (fitAddon.current) {
          fitAddon.current.fit();
          if (ws.readyState === WebSocket.OPEN && termInstance.current) {
            ws.send(JSON.stringify({
              type: "resize",
              cols: termInstance.current.cols,
              rows: termInstance.current.rows,
            }));
          }
        }
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } catch (e: any) {
      setError(e.message);
      setConnecting(false);
    }
  }, [connected, connecting, onConnectedChange]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    onConnectedChange?.(false);
  }, [onConnectedChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      termInstance.current?.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className={`w-3 h-3 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <div className="w-3 h-3 rounded-full bg-gray-600" />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {connected ? "VPS Terminal — Connected" : "VPS Terminal"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!connected ? (
            <button
              onClick={connect}
              disabled={connecting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {connecting ? "Conectando..." : "Conectar"}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition"
            >
              <Square className="w-3 h-3" />
              Desconectar
            </button>
          )}
        </div>
      </div>

      {/* Terminal area */}
      <div
        ref={termRef}
        className="flex-1 bg-[#0f172a] rounded-b-xl overflow-hidden"
        style={{ minHeight: "400px", padding: "8px" }}
      />

      {error && !connected && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */

export default function AdminTerminalPage() {
  const searchParams = useSearchParams();
  const serviceName = searchParams.get("service");
  const serviceStatus = searchParams.get("status");
  const serviceDetails = searchParams.get("details");
  const [terminalConnected, setTerminalConnected] = useState(false);
  const termWriteRef = useRef<((text: string) => void) | null>(null);

  const serviceContext = serviceName
    ? `Servicio ${serviceName} con estado ${serviceStatus || "error"}. Detalle: ${serviceDetails || "Sin detalles"}`
    : null;

  const handleLog = useCallback((text: string) => {
    if (termWriteRef.current) {
      termWriteRef.current(text);
    }
  }, []);

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Terminal - 60% */}
      <div className="flex-[3] flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TerminalIcon className="w-6 h-6 text-violet-600" />
            Terminal VPS
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Acceso SSH directo al servidor · Configura las credenciales en API Keys &gt; VPS / SSH
          </p>
        </div>
        <div className="flex-1 flex flex-col">
          <TerminalView onConnectedChange={setTerminalConnected} writeRef={termWriteRef} />
        </div>
      </div>

      {/* AI Panel - 40% */}
      <div className="flex-[2] min-w-0 overflow-y-auto">
        <AIPanel
          serviceName={serviceName}
          serviceContext={serviceContext}
          onLog={handleLog}
        />
      </div>
    </div>
  );
}
