"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useStore } from "@/lib/context/StoreContext";
import { useSearchParams } from "next/navigation";
import {
  getProducts,
  type ProductListItem,
} from "@/lib/api/products";
import { getCustomers } from "@/lib/api/stores";
import {
  listPaymentMethods,
  type PaymentMethod,
} from "@/lib/api/payments";
import {
  getCurrentRegister,
  openRegister,
  closeRegister,
  createPOSSale,
  type CashRegister,
  type POSSaleResponse,
} from "@/lib/api/pos";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  X,
  Receipt,
  Wallet,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Printer,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────

interface CartItem {
  product: ProductListItem;
  quantity: number;
  unit_price: number;
}

interface CustomerLite {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

const PAYMENT_KIND_LABEL: Record<string, string> = {
  cash: "Efectivo",
  manual_external: "Cobro externo",
  manual_transfer: "Transferencia",
  digital_redirect: "Online",
};

// ─── Page ───────────────────────────────────────────

export default function POSPage() {
  const { currentStore } = useStore();
  const searchParams = useSearchParams();
  const fromChat = searchParams.get("from_chat");

  // Estado principal
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // Carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [paymentReceived, setPaymentReceived] = useState<string>("");
  const [paymentProof, setPaymentProof] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Modales
  const [openCashModal, setOpenCashModal] = useState(false);
  const [closeCashModal, setCloseCashModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<POSSaleResponse | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // Cargar todo
  const reload = useCallback(async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const [prods, custs, mets, reg] = await Promise.all([
        getProducts(currentStore.id, { limit: 60 }),
        getCustomers(currentStore.id).catch(() => []),
        listPaymentMethods(currentStore.id),
        getCurrentRegister(currentStore.id),
      ]);
      setProducts(prods.items || []);
      setCustomers(custs || []);
      setMethods(mets.filter((m) => m.is_active));
      setRegister(reg);
    } catch (e: any) {
      setError(e.message || "Error cargando POS");
    } finally {
      setLoading(false);
    }
  }, [currentStore]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Refetch productos al buscar
  useEffect(() => {
    if (!currentStore) return;
    getProducts(currentStore.id, { limit: 60, search: searchDebounced || undefined })
      .then((r) => setProducts(r.items || []))
      .catch(() => {});
  }, [searchDebounced, currentStore]);

  // Atajos teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F8" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
        e.preventDefault();
        if (cart.length > 0 && !submitting) onSubmitSale();
      } else if (e.key === "Escape") {
        if (cart.length > 0 && document.activeElement === document.body) {
          if (confirm("¿Vaciar carrito?")) clearCart();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, submitting]);

