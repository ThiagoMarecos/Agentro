"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/context/StoreContext";
import { getCustomers } from "@/lib/api/stores";
import { Users, Search, Mail, User as UserIcon, Loader2 } from "lucide-react";

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export default function CustomersPage() {
  const { currentStore } = useStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!currentStore) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getCustomers(currentStore.id)
      .then(setCustomers)
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, [currentStore]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const name = `${c.first_name || ""} ${c.last_name || ""}`.trim().toLowerCase();
      return c.email.toLowerCase().includes(q) || name.includes(q);
    });
  }, [customers, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const fullName = (c: Customer) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ") || null;

  const initial = (c: Customer) => {
    const fn = c.first_name || c.email;
    return fn.charAt(0).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-500 mb-1.5">
            CRM
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2.5">
            <span className="inline-grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/30">
              <Users className="w-4.5 h-4.5" />
            </span>
            Clientes
          </h1>
          <p className="text-gray-500 text-sm mt-1.5">
            {customers.length === 0
              ? "Cuando alguien compre en tu tienda, sus datos aparecerán acá."
              : `${customers.length} cliente${customers.length !== 1 ? "s" : ""} en tu base.`}
          </p>
        </div>
      </div>

      {/* Buscador */}
      {customers.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
          />
        </div>
      )}

      {/* Contenido */}
      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
            <Users className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin clientes todavía</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Cuando un cliente te compre o chatee con tu agente IA, su contacto y datos van a quedar
            registrados acá automáticamente.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Sin resultados para tu búsqueda</p>
          <button
            onClick={() => setSearch("")}
            className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Limpiar
          </button>
        </div>
      ) : (
        <>
          {/* Mobile: cards apiladas */}
          <div className="md:hidden bg-white rounded-xl border border-gray-200/60 overflow-hidden divide-y divide-gray-100">
            {filtered.map((c) => {
              const name = fullName(c);
              return (
                <div key={c.id} className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0 shadow-sm">
                    {initial(c)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {name || c.email}
                    </p>
                    {name && (
                      <p className="text-xs text-gray-500 truncate">{c.email}</p>
                    )}
                  </div>
                  <a
                    href={`mailto:${c.email}`}
                    className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition flex-shrink-0"
                    aria-label="Enviar email"
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                </div>
              );
            })}
          </div>

          {/* Desktop: grid de cards */}
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((c) => {
              const name = fullName(c);
              return (
                <div
                  key={c.id}
                  className="group flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200/60 hover:border-indigo-200 hover:shadow-sm transition"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-semibold flex-shrink-0 shadow-sm shadow-indigo-500/30">
                    {initial(c)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
                      {name || (
                        <span className="text-gray-400 italic font-normal text-sm flex items-center gap-1">
                          <UserIcon className="w-3.5 h-3.5" /> Sin nombre
                        </span>
                      )}
                    </p>
                    <a
                      href={`mailto:${c.email}`}
                      className="text-xs text-gray-500 hover:text-indigo-600 transition truncate block"
                    >
                      {c.email}
                    </a>
                  </div>
                  <Mail className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
