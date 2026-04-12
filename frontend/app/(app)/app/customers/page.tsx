"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/context/StoreContext";
import { Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCustomers } from "@/lib/api/stores";

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

  useEffect(() => {
    if (!currentStore) { setLoading(false); return; }
    getCustomers(currentStore.id).then(setCustomers).catch(() => setCustomers([])).finally(() => setLoading(false));
  }, [currentStore]);

  if (loading) return <div className="py-12 text-center text-gray-400">Cargando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">Clientes</h1>
      <p className="text-gray-400 text-sm mb-6">Los clientes que compren en tu tienda aparecerán acá.</p>

      {customers.length === 0 ? (
        <EmptyState title="No hay clientes" description="Cuando alguien compre en tu tienda, sus datos aparecerán acá." />
      ) : (
        <Table<Customer>
          columns={[
            { key: "email", header: "Email" },
            { key: "first_name", header: "Nombre", render: (c) => [c.first_name, c.last_name].filter(Boolean).join(" ") || "—" },
          ]}
          data={customers}
          keyExtractor={(c) => c.id}
          emptyMessage="No hay clientes"
        />
      )}
    </div>
  );
}