  // ── Cart helpers ──
  const addToCart = (p: ProductListItem) => {
    setCart((prev) => {
      const ix = prev.findIndex((i) => i.product.id === p.id);
      if (ix >= 0) {
        const next = [...prev];
        next[ix] = { ...next[ix], quantity: next[ix].quantity + 1 };
        return next;
      }
      return [...prev, { product: p, quantity: 1, unit_price: parseFloat(p.price) || 0 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const updatePrice = (productId: string, price: number) => {
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, unit_price: price } : i))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerId(null);
    setDiscount(0);
    setShipping(0);
    setPaymentReceived("");
    setPaymentProof("");
    setNotes("");
    setError("");
  };

  // ── Totals ──
  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    [cart]
  );
  const total = Math.max(0, subtotal - discount + shipping);

  const selectedMethod = methods.find((m) => m.id === paymentMethodId);
  const selectedKind = selectedMethod?.provider === "efectivo" ? "cash"
    : selectedMethod && ["transferencia", "pix", "ueno_bank", "sudameris", "gnb", "spei"].includes(selectedMethod.provider) ? "manual_transfer"
    : selectedMethod && ["mercadopago", "stripe", "paypal"].includes(selectedMethod.provider) ? "digital_redirect"
    : "manual_external";

  const cashReceived = parseFloat(paymentReceived) || 0;
  const changeDue = selectedKind === "cash" ? Math.max(0, cashReceived - total) : 0;
  const cashShort = selectedKind === "cash" && cashReceived > 0 && cashReceived < total;

  // ── Submit sale ──
  async function onSubmitSale() {
    if (!currentStore || cart.length === 0) return;
    if (!paymentMethodId) {
      setError("Elegí un método de pago");
      return;
    }
    if (selectedKind === "cash" && cashReceived < total) {
      setError(`Efectivo recibido ($${cashReceived}) menor al total ($${total.toFixed(2)})`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await createPOSSale(currentStore.id, {
        items: cart.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        payment_received: selectedKind === "cash" && paymentReceived ? cashReceived : null,
        payment_proof: paymentProof || null,
        discount_amount: discount,
        shipping_amount: shipping,
        notes: notes || null,
        from_conversation_id: fromChat,
      });
      setCompletedSale(result);
      clearCart();
      // Refrescar datos por stock + caja
      reload();
    } catch (e: any) {
      setError(e.message || "Error al cobrar");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Open / close cash register ──
  async function onOpenCash(amount: number) {
    if (!currentStore) return;
    try {
      const reg = await openRegister(currentStore.id, amount);
      setRegister(reg);
      setOpenCashModal(false);
    } catch (e: any) {
      alert(e.message || "Error abriendo caja");
    }
  }

  async function onCloseCash(counted: number, notes?: string) {
    if (!currentStore) return;
    try {
      const reg = await closeRegister(currentStore.id, counted, notes);
      setRegister(reg);
      setCloseCashModal(false);
      // Mostrar resumen del cierre
      const diff = parseFloat(reg.cash_difference || "0");
      const sign = diff >= 0 ? "+" : "";
      alert(
        `Cierre Z\n\n` +
        `Apertura: $${reg.opening_cash}\n` +
        `Esperado en caja: $${reg.expected_cash}\n` +
        `Contado: $${reg.counted_cash}\n` +
        `Diferencia: ${sign}$${diff}\n\n` +
        `Ventas: ${reg.sales_count} · Total: $${reg.sales_total}`
      );
      // Reset register para que vuelva a abrir
      setRegister(null);
    } catch (e: any) {
      alert(e.message || "Error cerrando caja");
    }
  }

  if (loading && products.length === 0) {
    return (
      <div className="py-12 flex items-center justify-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando POS…
      </div>
    );
  }

  // Si no hay métodos de pago configurados → forzar setup
  if (methods.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center max-w-md mx-auto">
        <Wallet className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">No tenés métodos de pago activos</h2>
        <p className="text-sm text-gray-500 mb-6">
          Para usar el POS necesitás configurar al menos un método de pago.
        </p>
        <Link
          href="/app/settings/payments"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
        >
          Configurar métodos →
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">POS</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">F2</kbd> buscar ·{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">F8</kbd> cobrar ·{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">Esc</kbd> vaciar
            {fromChat && (
              <span className="ml-3 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">
                desde chat
              </span>
            )}
          </p>
        </div>
        <div>
          {register ? (
            <div className="flex items-center gap-3">
              <div className="text-xs text-right">
                <div className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> Caja abierta
                </div>
                <div className="text-gray-500 mt-0.5">Apertura: ${register.opening_cash}</div>
              </div>
              <button
                onClick={() => setCloseCashModal(true)}
                className="px-3 py-1.5 text-xs border border-gray-200 hover:bg-gray-50 rounded font-medium inline-flex items-center gap-1"
              >
                <Lock className="w-3.5 h-3.5" /> Cerrar caja
              </button>
            </div>
          ) : (
            <button
              onClick={() => setOpenCashModal(true)}
              className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded font-medium inline-flex items-center gap-1"
            >
              <Unlock className="w-3.5 h-3.5" /> Abrir caja
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-4 h-[calc(100%-3rem)]">
        {/* ── Productos ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar por nombre o SKU… (F2)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                {searchDebounced ? "Sin resultados" : "Sin productos cargados"}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.stock_quantity === 0}
                    className="text-left p-2 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="aspect-square bg-gray-100 rounded mb-2 overflow-hidden">
                      {p.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.cover_image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-gray-300 text-xs">sin foto</div>
                      )}
                    </div>
                    <div className="text-xs font-medium text-gray-900 line-clamp-2 mb-1">{p.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">${p.price}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        p.stock_quantity === 0 ? "bg-red-50 text-red-600" :
                        p.stock_quantity <= 5 ? "bg-amber-50 text-amber-600" :
                        "bg-emerald-50 text-emerald-600"
                      }`}>
                        {p.stock_quantity === 0 ? "sin stock" : `${p.stock_quantity}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Carrito ── */}
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
          {/* Cliente */}
          <div className="px-4 py-3 border-b border-gray-100">
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Cliente</label>
            <select
              value={customerId || ""}
              onChange={(e) => setCustomerId(e.target.value || null)}
              className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded bg-white text-gray-900"
            >
              <option value="">— Cliente walk-in —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email}
                </option>
              ))}
            </select>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Carrito vacío. Tocá un producto para agregar.
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((i) => (
                  <div key={i.product.id} className="border border-gray-100 rounded p-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">{i.product.name}</div>
                      <button
                        onClick={() => removeFromCart(i.product.id)}
                        className="text-gray-300 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(i.product.id, -1)}
                          className="w-6 h-6 grid place-items-center bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{i.quantity}</span>
                        <button
                          onClick={() => updateQty(i.product.id, +1)}
                          className="w-6 h-6 grid place-items-center bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">$</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={i.unit_price}
                          onChange={(e) => updatePrice(i.product.id, parseFloat(e.target.value) || 0)}
                          className="w-20 text-sm text-right px-1.5 py-1 border border-gray-200 rounded bg-white text-gray-900"
                        />
                      </div>
                      <span className="text-sm font-semibold w-20 text-right">
                        ${(i.unit_price * i.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totales + cobro */}
          <div className="border-t border-gray-100 p-4 space-y-2 bg-gray-50/50">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Descuento</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={discount || ""}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-24 text-right px-1.5 py-0.5 border border-gray-200 rounded bg-white text-gray-900 text-sm"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Envío</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={shipping || ""}
                onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-24 text-right px-1.5 py-0.5 border border-gray-200 rounded bg-white text-gray-900 text-sm"
              />
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
              <span>TOTAL</span>
              <span>${total.toFixed(2)}</span>
            </div>

            {/* Método de pago */}
            <div className="pt-2">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Método de pago</label>
              <select
                value={paymentMethodId || ""}
                onChange={(e) => setPaymentMethodId(e.target.value || null)}
                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded bg-white text-gray-900"
              >
                <option value="">— Elegir método —</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.provider}
                  </option>
                ))}
              </select>
            </div>

            {/* Inputs según tipo de método */}
            {selectedKind === "cash" && paymentMethodId && (
              <div className="pt-2 space-y-1">
                <label className="block text-[10px] text-gray-500 uppercase tracking-wide">
                  Efectivo recibido
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={paymentReceived}
                  onChange={(e) => setPaymentReceived(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="w-full text-base font-semibold px-2 py-1.5 border border-gray-200 rounded bg-white text-gray-900"
                />
                {cashReceived > 0 && !cashShort && (
                  <div className="flex justify-between text-sm text-emerald-700 font-semibold pt-1">
                    <span>Vuelto</span>
                    <span>${changeDue.toFixed(2)}</span>
                  </div>
                )}
                {cashShort && (
                  <div className="text-xs text-red-600 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Falta ${(total - cashReceived).toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {selectedKind === "manual_transfer" && paymentMethodId && (
              <div className="pt-2">
                <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                  Comprobante (link / texto / nº operación)
                </label>
                <input
                  type="text"
                  value={paymentProof}
                  onChange={(e) => setPaymentProof(e.target.value)}
                  placeholder="Si no hay, queda 'a verificar'"
                  className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded bg-white text-gray-900 placeholder:text-gray-400"
                />
              </div>
            )}

            {/* Notas */}
            <div className="pt-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas (opcional)"
                className="w-full text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                {error}
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={clearCart}
                disabled={cart.length === 0 || submitting}
                className="px-3 py-2 border border-gray-200 hover:bg-gray-50 rounded text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={onSubmitSale}
                disabled={cart.length === 0 || submitting || !paymentMethodId}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-semibold text-sm inline-flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                Cobrar y crear pedido (F8)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: abrir caja */}
      {openCashModal && (
        <OpenCashModal onClose={() => setOpenCashModal(false)} onSubmit={onOpenCash} />
      )}

      {/* Modal: cerrar caja */}
      {closeCashModal && register && (
        <CloseCashModal
          register={register}
          onClose={() => setCloseCashModal(false)}
          onSubmit={onCloseCash}
        />
      )}

      {/* Modal: venta completada */}
      {completedSale && (
        <SaleCompletedModal
          sale={completedSale}
          storeName={currentStore?.name || ""}
          onClose={() => setCompletedSale(null)}
        />
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════
//  Modal: Abrir caja
// ═════════════════════════════════════════════════════

function OpenCashModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (amount: number) => void }) {
  const [amount, setAmount] = useState(0);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Abrir caja</h3>
        <p className="text-sm text-gray-500 mb-4">¿Cuánto efectivo tenés en la caja al iniciar el turno?</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount || ""}
            autoFocus
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-base font-semibold bg-white text-gray-900"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => onSubmit(amount)}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
          >
            Abrir caja
          </button>
        </div>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════
//  Modal: Cerrar caja
// ═════════════════════════════════════════════════════

function CloseCashModal({
  register,
  onClose,
  onSubmit,
}: {
  register: CashRegister;
  onClose: () => void;
  onSubmit: (counted: number, notes?: string) => void;
}) {
  const [counted, setCounted] = useState(0);
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Cerrar caja (Z)</h3>
        <p className="text-sm text-gray-500 mb-4">
          Contá el efectivo real que tenés en la caja. El sistema calcula la diferencia con lo esperado.
        </p>
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Apertura</span>
              <span>${register.opening_cash}</span>
            </div>
            <div className="flex justify-between text-gray-600 mt-1">
              <span>Ventas del turno</span>
              <span>{register.sales_count}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">Efectivo contado en caja</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={counted || ""}
                autoFocus
                onChange={(e) => setCounted(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-base font-semibold bg-white text-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">Notas del cierre (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej: faltante de $50 — devolución a cliente sin recibo"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => onSubmit(counted, notes || undefined)}
            className="flex-1 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-semibold"
          >
            Cerrar caja
          </button>
        </div>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════
//  Modal: Venta completada (con ticket imprimible)
// ═════════════════════════════════════════════════════

function SaleCompletedModal({
  sale,
  storeName,
  onClose,
}: {
  sale: POSSaleResponse;
  storeName: string;
  onClose: () => void;
}) {
  const printTicket = () => {
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 print:hidden" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-center mb-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 grid place-items-center mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Venta completada</h3>
            <p className="text-sm text-gray-500">Pedido <strong>{sale.order_number}</strong></p>
          </div>
          <div className="space-y-2 text-sm bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${sale.subtotal}</span></div>
            {parseFloat(sale.discount) > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Descuento</span><span>-${sale.discount}</span></div>
            )}
            {parseFloat(sale.shipping) > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Envío</span><span>${sale.shipping}</span></div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
              <span>Total</span><span>${sale.total}</span>
            </div>
            {sale.change_due && parseFloat(sale.change_due) > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Vuelto</span><span>${sale.change_due}</span>
              </div>
            )}
            <div className="text-xs text-center pt-1 text-gray-500">
              Pago: <strong className={
                sale.payment_status === "paid" ? "text-emerald-700" :
                sale.payment_status === "pending_verification" ? "text-amber-700" :
                "text-gray-700"
              }>{sale.payment_status}</strong>
            </div>
          </div>
          {sale.payment_redirect_url && (
            <a
              href={sale.payment_redirect_url}
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2 mb-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium text-center"
            >
              Abrir checkout →
            </a>
          )}
          <div className="flex gap-2">
            <button
              onClick={printTicket}
              className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Imprimir ticket
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
            >
              Nueva venta
            </button>
          </div>
        </div>
      </div>

      {/* Ticket imprimible (oculto en pantalla, visible solo al imprimir) */}
      <div className="hidden print:block print:p-4 print:font-mono print:text-xs print:max-w-[80mm]">
        <div className="text-center font-bold text-base mb-3">{storeName}</div>
        <div className="text-center mb-3">--- TICKET ---</div>
        <div className="mb-2">Pedido: {sale.order_number}</div>
        <div className="mb-2">Fecha: {new Date().toLocaleString("es-AR")}</div>
        <div className="border-t border-b border-black py-2 my-2">
          <div className="flex justify-between"><span>Subtotal</span><span>${sale.subtotal}</span></div>
          {parseFloat(sale.discount) > 0 && <div className="flex justify-between"><span>Descuento</span><span>-${sale.discount}</span></div>}
          {parseFloat(sale.shipping) > 0 && <div className="flex justify-between"><span>Envío</span><span>${sale.shipping}</span></div>}
          <div className="flex justify-between font-bold mt-1"><span>TOTAL</span><span>${sale.total}</span></div>
          {sale.change_due && parseFloat(sale.change_due) > 0 && (
            <div className="flex justify-between"><span>Vuelto</span><span>${sale.change_due}</span></div>
          )}
        </div>
        <div className="text-center mt-3">¡Gracias por tu compra!</div>
      </div>
    </>
  );
}
