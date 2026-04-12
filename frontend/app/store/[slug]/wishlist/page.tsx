"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";

export default function WishlistPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="bg-white min-h-[60vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-sm text-gray-400 mb-6">
          <Link href={`/store/${slug}`} className="hover:text-gray-700 transition" style={{ color: "var(--color-primary)" }}>Inicio</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-500">Lista de deseos</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-10" style={{ fontFamily: "var(--font-heading)" }}>Lista de deseos</h1>

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-12 sm:p-16 text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <Heart className="w-10 h-10 text-red-300" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: "var(--font-heading)" }}>Tu lista está vacía</h2>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">
            Guardá los productos que te gusten para encontrarlos fácilmente después.
          </p>
          <Link
            href={`/store/${slug}/catalog`}
            className="inline-flex items-center gap-2 px-6 py-3 font-medium text-sm transition hover:opacity-90 rounded-full"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            Explorar catálogo <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
