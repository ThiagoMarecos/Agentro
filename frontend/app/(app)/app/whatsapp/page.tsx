"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useStore } from "@/lib/context/StoreContext";
import { useAuth } from "@/app/providers/AuthProvider";
import { DashboardTour, type TourStep } from "@/components/onboarding-tour/DashboardTour";

const WHATSAPP_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="whatsapp-header"]',
    placement: "bottom",
    title: "Conectá tu WhatsApp Business",
    body: "Esta sección integra tu número de WhatsApp con Agentro. Una vez vinculado, el agente IA responde a tus clientes en automático con tu catálogo, precios y stock real. Atiende 24/7 sin que vos hagas nada.",
  },
  {
    selector: '[data-tour="whatsapp-connect-card"]',
    placement: "top",
    title: "Cómo se conecta",
    body: "Apretás 'Vincular número de WhatsApp' y te aparece un código QR. Lo escaneás desde WhatsApp → Dispositivos vinculados, igual que WhatsApp Web. Listo: el agente empieza a responder de inmediato. Tu número sigue funcionando normal en tu celular.",
  },
  {
    centered: true,
    title: "¿Y si necesito intervenir manualmente?",
    body: "En cualquier momento podés 'tomar control' de un chat desde el Pipeline IA — el bot se pausa y vos respondés directo. Cuando le devolvés el control, sigue desde donde quedó. También podés configurar reglas para que escale automáticamente a un humano (clientes VIP, montos altos, etc.).",
  },
];
import {
  getWhatsAppStatus,
  connectWhatsApp,
  getQRCode,
  getConnectionState,
  disconnectWhatsApp,
  removeWhatsApp,
  restartWhatsApp,
  type WhatsAppChannel,
} from "@/lib/api/whatsapp";
import {
  MessageSquare,
  Loader2,
  Wifi,
  WifiOff,
  QrCode,
  Phone,
  RefreshCw,
  Trash2,
  AlertCircle,
  Smartphone,
  Shield,
  Bot,
  Users,
} from "lucide-react";

type Step = "loading" | "not_configured" | "waiting_scan" | "connected";

