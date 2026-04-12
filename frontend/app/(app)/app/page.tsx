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
import { StatCard } from "@/components/admin/StatCard";
import { ActivityItem } from "@/components/admin/ActivityItem";
import { SetupProgressCard } from "@/components/admin/SetupProgressCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPrice } from "@/lib/utils/formatPrice";

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              <SetupProgressCard
                checks={setupProgress.checks}
                completed={setupProgress.completed}
                total={setupProgress.total}
              />
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-xl bg-white border border-gray-200/60 p-6">
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
    </div>
  );
}
