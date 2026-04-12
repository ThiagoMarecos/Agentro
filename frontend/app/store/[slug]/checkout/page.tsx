"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, CreditCard, Package, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useCart } from "@/lib/context/CartContext";
import { createOrder } from "@/lib/api/storefront";

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  notes: string;
}

const INITIAL_FORM: FormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  notes: "",
};

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { items, subtotal, itemCount, clearCart } = useCart();
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{ order_number: string; total: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const canSubmit =
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.email.trim() &&
    form.address.trim() &&
    form.city.trim() &&
    items.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...form,
        items: items.map((i) => ({
          product_id: i.productId,
          variant_id: i.variantId,
          quantity: i.quantity,
        })),
      };
      const result = await createOrder(slug, payload);
      setOrderResult({ order_number: result.order_number, total: result.total });
      clearCart();
    } catch (err: any) {
      setError(err.message || "Error al procesar el pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (orderResult) {
    return (
      <div className="bg-white min-h-[60vh]">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3" style={{ fontFamily: "var(--font-heading)" }}>
            ¡Pedido confirmado!
          </h1>
          <p className="text-gray-500 mb-2">
            Tu número de pedido es:
          </p>
          <p className="text-2xl font-mono font-bold mb-6" style={{ color: "var(--color-primary)" }}>
            {orderResult.order_number}
          </p>
          <p className="text-gray-500 mb-8">
            Total: <span className="font-bold text-gray-900">${orderResult.total}</span>
          </p>
          <p className="text-sm text-gray-400 mb-8">
            Te enviaremos un email a <span className="font-medium text-gray-600">{form.email}</span> con los detalles del pedido.
          </p>
          <Link
            href={`/store/${slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 font-medium text-sm transition hover:opacity-90 rounded-full"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white min-h-[60vh]">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-20 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tu carrito está vacío</h1>
          <p className="text-gray-500 mb-6">Agregá productos antes de hacer el checkout.</p>
          <Link
            href={`/store/${slug}/catalog`}
            className="inline-flex items-center gap-2 px-6 py-3 font-medium text-sm transition hover:opacity-90 rounded-full"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            Ver catálogo
          </Link>
        </div>
      </div>
    );
  }

  const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 placeholder:text-gray-400";

  return (
    <div className="bg-white min-h-[60vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link
          href={`/store/${slug}/cart`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition mb-8 rounded-full"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al carrito
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-10" style={{ fontFamily: "var(--font-heading)" }}>Checkout</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Datos de contacto</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
                    <input name="first_name" value={form.first_name} onChange={handleChange} placeholder="Juan" className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Apellido *</label>
                    <input name="last_name" value={form.last_name} onChange={handleChange} placeholder="Pérez" className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="juan@email.com" className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="+54 11 1234-5678" className={inputCls} />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Dirección de envío</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Dirección *</label>
                    <input name="address" value={form.address} onChange={handleChange} placeholder="Av. Siempreviva 742" className={inputCls} required />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Ciudad *</label>
                      <input name="city" value={form.city} onChange={handleChange} placeholder="Buenos Aires" className={inputCls} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Provincia</label>
                      <input name="state" value={form.state} onChange={handleChange} placeholder="CABA" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Código postal</label>
                      <input name="postal_code" value={form.postal_code} onChange={handleChange} placeholder="1000" className={inputCls} />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Notas (opcional)</h2>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Instrucciones especiales para el pedido..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 placeholder:text-gray-400 resize-none"
                />
              </section>
            </div>

            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 sticky top-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                  Resumen del pedido
                </h2>

                <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.variantId || item.productId} className="flex gap-3">
                      <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-white border border-gray-100 flex items-center justify-center overflow-hidden p-1">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="max-w-full max-h-full object-contain" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</p>
                        <p className="text-xs text-gray-400">Cant: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium text-gray-900 flex-shrink-0">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({itemCount} productos)</span>
                    <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Envío</span>
                    <span className="text-gray-500">A calcular</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 mt-2 flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 font-bold text-sm transition rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: canSubmit ? "var(--color-primary)" : "#d1d5db",
                    color: canSubmit ? "var(--color-primary-fg)" : "#9ca3af",
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Confirmar pedido
                    </>
                  )}
                </button>

                <p className="mt-3 text-xs text-center text-gray-400 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> Pago seguro
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
