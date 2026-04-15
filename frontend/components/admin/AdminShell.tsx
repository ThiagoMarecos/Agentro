"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Key,
  Users,
  ScrollText,
  Activity,
  LogOut,
  ChevronLeft,
  Shield,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/stores", label: "Tiendas", icon: Building2 },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/health", label: "Sistema", icon: Activity },
  { href: "/admin/settings", label: "API Keys", icon: Key },
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
    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-sm font-semibold">
      {initial}
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ colorScheme: "light" }}>
      <aside className={`${collapsed ? "w-[72px]" : "w-64"} bg-white border-r border-gray-200/60 flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-gray-100 ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
          {!collapsed && (
            <Link href="/admin" className="flex items-center gap-2">
              <img src="/logo-black.png" alt="Agentro" className="h-6 w-auto" />
              <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                Admin
              </span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Superadmin badge */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-xs text-violet-600 font-medium">
              <Shield className="w-3.5 h-3.5" />
              Super Admin
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg transition-all duration-200 ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                } ${
                  active
                    ? "bg-violet-50 text-violet-600"
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
              <button
                onClick={() => logout()}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <UserAvatar user={user} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.full_name || user.email.split("@")[0]}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200/60 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Panel de Administración</p>
              <p className="text-xs text-gray-400">Gestión global de Agentro</p>
            </div>
          </div>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 text-gray-600 text-sm font-medium hover:bg-gray-100 transition"
          >
            Ir al Panel de Tienda
          </Link>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
