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
  Terminal,
  LogOut,
  ChevronLeft,
  Shield,
  Bot,
  Sparkles,
  Inbox,
} from "lucide-react";
import { useEffect } from "react";
import { listInvitationRequests } from "@/lib/api/invitations-admin";
import { useAuth } from "@/app/providers/AuthProvider";
import { APP_VERSION_LABEL } from "@/lib/config/version";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/invitations", label: "Invitaciones", icon: Inbox, badge: "pending" as const },
  { href: "/admin/stores", label: "Tiendas", icon: Building2 },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/ai-agents", label: "Agentes IA", icon: Bot },
  { href: "/admin/chat-simulator", label: "Simulador", icon: Sparkles },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/health", label: "Sistema", icon: Activity },
  { href: "/admin/terminal", label: "Terminal", icon: Terminal },
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
  const [pendingInvites, setPendingInvites] = useState<number>(0);

  // Carga contador de invitaciones pendientes (cada 60s)
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listInvitationRequests({ status: "pending", limit: 200 })
        .then((items) => {
          if (!cancelled) setPendingInvites(items.length);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pathname]);

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
                className={`relative flex items-center gap-3 rounded-lg transition-all duration-200 ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                } ${
                  active
                    ? "bg-violet-50 text-violet-600"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!collapsed && <span className="text-[13px] font-medium flex-1">{item.label}</span>}
                {!collapsed && "badge" in item && item.badge === "pending" && pendingInvites > 0 && (
                  <span className="ml-auto text-[10px] font-semibold bg-violet-600 text-white px-1.5 py-0.5 rounded-md min-w-[18px] text-center">
                    {pendingInvites > 99 ? "99+" : pendingInvites}
                  </span>
                )}
                {collapsed && "badge" in item && item.badge === "pending" && pendingInvites > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-600" />
                )}
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

        {/* Version pill */}
        {!collapsed && (
          <div className="px-3 pb-3 -mt-1">
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                Agentro Admin <span className="text-gray-500 font-semibold">{APP_VERSION_LABEL}</span>
              </span>
            </div>
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
