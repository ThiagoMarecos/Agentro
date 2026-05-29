"use client";

import Link from "next/link";
import {
  Package,
  FolderTree,
  AlertTriangle,
  MessageSquare,
  Bot,
  Plus,
  Palette,
  ExternalLink,
  Settings,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "@/lib/context/StoreContext";
import { useDashboard } from "@/lib/hooks/useDashboard";
import { useAuth } from "@/app/providers/AuthProvider";
import { StatCard } from "@/components/admin/StatCard";
import { ActivityItem } from "@/components/admin/ActivityItem";
import { SetupProgressCard } from "@/components/admin/SetupProgressCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardTour, type TourStep } from "@/components/onboarding-tour/DashboardTour";
import { formatPrice } from "@/lib/utils/formatPrice";

const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    centered: true,
    title: "Bienvenido a tu panel de Agentro 👋",
    body:
      "Te voy a mostrar TODO lo que tu tienda puede hacer y cómo configurar lo importante (productos, WhatsApp, agente IA, equipo, pagos). Son ~2 minutos. Usá ←/→ del teclado para navegar, Esc para salir.",
  },

  // ─── Catálogo ───
  {
    selector: '[data-tour="nav-products"]',
    placement: "right",
    title: "1. Productos — el corazón de tu tienda",
    body:
      "Acá cargás lo que vendés con foto, precio, variantes (talles/colores), stock y descripción. Sin productos no podés vender, así que es el primer paso. Tip: podés importar varios desde Excel o desde otra web.",
  },
  {
    selector: '[data-tour="nav-categories"]',
    placement: "right",
    title: "2. Categorías — organizá tu catálogo",
    body:
      "Agrupá productos en categorías (Remeras, Pantalones, Calzado, etc.) para que el cliente navegue fácil y el agente IA entienda qué tenés.",
  },

  // ─── Ventas online + presencial ───
  {
    selector: '[data-tour="nav-pos"]',
    placement: "right",
    title: "3. POS — vendé en mostrador",
    body:
      "Punto de Venta para cuando alguien viene al local. Cargás los productos, cobrás (efectivo, transfer, tarjeta) y descontás stock automáticamente. Tu tienda online y el POS comparten el mismo inventario.",
  },
  {
    selector: '[data-tour="nav-orders"]',
    placement: "right",
    title: "4. Pedidos — todo lo que se vende",
    body:
      "Acá ves cada pedido (online + POS) con su estado: pendiente, pagado, enviado, cancelado. Click en uno para ver detalle, cliente y poder marcar el envío.",
  },

  // ─── IA + canales ───
  {
    selector: '[data-tour="nav-whatsapp"]',
    placement: "right",
    title: "5. WhatsApp — conectá tu número 🔥",
    body:
      "Acá conectás tu WhatsApp Business escaneando un QR. Una vez conectado, el agente IA empieza a responder a tus clientes en automático: muestra productos, responde precios, toma pedidos.",
  },
  {
    selector: '[data-tour="nav-pipeline"]',
    placement: "right",
    title: "6. Pipeline IA — oportunidades en kanban",
    body:
      "El agente detecta clientes interesados y los acomoda en columnas: contactado, interesado, negociando, cerrado. Vos ves todo el embudo y tomás control cuando un cliente está caliente.",
  },
  {
    selector: '[data-tour="nav-channels"]',
    placement: "right",
    title: "7. Canales — dónde te vendés",
    body:
      "Además de WhatsApp, configurás otros canales: el chat web de tu tienda (ya viene activo), Instagram DM, etc. El mismo agente IA atiende todos.",
  },

  // ─── Equipo + clientes ───
  {
    selector: '[data-tour="nav-team"]',
    placement: "right",
    title: "8. Equipo — invitá vendedores",
    body:
      "Invitá a tus vendedores con su email. Cada uno tiene un rol (vendedor, manager, soporte) que define qué puede ver y hacer. Cuando el agente IA escala una venta, llega a ellos.",
  },
  {
    selector: '[data-tour="nav-customers"]',
    placement: "right",
    title: "9. Clientes — tu base CRM",
    body:
      "Todos los que te compran o chatean quedan registrados con contacto, historial de pedidos y conversaciones. Útil para hacer seguimiento y campañas.",
  },

  // ─── Diseño + config ───
  {
    selector: '[data-tour="nav-appearance"]',
    placement: "right",
    title: "10. Apariencia — el look de tu tienda",
    body:
      "Elegís plantilla, colores, tipografía, banners. Lo que el cliente ve cuando entra a tu tienda. Cambialo cuando quieras sin tocar nada técnico.",
  },
  {
    selector: '[data-tour="nav-settings"]',
    placement: "right",
    title: "11. Configuración — pagos, envíos y datos",
    body:
      "Acá seteás métodos de pago (Mercado Pago, transfer, efectivo), zonas y costos de envío, datos de contacto, SEO y la voz/tono que usa el agente IA.",
  },

  // ─── Vista pública + métricas ───
  {
    selector: '[data-tour="storefront-link"]',
    placement: "bottom",
    title: "12. Mirá tu tienda en vivo",
    body:
      "Este botón abre tu storefront público en otra pestaña. Tenelo abierto mientras configurás para ver el resultado en tiempo real.",
  },
  {
    selector: '[data-tour="dashboard-revenue"]',
    placement: "bottom",
    title: "13. Métricas que importan",
    body:
      "Ingresos del día, semana, mes y total. Ticket promedio, pedidos pendientes, productos en stock bajo. Todo en vivo, sin tener que cargar nada.",
  },
  {
    selector: '[data-tour="dashboard-setup"]',
    placement: "left",
    title: "14. Tu checklist de arranque",
    body:
      "Esta tarjeta te va diciendo qué te falta para que la tienda esté 100% lista. Tachá todos los pasos y estás operativa.",
  },

  // ─── Cierre ───
  {
    centered: true,
    title: "¡Listo! Ahora a vender 🚀",
    body:
      "Mi recomendación: empezá por Productos (cargá 5-10), después Apariencia, después conectá WhatsApp. Con eso ya estás operativa. Si te trabás, escribinos — vimos cada tienda al detalle y ayudamos en lo que necesites.",
  },
];

