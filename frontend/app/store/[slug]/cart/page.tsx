"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, ArrowRight, Trash2, Minus, Plus, Package } from "lucide-react";
import { useCart } from "@/lib/context/CartContext";

export default function CartPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { items, removeItem, updateQuantity, subtotal, itemCount } = useCart();

  if (items.length === 0) {
    return (
      <div className="bg-white min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="text-sm text-gray-400 mb-6">
            <Link href={`/store/${slug}`} className="hover:text-gray-700 transition" style={{ color: "var(--color-primary)" }}>Inicio</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-500">Carrito</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-10" style={{ fontFamily: "var(--font-heading)" }}>Tu carrito</h1>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-12 sm:p-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-10 h-10 text-gray-300" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: "var(--font-heading)" }}>Tu carrito está vacío</h2>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">Explorá nuestro catálogo y encontrá lo que te gusta.</p>
            <Link
              href={`/store/${slug}/catalog`}
              className="inline-flex items-center gap-2 px-6 py-3 font-medium text-sm transition hover:opacity-90 rounded-full"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
            >
              Ver catálogo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[60vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-sm text-gray-400 mb-6">
          <Link href={`/store/${slug}`} className="hover:text-gray-700 transition" style={{ color: "var(--color-primary)" }}>Inicio</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-500">Carrito</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-10" style={{ fontFamily: "var(--font-heading)" }}>
          Tu carrito <span className="text-lg font-normal text-gray-400">({itemCount} {itemCount === 1 ? "producto" : "productos"})</span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const key = item.variantId || item.productId;
              return (
                <div key={key} className="flex gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50">
                  <div className="w-24 h-24 flex-shrink-0 rounded-xl bg-white border border-gray-100 flex items-center justify-center overflow-hidden p-2">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Package className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/store/${slug}/product/${item.productId}`}
                      className="font-semibold text-gray-900 hover:text-gray-600 transition text-sm sm:text-base line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    {item.compareAtPrice && item.compareAtPrice > item.price && (
                      <p className="text-xs text-gray-400 line-through mt-0.5">${item.compareAtPrice.toFixed(2)}</p>
                    )}
                    <p className="font-bold mt-1" style={{ color: "var(--color-primary)" }}>${item.price.toFixed(2)}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition text-gray-500"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center text-sm font-medium text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition text-gray-500"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 sticky top-8">
              <h2 className="text-lg font-bold text-gray-900 mb-6" style={{ fontFamily: "var(--font-heading)" }}>Resumen</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({itemCount} productos)</span>
                  <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Envío</span>
                  <span className="text-gray-500">A calcular</span>
                </div>
                <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
              </div>
              <Link
                href={`/store/${slug}/checkout`}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 font-bold text-sm transition hover:opacity-90 rounded-full"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
              >
                Finalizar compra <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/store/${slug}/catalog`}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-6 py-3 font-medium text-sm transition rounded-full border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
              >
                Seguir comprando
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
