"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Calendar } from "lucide-react";

export default function NextDropPage() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">Próximos drops</h1>
      <p className="text-gray-400 text-sm mb-6">Gestiona tus próximos lanzamientos y generá expectativa.</p>

      <EmptyState
        title="No hay drops programados"
        description="Añade productos o eventos para tu próximo lanzamiento. Tus clientes podrán ver los drops en tu tienda."
        action={
          <button className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-800 transition">
            <Calendar className="w-4 h-4" />
            Añadir drop
          </button>
        }
      />
    </div>
  );
}
