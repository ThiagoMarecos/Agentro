"use client";

/**
 * /pricing — Página pública de precios.
 *
 * Muestra los 3 tiers (Starter / Pro / Enterprise) con toggle mensual/anual.
 * Cuando el sistema está en hibernación (BILLING_ENABLED=false), igual carga
 * los planes pero deshabilita los CTAs con un mensaje "Próximamente" — útil
 * para preview y validación, sin que se pueda comprar todavía.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPlans, centsToUsdInt, type PlanDTO } from "@/lib/api/billing";
import {
  Check,
  X,
  Sparkles,
  Crown,
  Rocket,
  Lock,
  ArrowRight,
} from "lucide-react";

type Billing = "monthly" | "yearly";

const TIER_ICONS: Record<string, typeof Rocket> = {
  starter: Rocket,
  pro: Sparkles,
  enterprise: Crown,
};

const FEATURE_LABELS: Record<string, string> = {
  web_chat: "Canal web chat",
  ai_agent_pretrained: "Agente IA pre-entrenado",
  handoff_human: "Escalamiento a vendedor humano",
  whatsapp: "Canal WhatsApp",
  guided_personalization: "Personalización guiada del agente",
  copilot_mode: "Modo copiloto para vendedores",
  custom_prompt: "Editor de prompt del agente",
  flow_editor: "Editor visual de diagrama de flujo",
  rag_training: "Entrenamiento custom (RAG)",
  api_access: "Acceso API REST",
  white_label: "White-label (sin marca Agentro)",
};

// Orden en que mostramos features (todos los keys conocidos, en orden estable)
const FEATURE_ORDER: string[] = [
  "web_chat",
  "ai_agent_pretrained",
  "handoff_human",
  "whatsapp",
  "guided_personalization",
  "copilot_mode",
  "custom_prompt",
  "flow_editor",
  "rag_training",
  "api_access",
  "white_label",
];


export default function PricingPage() {
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [loading, setLoading] = useState(true);
  const [isHibernating, setIsHibernating] = useState(false);

  useEffect(() => {
    listPlans()
      .then((res) => setPlans(res.plans))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));

    // Detectar hibernación con un fetch al /features sin auth — si no responde,
    // asumimos hibernación / sistema no listo. (Simplificación: no detectamos
    // exacto, solo bloqueamos CTAs si listPlans devuelve vacío.)
  }, []);

  // Si no hay plans (DB vacía o sistema no inicializado), tratar como hibernación
  useEffect(() => {
    if (!loading && plans.length === 0) {
      setIsHibernating(true);
    }
  }, [loading, plans]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-50 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold font-display tracking-tight">
            Agentro
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/features" className="text-slate-400 hover:text-slate-50">
              Features
            </Link>
            <Link href="/faq" className="text-slate-400 hover:text-slate-50">
              FAQ
            </Link>
            <Link
              href="/login"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
            Precios simples,{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              sin sorpresas
            </span>
          </h1>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Empezá con 14 días de prueba. Cobrás cuando vendés, no antes.
          </p>

          {/* Toggle billing */}
          <div className="mt-8 inline-flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-full">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                billing === "monthly"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                billing === "yearly"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Anual
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/20 text-emerald-300">
                -10%
              </span>
            </button>
          </div>
        </div>

        {isHibernating && (
          <div className="max-w-3xl mx-auto mb-8 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>
              Estamos en beta cerrada. Los precios están definidos pero todavía no se cobran.
              <Link href="/request-invite" className="underline ml-1 hover:text-amber-100">
                Pedí tu invitación para acceder gratis.
              </Link>
            </span>
          </div>
        )}

        {/* Cards */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">Cargando planes…</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                billing={billing}
                disabled={isHibernating}
              />
            ))}
          </div>
        )}

        {/* Add-ons explicación */}
        <section className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-xl font-display font-semibold text-center mb-6">
            Add-ons que se suman al plan base
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.tier}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/50"
              >
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  {plan.name}
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tienda extra</span>
                    <span className="font-medium">
                      ${centsToUsdInt(plan.store_price_monthly_cents)}/mes
                    </span>
                  </div>
                  {plan.allow_extra_sellers && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vendedor extra</span>
                      <span className="font-medium">
                        ${centsToUsdInt(plan.seller_extra_price_monthly_cents)}/mes
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Conversación extra</span>
                    <span className="font-medium">
                      ${(plan.conversation_overage_price_cents / 100).toFixed(2)} c/u
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-center mb-8">
            Preguntas frecuentes
          </h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <details
                key={i}
                className="group bg-slate-900/50 border border-slate-800 rounded-xl p-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer">
                  <span className="font-semibold">{item.q}</span>
                  <span className="text-slate-500 group-open:rotate-180 transition">▾</span>
                </summary>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-16 text-center">
          <h2 className="text-2xl font-display font-bold mb-3">
            ¿Listo para que el agente venda por vos?
          </h2>
          <p className="text-slate-400 mb-6">
            14 días gratis, cancelás cuando quieras.
          </p>
          {isHibernating ? (
            <Link
              href="/request-invite"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold"
            >
              Pedir invitación a la beta
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold"
            >
              Empezar 14 días gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}


function PlanCard({
  plan,
  billing,
  disabled,
}: {
  plan: PlanDTO;
  billing: Billing;
  disabled: boolean;
}) {
  const Icon = TIER_ICONS[plan.tier] ?? Rocket;
  const isPro = plan.tier === "pro";

  const price =
    billing === "monthly"
      ? plan.price_monthly_cents / 100
      : plan.price_yearly_cents / 100;

  const priceUnit = billing === "monthly" ? "/mes" : "/año";

  return (
    <div
      className={`relative rounded-2xl p-6 border transition ${
        isPro
          ? "border-indigo-500/60 bg-gradient-to-br from-indigo-950/50 to-slate-900 shadow-lg shadow-indigo-500/10"
          : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
      }`}
    >
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full">
          Más popular
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-indigo-400" />
        <h3 className="text-lg font-display font-bold">{plan.name}</h3>
      </div>
      <p className="text-sm text-slate-400 mb-6 min-h-[2.5rem]">{plan.description}</p>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          {plan.tier === "enterprise" && (
            <span className="text-xs text-slate-500 mr-1">Desde</span>
          )}
          <span className="text-4xl font-display font-bold">${Math.round(price)}</span>
          <span className="text-sm text-slate-500">{priceUnit}</span>
        </div>
        {plan.setup_fee_cents > 0 && (
          <div className="text-xs text-slate-500 mt-1">
            + ${centsToUsdInt(plan.setup_fee_cents)} setup fee
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 pt-4 space-y-2 mb-6">
        <Stat label="Conversaciones / mes">{plan.conversations_included_per_month.toLocaleString()}</Stat>
        <Stat label="Vendedores incluidos">
          {plan.sellers_included}
          {plan.allow_extra_sellers && " + extras"}
        </Stat>
      </div>

      <ul className="space-y-2 mb-6 min-h-[16rem]">
        {FEATURE_ORDER.map((key) => {
          const has = plan.features.includes(key as any);
          return (
            <li key={key} className="flex items-start gap-2 text-sm">
              {has ? (
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <X className="w-4 h-4 text-slate-700 flex-shrink-0 mt-0.5" />
              )}
              <span className={has ? "text-slate-200" : "text-slate-600 line-through"}>
                {FEATURE_LABELS[key] ?? key}
              </span>
            </li>
          );
        })}
      </ul>

      {disabled ? (
        <button
          disabled
          className="w-full py-3 rounded-xl bg-slate-800 text-slate-500 cursor-not-allowed text-sm font-semibold"
        >
          Próximamente
        </button>
      ) : (
        <Link
          href={`/signup?tier=${plan.tier}&billing=${billing}`}
          className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition ${
            isPro
              ? "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white"
              : "bg-slate-800 hover:bg-slate-700 text-white"
          }`}
        >
          Empezar trial 14 días
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-200">{children}</span>
    </div>
  );
}


const FAQ_ITEMS = [
  {
    q: "¿Cómo funciona el trial de 14 días?",
    a: "Te pedimos tarjeta al registrarte pero no cobramos nada hasta el día 14. Recibís 3 recordatorios antes del primer cobro. Si cancelás antes, no se cobra. Si te quedás, arranca tu plan al precio elegido.",
  },
  {
    q: "¿Qué cuenta como 'conversación'?",
    a: "Una conversación es un hilo único con un cliente, sin importar cuántos mensajes tenga. Si el cliente vuelve en 24hs es la misma conversación. Después de 24hs sin actividad cuenta como una nueva.",
  },
  {
    q: "¿Y si me paso del límite de conversaciones?",
    a: "Te avisamos al 80% y al 100% del límite. Podés activar overage (cobramos por conversación extra al precio del plan) o esperar al próximo ciclo. Nunca cortamos al cliente final sin avisarte.",
  },
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí, cuando quieras. Upgrade es prorrateado al instante. Downgrade aplica al próximo ciclo de facturación.",
  },
  {
    q: "¿Por qué pago por cada tienda?",
    a: "Cada tienda consume recursos reales: catálogo, conversaciones, storage de imágenes, infraestructura del agente. Cobrar por tienda mantiene los precios justos: el que usa más, paga más.",
  },
  {
    q: "¿Y si necesito algo a medida?",
    a: "El plan Enterprise incluye editor de prompt, diagrama de flujo, entrenamiento custom con tus docs (RAG), y soporte con account manager. Contactanos para hablar de casos específicos.",
  },
];