function RevenueChart({ data, currency }: { data: { date: string; revenue: number }[]; currency?: string }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => {
        const height = Math.max((d.revenue / max) * 100, 4);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative group">
              <div
                className="w-full bg-indigo-500 rounded-t-md transition-all duration-300 hover:bg-indigo-600 min-h-[4px]"
                style={{ height: `${height}%` }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {formatPrice(d.revenue, currency)}
              </div>
            </div>
            <span className="text-[10px] text-gray-400 font-medium">{d.date}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { stores, currentStore, setCurrentStore, isLoading: storesLoading } = useStore();
  const { user } = useAuth();
  const { summary, activity, isLoading, error, refresh } = useDashboard(
    currentStore?.id ?? null
  );

  if (storesLoading) {
    return (
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 mb-4">Panel</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-xl bg-white border border-gray-100 animate-pulse">
              <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
              <div className="h-7 w-16 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!currentStore) {
    return (
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 mb-4">Panel</h1>
        {stores.length === 0 ? (
          <EmptyState
            title="Creá tu primera tienda"
            description="Aún no tenés ninguna tienda. Completá el onboarding para crear una y empezar a vender."
            action={
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
              >
                Crear mi tienda
                <span>→</span>
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Elegí una tienda"
            description="Seleccioná la tienda con la que querés trabajar."
            action={
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <select
                  value=""
                  onChange={(e) => {
                    const s = stores.find((x) => x.id === e.target.value);
                    if (s) setCurrentStore(s);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 font-medium min-w-[220px]"
                >
                  <option value="">— Elegir tienda —</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {stores[0] && (
                  <button
                    onClick={() => setCurrentStore(stores[0])}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
                  >
                    Usar {stores[0].name}
                  </button>
                )}
              </div>
            }
          />
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 mb-4">Panel</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-600">{error}</p>
          <button
            onClick={refresh}
            className="mt-4 px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const setupProgress = summary?.setup_progress;
  const storefrontUrl = `/store/${currentStore.slug}`;
  const monthChange = summary?.month_change_pct;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">
            Hola, {currentStore.name}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Vista general de tu tienda
          </p>
        </div>
        <Link
          href={storefrontUrl}
          target="_blank"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          Ver tienda
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-xl bg-white border border-gray-100 animate-pulse">
              <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
              <div className="h-7 w-16 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Revenue Cards */}
          <div data-tour="dashboard-revenue" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <div className="flex items-center justify-between mb-1">
                <p className="text-indigo-100 text-xs font-medium uppercase tracking-wide">Hoy</p>
                <DollarSign className="w-4 h-4 text-indigo-200" />
              </div>
              <p className="text-2xl font-bold">{formatPrice(summary?.revenue_today ?? 0, currentStore?.currency)}</p>
              <p className="text-indigo-200 text-xs mt-1">
                {summary?.orders_today ?? 0} pedido{(summary?.orders_today ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-gray-200/60 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-1">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Esta semana</p>
                <BarChart3 className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(summary?.revenue_week ?? 0, currentStore?.currency)}</p>
              <p className="text-gray-400 text-xs mt-1">
                {summary?.orders_week ?? 0} pedido{(summary?.orders_week ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-gray-200/60 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-1">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Este mes</p>
                {monthChange !== null && monthChange !== undefined && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${monthChange >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {monthChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {monthChange >= 0 ? "+" : ""}{monthChange}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(summary?.revenue_month ?? 0, currentStore?.currency)}</p>
              <p className="text-gray-400 text-xs mt-1">
                {summary?.orders_month ?? 0} pedido{(summary?.orders_month ?? 0) !== 1 ? "s" : ""} · vs mes anterior
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-gray-200/60 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-1">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Total histórico</p>
                <TrendingUp className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(summary?.revenue_all_time ?? 0, currentStore?.currency)}</p>
              <p className="text-gray-400 text-xs mt-1">
                {summary?.total_orders ?? 0} pedido{(summary?.total_orders ?? 0) !== 1 ? "s" : ""} totales
              </p>
            </div>
          </div>

          {/* Secondary Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-white border border-gray-200/60">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Ticket promedio</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatPrice(summary?.avg_order_value ?? 0, currentStore?.currency)}</p>
            </div>
            <Link href="/app/orders" className="p-4 rounded-xl bg-white border border-gray-200/60 hover:border-amber-200 hover:bg-amber-50/50 transition-all group">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Pendientes</p>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-lg font-bold text-gray-900">{summary?.pending_orders ?? 0}</p>
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-500 transition-colors" />
              </div>
            </Link>
            <StatCard label="Productos" value={summary?.total_products ?? 0} icon={Package} />
            <StatCard label="Categorías" value={summary?.total_categories ?? 0} icon={FolderTree} />
            <StatCard label="Stock bajo" value={summary?.low_stock_count ?? 0} icon={AlertTriangle} />
            <StatCard label="Agentes IA" value={summary?.ai_agents_count ?? 0} icon={Bot} />
          </div>

          {/* Chart + Activity + Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Revenue Chart */}
            <div className="rounded-xl bg-white border border-gray-200/60 p-6">
              <h2 className="font-display font-semibold text-gray-900 mb-1">Ventas últimos 7 días</h2>
              <p className="text-xs text-gray-400 mb-5">Revenue diario (sin cancelados)</p>
              {summary?.daily_revenue && summary.daily_revenue.length > 0 ? (
                <RevenueChart data={summary.daily_revenue} currency={currentStore?.currency} />
              ) : (
                <p className="text-gray-400 text-sm py-8 text-center">Sin datos aún</p>
              )}
            </div>

            {/* Activity */}
            <div className="rounded-xl bg-white border border-gray-200/60 p-6">
              <h2 className="font-display font-semibold text-gray-900 mb-4">Actividad reciente</h2>
              {activity.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay actividad reciente.</p>
              ) : (
                <div>{activity.slice(0, 8).map((item) => (
                  <ActivityItem
                    key={item.id}
                    action={item.action}
                    details={item.details ?? null}
                    created_at={item.created_at}
                    user_email={item.user_email}
                  />
                ))}</div>
              )}
            </div>

            {/* Setup Progress */}
            {setupProgress && (
              <div data-tour="dashboard-setup">
                <SetupProgressCard
                  checks={setupProgress.checks}
                  completed={setupProgress.completed}
                  total={setupProgress.total}
                />
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div data-tour="dashboard-quick-actions" className="rounded-xl bg-white border border-gray-200/60 p-6">
            <h2 className="font-display font-semibold text-gray-900 mb-4">Acciones rápidas</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: "/app/products/new", icon: Plus, label: "Añadir producto" },
                { href: "/app/orders", icon: ShoppingCart, label: "Ver pedidos" },
                { href: "/app/appearance", icon: Palette, label: "Editar apariencia" },
                { href: "/app/settings", icon: Settings, label: "Configuración" },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all duration-200"
                  >
                    <Icon className="w-4 h-4" />
                    {action.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Tour interactivo (solo primera vez, persistido por user) */}
      {currentStore && user && (
        <DashboardTour
          steps={DASHBOARD_TOUR_STEPS}
          storageKey={`agentro:dashboard-tour-seen:${user.id}`}
        />
      )}
    </div>
  );
}
