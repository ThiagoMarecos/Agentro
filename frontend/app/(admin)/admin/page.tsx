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
} from "lucide-react";
import { getAdminDashboard, DashboardData } from "@/lib/api/admin";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    violet: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.violet}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

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
      <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Vista general de toda la plataforma Agentro</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total tiendas" value={data.total_stores} icon={Building2} color="violet" />
        <StatCard label="Tiendas activas" value={data.active_stores} icon={ShieldCheck} color="green" />
        <StatCard label="Usuarios registrados" value={data.total_users} icon={Users} color="blue" />
        <StatCard label="WhatsApp conectados" value={data.whatsapp_connected} icon={MessageSquare} color="amber" />
      </div>

      {/* Suspended alert */}
      {data.suspended_stores > 0 && (
        <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{data.suspended_stores}</span> tienda{data.suspended_stores > 1 ? "s" : ""} suspendida{data.suspended_stores > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Recent stores */}
      <div className="bg-white rounded-xl border border-gray-200/60">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Últimas tiendas registradas</h2>
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
                    <p className="text-xs text-gray-400">{store.slug}.getagentro.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {store.owner_email && (
                    <span className="text-xs text-gray-400 hidden sm:inline">{store.owner_email}</span>
                  )}
                  {store.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Activa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      <XCircle className="w-3 h-3" /> Suspendida
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
