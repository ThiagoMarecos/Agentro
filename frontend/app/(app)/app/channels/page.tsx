"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useStore } from "@/lib/context/StoreContext";
import { getStoredToken } from "@/lib/auth";
import {
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
  Trash2,
  HelpCircle,
  MessageCircle,
  Store,
  Code2,
  QrCode,
  Share2,
  X,
  Info,
  Check,
} from "lucide-react";

const API_URL = "/api/v1";

function authHeaders(storeId: string) {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Store-ID": storeId,
  };
}

interface DomainStatus {
  custom_domain: string | null;
  domain_verified: boolean;
  agentro_subdomain: string;
  dns_target: string;
  required_records: { type: string; name: string; value: string; description: string }[];
}

/* ── Toast ─────────────────────────────────────────── */
function ToastBanner({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
        type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {message}
    </div>
  );
}

/* ── Modal ─────────────────────────────────────────── */
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-display font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Status badge ────────────────────────────────── */
function StatusBadge({ label, color }: { label: string; color: "green" | "amber" | "gray" | "indigo" }) {
  const styles = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    gray: "bg-gray-100 text-gray-500 border-gray-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles[color]}`}>
      {label}
    </span>
  );
}

/* ── Copyable field ──────────────────────────────── */
function CopyField({ label, value, onCopy, mono }: { label?: string; value: string; onCopy: (v: string) => void; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {label && <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200/60">
        <span className={`flex-1 text-sm ${mono ? "font-mono" : ""} text-gray-900 truncate select-all`}>
          {value}
        </span>
        <button
          onClick={handleCopy}
          className={`p-1.5 rounded-md transition shrink-0 ${
            copied ? "bg-green-50 text-green-600" : "hover:bg-white text-gray-400 hover:text-indigo-600"
          }`}
          title="Copiar"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
/*                     MAIN PAGE                       */
/* ════════════════════════════════════════════════════ */
export default function ChannelsPage() {
  const { currentStore } = useStore();

  const [domainStatus, setDomainStatus] = useState<DomainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Domain state
  const [domainInput, setDomainInput] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removingDomain, setRemovingDomain] = useState(false);
  const [domainError, setDomainError] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; message: string } | null>(null);

  // Modals
  const [widgetModal, setWidgetModal] = useState(false);
  const [domainModal, setDomainModal] = useState(false);
  const [faqModal, setFaqModal] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copiado al portapapeles");
  }, [showToast]);

  const fetchDomainStatus = useCallback(async () => {
    if (!currentStore) return;
    try {
      const res = await fetch(`${API_URL}/stores/current/domain`, {
        headers: authHeaders(currentStore.id),
      });
      if (res.ok) {
        const data = await res.json();
        setDomainStatus(data);
        if (data.custom_domain) setDomainInput(data.custom_domain);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [currentStore]);

  useEffect(() => { fetchDomainStatus(); }, [fetchDomainStatus]);

  // Domain handlers
  const handleSaveDomain = async () => {
    if (!currentStore || !domainInput.trim()) return;
    setSavingDomain(true);
    setDomainError("");
    setVerifyResult(null);
    try {
      const res = await fetch(`${API_URL}/stores/current/domain`, {
        method: "POST",
        headers: authHeaders(currentStore.id),
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error al guardar");
      }
      const data = await res.json();
      setDomainStatus(data);
      showToast("Dominio guardado. Ahora configura el DNS.");
    } catch (e) {
      setDomainError(e instanceof Error ? e.message : "Error");
    } finally { setSavingDomain(false); }
  };

  const handleVerifyDomain = async () => {
    if (!currentStore) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`${API_URL}/stores/current/domain/verify`, {
        method: "POST",
        headers: authHeaders(currentStore.id),
      });
      const data = await res.json();
      setVerifyResult(data);
      if (data.verified) {
        showToast("Dominio verificado");
        fetchDomainStatus();
      }
    } catch {
      setVerifyResult({ verified: false, message: "Error al verificar" });
    } finally { setVerifying(false); }
  };

  const handleRemoveDomain = async () => {
    if (!currentStore) return;
    setRemovingDomain(true);
    try {
      await fetch(`${API_URL}/stores/current/domain`, {
        method: "DELETE",
        headers: authHeaders(currentStore.id),
      });
      setDomainStatus((prev) => prev ? { ...prev, custom_domain: null, domain_verified: false, required_records: [] } : prev);
      setDomainInput("");
      setVerifyResult(null);
      showToast("Dominio desvinculado");
    } catch { showToast("Error al desvincular", "error"); }
    finally { setRemovingDomain(false); }
  };

  if (!currentStore) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Selecciona una tienda</div>;
  }

  const storeSlug = currentStore.slug || "mi-tienda";
  const subdomain = domainStatus?.agentro_subdomain || `${storeSlug}.agentro.app`;
  const hasDomain = !!domainStatus?.custom_domain;
  const isDomainVerified = !!domainStatus?.domain_verified;

  // URLs funcionales (relativas para dev, absolutas para compartir)
  const storefrontPath = `/store/${storeSlug}`;
  const chatPath = `/chat/${storeSlug}`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const storefrontUrl = `${origin}/store/${storeSlug}`;
  const chatUrl = `${origin}/chat/${storeSlug}`;
  const widgetScriptUrl = `${origin}/api/v1/widget/${currentStore.id}.js`;
  const widgetScript = `<script src="${widgetScriptUrl}" async></script>`;

  return (
    <div className="max-w-5xl mx-auto">
      {toast && <ToastBanner message={toast.message} type={toast.type} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Canales</h1>
          <p className="text-sm text-gray-400 mt-1">
            Todas las formas en que tus clientes pueden encontrarte y comunicarse con vos.
          </p>
        </div>
        <button
          onClick={() => setFaqModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
        >
          <HelpCircle className="w-4 h-4" />
          Preguntas frecuentes
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 bg-white rounded-xl border border-gray-200/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ═══════════════════════════════════════════ */}
          {/* CANAL 1: Tu tienda Agentro                   */}
          {/* ═══════════════════════════════════════════ */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-6 flex flex-col">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-semibold text-gray-900">Tu tienda Agentro</h2>
                  <StatusBadge label="Activa" color="green" />
                </div>
                <p className="text-sm text-gray-500">
                  Tu tienda online con catalogo, carrito y checkout. Ya esta funcionando y lista para recibir clientes.
                </p>
              </div>
            </div>

            <CopyField label="Direccion de tu tienda" value={storefrontUrl} onCopy={copyToClipboard} mono />

            <div className="flex gap-2 mt-auto pt-4">
              <Link
                href={storefrontPath}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir tienda
              </Link>
              <button
                onClick={() => copyToClipboard(storefrontUrl)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Share2 className="w-4 h-4" />
                Compartir link
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════ */}
          {/* CANAL 2: Widget de chat                      */}
          {/* ═══════════════════════════════════════════ */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-6 flex flex-col">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Code2 className="w-5 h-5 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-semibold text-gray-900">Widget de chat</h2>
                  <StatusBadge label="Listo" color="indigo" />
                </div>
                <p className="text-sm text-gray-500">
                  Agrega una burbuja de chat con IA en tu pagina web existente. Se instala con una sola linea de codigo.
                </p>
              </div>
            </div>

            <CopyField label="Codigo para tu web" value={widgetScript} onCopy={copyToClipboard} mono />

            <div className="flex gap-2 mt-auto pt-4">
              <button
                onClick={() => copyToClipboard(widgetScript)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Copy className="w-4 h-4" />
                Copiar codigo
              </button>
              <button
                onClick={() => setWidgetModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Info className="w-4 h-4" />
                Como instalar
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════ */}
          {/* CANAL 3: Link directo al chat                */}
          {/* ═══════════════════════════════════════════ */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-6 flex flex-col">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-semibold text-gray-900">Link directo al chat</h2>
                  <StatusBadge label="Activo" color="green" />
                </div>
                <p className="text-sm text-gray-500">
                  Un link que abre el chat con tu agente IA. Compartilo en redes sociales, bio de Instagram, tarjetas de visita o como QR.
                </p>
              </div>
            </div>

            <CopyField label="Link de chat" value={chatUrl} onCopy={copyToClipboard} mono />

            <div className="flex items-center gap-2 mt-auto pt-4">
              <Link
                href={chatPath}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <ExternalLink className="w-4 h-4" />
                Probar chat
              </Link>
              <button
                onClick={() => copyToClipboard(chatUrl)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Share2 className="w-4 h-4" />
                Compartir
              </button>
              <div className="flex items-center gap-1.5 ml-auto text-xs text-gray-400">
                <QrCode className="w-3.5 h-3.5" />
                <span>Ideal para QR</span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════ */}
          {/* CANAL 4: Dominio personalizado               */}
          {/* ═══════════════════════════════════════════ */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-6 flex flex-col">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-semibold text-gray-900">Dominio propio</h2>
                  <StatusBadge
                    label={isDomainVerified ? "Conectado" : hasDomain ? "Pendiente DNS" : "Opcional"}
                    color={isDomainVerified ? "green" : hasDomain ? "amber" : "gray"}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  {hasDomain
                    ? `Tu dominio ${domainStatus?.custom_domain} ${isDomainVerified ? "esta conectado y funcionando." : "esta configurado pero falta verificar el DNS."}`
                    : "Usa tu propio dominio (ej: www.mitienda.com) en vez del subdominio de Agentro."
                  }
                </p>
              </div>
            </div>

            {/* Verified success */}
            {isDomainVerified && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-green-50 border border-green-200/40 mb-4">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-700 font-mono truncate">{domainStatus?.custom_domain}</p>
              </div>
            )}

            {/* Domain input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="www.mitienda.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-mono text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveDomain()}
                />
              </div>
              <button
                onClick={handleSaveDomain}
                disabled={savingDomain || !domainInput.trim()}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-1.5 shrink-0"
              >
                {savingDomain && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {hasDomain ? "Actualizar" : "Conectar"}
              </button>
            </div>
            {domainError && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                {domainError}
              </div>
            )}

            {/* Verify result */}
            {verifyResult && (
              <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${verifyResult.verified ? "text-green-600" : "text-amber-600"}`}>
                {verifyResult.verified ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {verifyResult.message}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-auto pt-4">
              {hasDomain && !isDomainVerified && (
                <button
                  onClick={handleVerifyDomain}
                  disabled={verifying}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {verifying ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Verificar DNS
                </button>
              )}
              <button
                onClick={() => setDomainModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                {hasDomain ? <Info className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
                {hasDomain ? "Instrucciones DNS" : "Que es esto?"}
              </button>
              {hasDomain && (
                <button
                  onClick={handleRemoveDomain}
                  disabled={removingDomain}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Desvincular
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* MODAL: Widget installation instructions              */}
      {/* ════════════════════════════════════════════════════ */}
      <Modal open={widgetModal} onClose={() => setWidgetModal(false)} title="Como instalar el widget de chat">
        <div className="space-y-5">
          <div className="rounded-xl bg-violet-50/50 border border-violet-200/40 p-4">
            <p className="text-sm text-gray-600">
              Si ya tenes tu pagina web (WordPress, Wix, Shopify, o la que sea), podes agregar una burbuja de chat en tu sitio.
              Tus clientes te van a poder escribir sin salir de tu pagina, y el agente IA de Agentro les responde automaticamente.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Copia el codigo de abajo</p>
                <p className="text-sm text-gray-500 mt-0.5">Es una sola linea de codigo. No necesitas saber programar.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900">
                  Pegalo en tu pagina web antes de{" "}
                  <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">&lt;/body&gt;</code>
                </p>
                <ul className="mt-2 ml-4 space-y-1.5 text-gray-500 list-disc">
                  <li><strong>WordPress:</strong> Apariencia &gt; Editor de temas &gt; footer.php</li>
                  <li><strong>Wix:</strong> Configuracion &gt; Custom code &gt; Body</li>
                  <li><strong>Shopify:</strong> Temas &gt; Editar codigo &gt; theme.liquid</li>
                  <li><strong>Cualquier otra:</strong> Busca &quot;Scripts adicionales&quot; o &quot;Custom code&quot;</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Listo!</p>
                <p className="text-sm text-gray-500 mt-0.5">La burbuja de chat va a aparecer en tu sitio automaticamente.</p>
              </div>
            </div>
          </div>

          <CopyField label="Tu codigo de chat" value={widgetScript} onCopy={copyToClipboard} mono />

          <div className="flex items-start gap-2.5 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
            <span>El chat usa los mismos agentes IA que configuraste en Agentro. Si cambias algo aca, se actualiza automaticamente en tu web.</span>
          </div>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════ */}
      {/* MODAL: Domain instructions / DNS steps               */}
      {/* ════════════════════════════════════════════════════ */}
      <Modal open={domainModal} onClose={() => setDomainModal(false)} title="Dominio personalizado">
        <div className="space-y-5">
          {!hasDomain && (
            <div className="rounded-xl bg-gray-50 border border-gray-200/60 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Que significa esto?</h3>
              <p className="text-sm text-gray-600">
                En vez de que tus clientes entren a <span className="font-mono text-indigo-600">{subdomain}</span>, pueden entrar a tu propio dominio como <span className="font-mono text-indigo-600">www.mitienda.com</span>.
              </p>
              <p className="text-sm text-gray-600">
                Necesitas tener un dominio propio (se compra en sitios como GoDaddy, Namecheap o Cloudflare por ~$10/anio). Si no tenes uno, no te preocupes: tu tienda ya funciona perfectamente con tu direccion de Agentro.
              </p>
            </div>
          )}

          {hasDomain && !isDomainVerified && (
            <>
              <h3 className="text-sm font-semibold text-gray-900">Configura tu dominio en 3 pasos:</h3>

              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Entra al panel de tu proveedor de dominio</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Puede ser GoDaddy, Namecheap, Cloudflare, etc. Busca la seccion <strong>&quot;DNS&quot;</strong> o <strong>&quot;Registros DNS&quot;</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Crea un registro CNAME con este valor</p>
                  <div className="mt-2">
                    <CopyField
                      label="Valor del registro CNAME"
                      value={domainStatus?.dns_target || "agentro-stores.vercel.app"}
                      onCopy={copyToClipboard}
                      mono
                    />
                  </div>
                  <div className="mt-2.5 flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
                    <span>En &quot;Nombre&quot; o &quot;Host&quot;: si es <strong>www.mitienda.com</strong>, pone <strong>www</strong>. Si es solo <strong>mitienda.com</strong>, pone <strong>@</strong>.</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Verifica la conexion</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Los cambios DNS pueden tardar entre 5 minutos y unas horas. Cuando estes listo, hace click en <strong>&quot;Verificar DNS&quot;</strong> en la tarjeta de dominio.
                  </p>
                </div>
              </div>
            </>
          )}

          {isDomainVerified && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200/40">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Tu dominio esta conectado y funcionando</p>
                <p className="text-xs text-green-600 mt-0.5 font-mono">{domainStatus?.custom_domain}</p>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════ */}
      {/* MODAL: FAQ                                           */}
      {/* ════════════════════════════════════════════════════ */}
      <Modal open={faqModal} onClose={() => setFaqModal(false)} title="Preguntas frecuentes">
        <div className="space-y-5 text-sm">
          <div>
            <h3 className="font-medium text-gray-900">Ya tengo mi pagina web, necesito la tienda de Agentro?</h3>
            <p className="text-gray-500 mt-1">
              No. Si ya tenes tu web, podes usar solo el <strong>widget de chat</strong> y/o <strong>WhatsApp</strong>.
              Instalas el codigo en tu sitio y tus clientes hablan con tu agente IA sin que cambies nada de tu pagina actual.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Solo quiero atender clientes por WhatsApp, necesito algo mas?</h3>
            <p className="text-gray-500 mt-1">
              No. Configura WhatsApp desde la seccion dedicada, configura tu agente IA, y listo.
              No necesitas dominio, ni tienda, ni widget. WhatsApp funciona de forma independiente.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">El link de chat funciona sin tener pagina web?</h3>
            <p className="text-gray-500 mt-1">
              Si. El link de chat es una pagina propia de Agentro. Lo compartis en Instagram, Facebook,
              o lo imprimis como QR en una tarjeta, y tus clientes hablan con tu agente IA directamente.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Necesito un dominio propio?</h3>
            <p className="text-gray-500 mt-1">
              No es necesario. Tu tienda ya funciona con tu direccion de Agentro (<span className="font-mono text-indigo-600">{subdomain}</span>).
              El dominio propio es opcional y es para quienes quieren una URL personalizada como www.mitienda.com.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
