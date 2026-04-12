"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  MessageSquare,
  Bot,
  Calendar,
  Palette,
  Settings,
  LogOut,
  ChevronLeft,
  Store,
  Kanban,
  Truck,
  Smartphone,
  ShieldBan,
  Globe,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useStore } from "@/lib/context/StoreContext";

const navItems = [
  { href: "/app", label: "Panel", icon: LayoutDashboard },
  { href: "/app/products", label: "Productos", icon: Package },
  { href: "/app/categories", label: "Categorías", icon: FolderTree },
  { href: "/app/orders", label: "Pedidos", icon: ShoppingCart },
  { href: "/app/customers", label: "Clientes", icon: Users },
  { href: "/app/conversations", label: "Conversaciones", icon: MessageSquare },
  { href: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/app/ai-agents", label: "Agentes IA", icon: Bot },
  { href: "/app/whatsapp", label: "WhatsApp", icon: Smartphone },
  { href: "/app/suppliers", label: "Proveedores", icon: Truck },
  { href: "/app/channels", label: "Canales", icon: Globe },
  { href: "/app/next-drop", label: "Próximos drops", icon: Calendar },
  { href: "/app/appearance", label: "Apariencia", icon: Palette },
  { href: "/app/settings", label: "Configuración", icon: Settings },
];

function UserAvatar({ user }: { user: { full_name: string | null; email: string; avatar_url?: string | null } }) {
  const [imgErr, setImgErr] = useState(false);
  const initial = (user.full_name || user.email).charAt(0).toUpperCase();

  if (user.avatar_url && !imgErr) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="w-8 h-8 rounded-full object-cover border border-gray-200"
        onError={() => setImgErr(true)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-semibold">
      {initial}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { stores, currentStore, setCurrentStore } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ colorScheme: "light" }}>
      {/* Sidebar */}
      <aside className={`${collapsed ? "w-[72px]" : "w-64"} bg-white border-r border-gray-200/60 flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-gray-100 ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
          {!collapsed && (
            <Link href="/app">
              <img src="/logo-black.png" alt="Agentro" className="h-7 w-auto" />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Store selector - siempre visible cuando hay tiendas */}
        {stores.length > 0 && !collapsed && (
          <div className="px-3 py-3 border-b border-gray-100">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tienda</label>
            <select
              value={currentStore?.id || ""}
              onChange={(e) => {
                const s = stores.find((x) => x.id === e.target.value);
                setCurrentStore(s || null);
              }}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tienda actual (collapsed) */}
        {stores.length > 0 && collapsed && (
          <div className="py-3 flex justify-center border-b border-gray-100">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Store className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg transition-all duration-200 ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                } ${
                  active
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!collapsed && <span className="text-[13px] font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        {user && (
          <div className={`border-t border-gray-100 p-3 ${collapsed ? "flex justify-center" : ""}`}>
            {collapsed ? (
              <Link
                href="/app/account"
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition block"
                title="Mi cuenta"
              >
                <UserAvatar user={user} />
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/app/account" className="flex items-center gap-3 flex-1 min-w-0 rounded-lg hover:bg-gray-50 p-1 -m-1 transition">
                  <UserAvatar user={user} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.full_name || user.email.split("@")[0]}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                </Link>
                <button
                  onClick={() => logout()}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200/60 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {currentStore && (
              <>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{currentStore.name}</p>
                  <p className="text-xs text-gray-400">{currentStore.slug}.getagentro.com</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentStore && (
              <Link
                href={`/store/${currentStore.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Ver mi tienda
              </Link>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {currentStore && !currentStore.is_active ? (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-md w-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-6">
                  <ShieldBan className="w-8 h-8 text-amber-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Tienda suspendida</h1>
                <p className="text-gray-500 mb-6">
                  Tu tienda <span className="font-semibold text-gray-700">{currentStore.name}</span> ha sido
                  suspendida por el administrador de la plataforma por tiempo indefinido.
                </p>
                <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 text-left space-y-2 mb-6">
                  <p className="text-sm text-amber-800 font-medium">Esto puede deberse a:</p>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li>Actividad sospechosa detectada en la cuenta</li>
                    <li>Incumplimiento de los términos de servicio</li>
                    <li>Revisión administrativa de seguridad</li>
                  </ul>
                </div>
                <p className="text-sm text-gray-400">
                  Si creés que es un error, contactá al soporte de Agentro para más información.
                </p>
                {stores.length > 1 && (
                  <p className="text-sm text-indigo-600 mt-4">
                    Podés seleccionar otra tienda desde el menú lateral.
                  </p>
                )}
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
