"use client";

import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";

interface ChatHeaderProps {
  storeName: string;
  storeSlug: string;
  logoUrl?: string | null;
  primaryColor: string;
  isEmbed?: boolean;
}

export function ChatHeader({
  storeName,
  storeSlug,
  logoUrl,
  primaryColor,
  isEmbed = false,
}: ChatHeaderProps) {
  return (
    <header
      className={`bg-white border-b border-gray-200/60 shrink-0 ${
        isEmbed ? "sticky top-0 z-10" : ""
      }`}
    >
      <div
        className={`${
          isEmbed ? "px-5" : "max-w-2xl mx-auto px-5"
        } h-16 flex items-center gap-4`}
      >
        {!isEmbed && (
          <Link
            href={`/store/${storeSlug}`}
            className="p-2.5 -ml-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all duration-200"
            title="Ir a la tienda"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}

        {logoUrl ? (
          <img
            src={logoUrl}
            alt={storeName}
            className="h-8 object-contain"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingBag className="w-5 h-5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">
            {storeName}
          </h1>
          <p className="text-xs text-green-500 flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
            Asistente en linea
          </p>
        </div>

        {!isEmbed && (
          <Link
            href={`/store/${storeSlug}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 border border-gray-200/60 transition-all duration-200"
            style={{ color: primaryColor }}
          >
            <ShoppingBag className="w-4 h-4" />
            Ver tienda
          </Link>
        )}
      </div>
    </header>
  );
}
