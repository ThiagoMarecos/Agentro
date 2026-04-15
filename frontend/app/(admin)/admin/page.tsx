"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  XCircle,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  CalendarDays,
  Store,
} from "lucide-react";
import { getAdminDashboard, DashboardData } from "@/lib/api/admin";

/* ── Stat Card ──────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  const colorMap: Record<string, string> = {
    violet: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    indigo: "bg-indigo-50 text-indigo-600",
    pink: "bg-pink-50 text-pink-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.violet}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

/* ── Money Card ─────────────────────────────────────────────── */

function MoneyCard({
  label,
  today,
  week,
  month,
  allTime,
  color,
  icon: Icon,
}: {
  label: string;
  today: number;
  week: number;
  month: number;
  allTime: number;
  color: string;
  icon: React.ElementType;
}) {
  const colorMap: Record<string, { bg: string; text: string; light: string }> = {
    green: { bg: "bg-emerald-600", text: "text-emerald-600", light: "bg-emerald-50" },
    violet: { bg: "bg-violet-600", text: "text-violet-600", light: "bg-violet-50" },
    blue: { bg: "bg-blue-600", text: "text-blue-600", light: "bg-blue-50" },
  };
  const c = colorMap[color] || colorMap.green;

  const fmt = (v: number) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
      <div className={`${c.bg} px-5 py-4 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">{label}</p>
            <p className="text-3xl font-bold mt-1">{fmt(month)}</p>
            <p className="text-xs text-white/60 mt-1">Este mes</p>
          </div>
          <Icon className="w-8 h-8 text-white/30" />
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <div className="p-3 text-center">
          <p className={`text-sm font-bold ${c.text}`}>{fmt(today)}</p>
          <p className="text-[10px] text-gray-400 uppercase font-medium mt-0.5">Hoy</p>
        </div>
        <div className="p-3 text-center">
          <p className={`text-sm font-bold ${c.text}`}>{fmt(week)}</p>
          <p className="text-[10px] text-gray-400 uppercase font-medium mt-0.5">Semana</p>
        </div>
        <div className="p-3 text-center">
          <p className={`text-sm font-bold ${c.text}`}>{fmt(allTime)}</p>
          <p className="text-[10px] text-gray-400 uppercase font-medium mt-0.5">Total</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Cargando dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>
    );
  }

  if (!data) return null;

  const f = data.financials;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Vista general de la plataforma Agentro</p>
      </div>

      {/* ── Financial Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MoneyCard
          label="Volumen Total de Ventas (GMV)"
          today={f.gmv_today}
          week={f.gmv_week}
          month={f.gmv_month}
          allTime={f.gmv_all_time}
          color="blue"
          icon={ShoppingCart}
        />
        <MoneyCard
          label={`Ingresos Agentro (${f.commission_percent}% comisión)`}
          today={f.revenue_today}
          week={f.revenue_week}
          month={f.revenue_month}
          allTime={f.revenue_all_time}
          color="green"
          icon={DollarSign}
        />
      </div>

      {/* ── Order Stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Pedidos hoy"
          value={f.orders_today}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          label="Pedidos semana"
          value={f.orders_week}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          label="Pedidos mes"
          value={f.orders_month}
          icon={ShoppingCart}
          color="indigo"
        />
        <StatCard
          label="Ticket promedio"
          value={`$${f.avg_order_value.toFixed(2)}`}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* ── Platform Stats ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total tiendas"
          value={data.total_stores}
          icon={Building2}
          color="violet"
          subtitle={`+${data.stores_today} hoy · +${data.stores_week} semana`}
        />
        <StatCard
          label="Tiendas activas"
          value={data.active_stores}
          icon={ShieldCheck}
          color="green"
        />
        <StatCard
          label="Usuarios"
          value={data.total_users}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="WhatsApp"
          value={data.whatsapp_connected}
          icon={MessageSquare}
          color="amber"
        />
      </div>

      {/* ── Suspended alert ─────────────────────────────────── */}
      {data.suspended_stores > 0 && (
        <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{data.suspended_stores}</span> tienda{data.suspended_stores > 1 ? "s" : ""} suspendida{data.suspended_stores > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* ── Two column: Top stores + Recent stores ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top stores by revenue */}
        <div className="bg-white rounded-xl border border-gray-200/60">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900">Top tiendas del mes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {f.top_stores.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No hay ventas este mes
              </div>
            ) : (
              f.top_stores.map((store, i) => (
                <Link
                  key={store.id}
                  href={`/admin/stores/${store.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{store.name}</p>
                      <p className="text-xs text-gray-400">{store.order_count} pedidos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">${store.total_sales.toFixed(2)}</p>
                    <p className="text-xs text-emerald-600 font-medium">+${store.commission.toFixed(2)} comisión</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent stores */}
        <div className="bg-white rounded-xl border border-gray-200/60">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-violet-500" />
              <h2 className="text-base font-semibold text-gray-900">Últimas tiendas</h2>
            </div>
            <Link
              href="/admin/stores"
              className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data.recent_stores.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No hay tiendas registradas aún
              </div>
            ) : (
              data.recent_stores.map((store) => (
                <Link
                  key={store.id}
                  href={`/admin/stores/${store.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{store.name}</p>
                      <p className="text-xs text-gray-400">{store.owner_email || store.slug}</p>
                    </div>
                  </div>
                  {store.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Activa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      <XCircle className="w-3 h-3" /> Suspendida
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Commission info ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Percent className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Comisión actual: {f.commission_percent}%</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Del total vendido por todas las tiendas (GMV), Agentro cobra el {f.commission_percent}% como comisión.
              Configuralo en <Link href="/admin/settings" className="text-violet-600 hover:underline font-medium">API Keys &gt; Billing</Link>.
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-600">${f.revenue_all_time.toFixed(2)}</p>
            <p className="text-xs text-gray-400">Total ganado</p>
          </div>
        </div>
      </div>
    </div>
  );
}