export default function WhatsAppPage() {
  const { currentStore } = useStore();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("loading");
  const [channel, setChannel] = useState<WhatsAppChannel | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!currentStore) return;
    try {
      const status = await getWhatsAppStatus(currentStore.id);
      setChannel(status);
      if (!status) {
        setStep("not_configured");
      } else if (status.connection_status === "connected") {
        setStep("connected");
        stopPolling();
      } else {
        setStep("waiting_scan");
      }
    } catch {
      setStep("not_configured");
    }
  }, [currentStore, stopPolling]);

  useEffect(() => {
    fetchStatus();
    return () => stopPolling();
  }, [fetchStatus, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      if (!currentStore) return;
      try {
        const state = await getConnectionState(currentStore.id);
        if (state.connection_status === "connected") {
          stopPolling();
          await fetchStatus();
        }
      } catch {
        /* ignore */
      }
    }, 4000);
  }, [currentStore, stopPolling, fetchStatus]);

  useEffect(() => {
    if (step === "waiting_scan" && !pollRef.current) {
      startPolling();
    }
  }, [step, startPolling]);

  const handleConnect = async () => {
    if (!currentStore) return;
    setLoading(true);
    setError("");
    setQrCode(null);
    setPairingCode(null);
    try {
      const result = await connectWhatsApp(currentStore.id);
      if (result.qr_code) {
        setQrCode(result.qr_code);
        setPairingCode(result.pairing_code);
        setStep("waiting_scan");
        startPolling();
      } else {
        setStep("waiting_scan");
        startPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshQR = async () => {
    if (!currentStore) return;
    setLoading(true);
    setError("");
    try {
      const qr = await getQRCode(currentStore.id);
      if (qr.status === "already_connected") {
        await fetchStatus();
        return;
      }
      setQrCode(qr.qr_code);
      setPairingCode(qr.pairing_code);
      startPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al obtener QR");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentStore) return;
    if (!confirm("¿Desconectar WhatsApp? Los agentes dejarán de responder hasta que reconectes."))
      return;
    setLoading(true);
    try {
      await disconnectWhatsApp(currentStore.id);
      stopPolling();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al desconectar");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentStore) return;
    if (
      !confirm(
        "¿Eliminar WhatsApp completamente? Se eliminará la instancia y tendrás que volver a vincular tu número."
      )
    )
      return;
    setLoading(true);
    try {
      await removeWhatsApp(currentStore.id);
      stopPolling();
      setChannel(null);
      setQrCode(null);
      setPairingCode(null);
      setStep("not_configured");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!currentStore) return;
    setLoading(true);
    setError("");
    try {
      await restartWhatsApp(currentStore.id);
      setTimeout(() => fetchStatus(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reiniciar");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: string | null) => {
    if (!num) return null;
    if (num.length > 6) {
      return `+${num.slice(0, -10)} ${num.slice(-10, -7)} ${num.slice(-7, -4)} ${num.slice(-4)}`;
    }
    return `+${num}`;
  };

  if (!currentStore) {
    return <div className="text-gray-400">Selecciona una tienda</div>;
  }

  if (step === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div data-tour="whatsapp-header">
        <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 mb-1.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`${step === "connected" ? "animate-ping" : ""} absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${step === "connected" ? "bg-emerald-500" : "bg-gray-400"}`} />
          </span>
          {step === "connected" ? "CONECTADO · BOT ACTIVO" : "CANAL · WHATSAPP BUSINESS"}
        </div>
        <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2.5">
          <span className="inline-grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-sm shadow-emerald-500/30">
            <MessageSquare className="w-4.5 h-4.5" />
          </span>
          WhatsApp
        </h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-2xl">
          Conectá tu número de WhatsApp Business y dejá que el agente IA responda a tus clientes
          automáticamente 24/7. Tu número sigue funcionando normal en tu celular.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button
            onClick={() => setError("")}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* Sin configurar */}
      {step === "not_configured" && (
        <div data-tour="whatsapp-connect-card" className="relative bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
          {/* Header con gradiente */}
          <div className="relative bg-gradient-to-br from-emerald-50 via-green-50 to-white p-8 text-center border-b border-gray-100">
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
              backgroundImage: "radial-gradient(circle at 50% 0%, rgba(16,185,129,0.15) 0%, transparent 60%)",
            }} />
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                <Smartphone className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-display font-bold text-gray-900 mb-2">
                Vincular WhatsApp Business
              </h2>
              <p className="text-gray-600 text-sm max-w-md mx-auto leading-relaxed">
                Una vez vinculado, tu agente IA atiende a tus clientes automáticamente — productos,
                precios, stock, todo en tiempo real.
              </p>
            </div>
          </div>

          <div className="p-8">
            {/* Features grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
                  <Bot className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-gray-900 mb-0.5">IA conversacional</p>
                <p className="text-[11px] text-gray-500 leading-snug">Responde con tu catálogo y tono</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-100">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                  <Users className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <p className="text-xs font-semibold text-gray-900 mb-0.5">Atención 24/7</p>
                <p className="text-[11px] text-gray-500 leading-snug">Sin pausas, sin sueldo</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-white border border-purple-100">
                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
                  <Shield className="w-4.5 h-4.5 text-purple-600" />
                </div>
                <p className="text-xs font-semibold text-gray-900 mb-0.5">Conexión segura</p>
                <p className="text-[11px] text-gray-500 leading-snug">Tu chat sigue 100% privado</p>
              </div>
            </div>

            {/* Pasos */}
            <div className="mb-6 p-4 rounded-xl bg-gray-50/80 border border-gray-100">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-3">
                Cómo se hace · 3 pasos
              </p>
              <ol className="space-y-2 text-xs text-gray-600">
                <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold grid place-items-center text-[10px] flex-shrink-0 mt-0.5">1</span><span>Apretás <strong className="text-gray-900">"Vincular número"</strong> y te aparece un QR.</span></li>
                <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold grid place-items-center text-[10px] flex-shrink-0 mt-0.5">2</span><span>En tu celular: WhatsApp → <strong className="text-gray-900">Dispositivos vinculados</strong> → <strong className="text-gray-900">Vincular dispositivo</strong>.</span></li>
                <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold grid place-items-center text-[10px] flex-shrink-0 mt-0.5">3</span><span>Escaneás el QR y listo — el agente empieza a responder en segundos.</span></li>
              </ol>
            </div>

            {/* CTA */}
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-5 py-3.5 rounded-xl font-semibold text-sm hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 transition-all shadow-sm shadow-emerald-500/30"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              {loading ? "Generando código QR..." : "Vincular número de WhatsApp"}
            </button>
          </div>
        </div>
      )}

      {/* Esperando escaneo */}
      {step === "waiting_scan" && (
        <div className="bg-white rounded-xl border border-gray-200/60 p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Escaneá el código QR
            </h2>
            <p className="text-gray-500 text-sm">
              Abrí WhatsApp en tu celular &rarr; <strong>Dispositivos vinculados</strong> &rarr; <strong>Vincular dispositivo</strong>
            </p>
          </div>

          <div className="flex flex-col items-center gap-6">
            {qrCode ? (
              <div className="p-4 bg-white rounded-2xl border-2 border-green-200 shadow-sm">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
            ) : (
              <div className="w-64 h-64 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                <div className="text-center">
                  <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    Hacé click en &quot;Generar QR&quot;
                  </p>
                </div>
              </div>
            )}

            {pairingCode && pairingCode.length <= 12 && (
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Código de emparejamiento</p>
                <p className="text-2xl font-mono font-bold text-gray-900 tracking-widest">
                  {pairingCode}
                </p>
              </div>
            )}

            {qrCode && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                Esperando escaneo...
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRefreshQR}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                {loading ? "Generando..." : "Generar QR"}
              </button>
              <button
                onClick={handleRemove}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition text-sm font-medium disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conectado */}
      {step === "connected" && channel && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200/60 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <Wifi className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    WhatsApp activo
                  </h2>
                  <p className="text-sm text-green-600 font-medium">
                    Los agentes IA están atendiendo clientes
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                En línea
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {channel.profile_name && (
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Perfil</p>
                  <p className="text-sm font-medium text-gray-900">
                    {channel.profile_name}
                  </p>
                </div>
              )}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Número vinculado</p>
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-green-600" />
                  {formatNumber(channel.whatsapp_number) || "Detectando..."}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Instancia</p>
                <p className="text-sm font-medium text-gray-900 font-mono truncate">
                  {channel.instance_name}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200/60 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Gestión</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRestart}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Reiniciar conexión
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition text-sm font-medium disabled:opacity-50"
              >
                <WifiOff className="w-4 h-4" />
                Desconectar
              </button>
              <button
                onClick={handleRemove}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition text-sm font-medium disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar integración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tour de la página de WhatsApp */}
      {user && (
        <DashboardTour
          steps={WHATSAPP_TOUR_STEPS}
          storageKey={`agentro:tour-whatsapp:${user.id}`}
        />
      )}
    </div>
  );
}
