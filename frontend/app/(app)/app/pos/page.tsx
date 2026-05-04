"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useStore } from "@/lib/context/StoreContext";
import { useSearchParams } from "next/navigation";
import {
  getProducts,
  type ProductListItem,
} from "@/lib/api/products";
import {
  listCustomers,
  createCustomer,
  type Customer,
} from "@/lib/api/customers";
import {
  listPaymentMethods,
  type PaymentMethod,
  type ProviderInfo,
  getRecommendedProviders,
} from "@/lib/api/payments";
import {
  getCurrentRegister,
  openRegister,
  closeRegister,
  createPOSSale,
  type CashRegister,
  type POSSaleResponse,
} from "@/lib/api/pos";
import { ProviderLogo } from "@/components/payments/ProviderLogo";
import {
  Search, Plus, Minus, Trash2, Loader2, X, Receipt, Lock, Unlock,
  AlertTriangle, CheckCircle2, Printer, UserPlus, ShoppingCart,
  CreditCard, PackageOpen, Settings, Wallet,
} from "lucide-react";

interface CartItem {
  product: ProductListItem;
  quantity: number;
  unit_price: number;
}

// ═════════════════════════════════════════════════════
//                       PAGE
// ═════════════════════════════════════════════════════

export default function POSPage() {
  const { currentStore } = useStore();
  const searchParams = useSearchParams();
  const fromChat = searchParams.get("from_chat");

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [providersInfo, setProvidersInfo] = useState<ProviderInfo[]>([]);
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  // Para walk-in: si no eligen cliente, podés tipear nombre/teléfono que va a ir
  // a las notes de la orden (no crea Customer)
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInDocument, setWalkInDocument] = useState("");

  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [paymentReceived, setPaymentReceived] = useState<string>("");
  const [paymentProof, setPaymentProof] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [openCashModal, setOpenCashModal] = useState(false);
  const [closeCashModal, setCloseCashModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<POSSaleResponse | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const [prods, custs, mets, providers, reg] = await Promise.all([
        getProducts(currentStore.id, { limit: 60 }),
        listCustomers(currentStore.id, undefined, 50).catch(() => []),
        listPaymentMethods(currentStore.id),
        getRecommendedProviders(currentStore.id),
        getCurrentRegister(currentStore.id),
      ]);
      setProducts(prods.items || []);
      setCustomers(custs || []);
      setMethods(mets.filter((m) => m.is_active));
      setProvidersInfo(providers.providers || []);
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

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!currentStore) return;
    getProducts(currentStore.id, { limit: 60, search: searchDebounced || undefined })
      .then((r) => setProducts(r.items || []))
      .catch(() => {});
  }, [searchDebounced, currentStore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";

      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F8" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
        e.preventDefault();
        if (cart.length > 0 && !submitting && paymentMethodId) onSubmitSale();
      } else if (e.key === "Escape" && !isTyping) {
        if (cart.length > 0) {
          if (confirm("¿Vaciar carrito?")) clearCart();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, submitting, paymentMethodId]);

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
        .map((i) => (i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const updatePrice = (productId: string, price: number) => {
    setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, unit_price: price } : i)));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerId(null);
    setWalkInName("");
    setWalkInPhone("");
    setWalkInDocument("");
    setDiscount(0);
    setShipping(0);
    setPaymentReceived("");
    setPaymentProof("");
    setError("");
  };

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    [cart]
  );
  const total = Math.max(0, subtotal - discount + shipping);

  const selectedMethod = methods.find((m) => m.id === paymentMethodId);
  const selectedProviderInfo = selectedMethod
    ? providersInfo.find((p) => p.key === selectedMethod.provider)
    : null;
  const selectedKind = selectedProviderInfo?.kind || "manual_external";

  const cashReceived = parseFloat(paymentReceived) || 0;
  const changeDue = selectedKind === "cash" ? Math.max(0, cashReceived - total) : 0;
  const cashShort = selectedKind === "cash" && cashReceived > 0 && cashReceived < total;

  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : null;

  const customerSummary = selectedCustomer
    ? [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(" ") || selectedCustomer.email
    : walkInName.trim() || "Cliente walk-in (sin registrar)";

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

    // Componer las notas con datos del walk-in si aplica
    const noteParts: string[] = [];
    if (!customerId && walkInName.trim()) noteParts.push(`Comprador: ${walkInName.trim()}`);
    if (!customerId && walkInPhone.trim()) noteParts.push(`Tel: ${walkInPhone.trim()}`);
    if (!customerId && walkInDocument.trim()) noteParts.push(`Doc: ${walkInDocument.trim()}`);
    const notes = noteParts.length > 0 ? noteParts.join(" · ") : null;

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
        notes,
        from_conversation_id: fromChat,
      });
      setCompletedSale(result);
      clearCart();
      reload();
    } catch (e: any) {
      setError(e.message || "Error al cobrar");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCreateCustomer(payload: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    document: string;
  }) {
    if (!currentStore) return;
    const created = await createCustomer(currentStore.id, payload);
    // Refrescamos lista y seleccionamos el creado
    const next = await listCustomers(currentStore.id, undefined, 50);
    setCustomers(next);
    setCustomerId(created.id);
    setNewCustomerOpen(false);
  }

  if (loading && products.length === 0) {
    return (
      <div className="py-12 flex items-center justify-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando POS…
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-12 text-center max-w-md mx-auto">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-white shadow-sm grid place-items-center mb-4">
          <CreditCard className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Configurá un método de pago</h2>
        <p className="text-sm text-gray-600 mb-5">
          Para usar el POS necesitás al menos un método activo. Te recomendamos arrancar con Efectivo.
        </p>
        <Link
          href="/app/settings/payments"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
        >
          Configurar métodos →
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 inline-flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-indigo-500" /> POS
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">F2</kbd> buscar ·{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">F8</kbd> cobrar ·{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">Esc</kbd> vaciar
            {fromChat && (
              <span className="ml-3 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">
                desde chat #{fromChat.substring(0, 6)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Link a configurar métodos de pago */}
          <Link
            href="/app/settings/payments"
            className="px-3 py-1.5 text-xs bg-white border border-gray-200 hover:bg-gray-50 hover:border-indigo-300 rounded-lg font-medium inline-flex items-center gap-1.5 text-gray-700"
            title="Agregar / editar métodos de pago"
          >
            <Wallet className="w-3.5 h-3.5" /> Métodos de pago
          </Link>

          {register ? (
            <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-1.5">
              <div className="text-xs">
                <div className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Caja abierta
                </div>
                <div className="text-gray-500 text-[10px] mt-0.5">
                  Apertura: ${register.opening_cash}
                </div>
              </div>
              <button
                onClick={() => setCloseCashModal(true)}
                className="px-2.5 py-1 text-xs border border-gray-200 hover:bg-gray-50 rounded font-medium inline-flex items-center gap-1 shrink-0"
              >
                <Lock className="w-3.5 h-3.5" /> Cerrar Z
              </button>
            </div>
          ) : (
            <button
              onClick={() => setOpenCashModal(true)}
              className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg font-medium inline-flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" /> Abrir caja
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,440px] gap-4 h-[calc(100%-3rem)]">
        {/* ────────────────────────────────────────── */}
        {/*  Productos (columna izquierda)             */}
        {/* ────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="grid place-items-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">1</span>
              <span className="text-sm font-semibold text-gray-900">Agregá productos</span>
            </div>
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
              <div className="text-center py-16 text-gray-400">
                <PackageOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{searchDebounced ? "Sin resultados" : "Sin productos cargados"}</p>
                {!searchDebounced && (
                  <Link href="/app/products/new" className="text-xs text-indigo-600 hover:underline mt-2 inline-block">
                    Agregá tu primer producto →
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.stock_quantity === 0}
                    className="group text-left p-2 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="aspect-square bg-gray-50 rounded mb-2 overflow-hidden relative">
                      {p.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.cover_image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-gray-300">
                          <PackageOpen className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition grid place-items-center opacity-0 group-hover:opacity-100">
                        <Plus className="w-6 h-6 text-indigo-700 bg-white rounded-full p-1 shadow" />
                      </div>
                    </div>
                    <div className="text-xs font-medium text-gray-900 line-clamp-2 mb-1 min-h-[2.4em]">{p.name}</div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-bold text-gray-900">${p.price}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        p.stock_quantity === 0 ? "bg-red-50 text-red-600" :
                        p.stock_quantity <= 5 ? "bg-amber-50 text-amber-700" :
                        "bg-emerald-50 text-emerald-700"
                      }`}>
                        {p.stock_quantity === 0 ? "✕" : `${p.stock_quantity}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ────────────────────────────────────────── */}
        {/*  Carrito + cobro (columna derecha)         */}
        {/* ────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
          {/* Items del carrito */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="px-4 py-8 text-gray-400">
                <div className="text-center mb-6">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-gray-500 mb-1">Carrito vacío</p>
                  <p className="text-xs text-gray-400">Tocá un producto a la izquierda para agregar</p>
                </div>

                {/* Preview de métodos de pago disponibles */}
                {methods.length > 0 && (
                  <div className="border-t border-gray-100 pt-5">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">
                      Vas a poder cobrar con:
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {methods.map((m) => {
                        const provInfo = providersInfo.find((p) => p.key === m.provider);
                        return (
                          <div
                            key={m.id}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200"
                          >
                            {provInfo && <ProviderLogo provider={provInfo} size={24} rounded="md" />}
                            <span className="text-xs font-medium text-gray-700">
                              {m.display_name || provInfo?.name || m.provider}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 text-center">
                      <Link
                        href="/app/settings/payments"
                        className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
                      >
                        <Settings className="w-3 h-3" /> Editar / agregar métodos
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="grid place-items-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{cart.length}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {cart.length === 1 ? "1 producto" : `${cart.length} productos`} en el carrito
                  </span>
                </div>
                <div className="space-y-2">
                  {cart.map((i) => (
                    <div key={i.product.id} className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/40">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">{i.product.name}</div>
                        <button
                          onClick={() => removeFromCart(i.product.id)}
                          className="text-gray-300 hover:text-red-500 transition"
                          title="Quitar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQty(i.product.id, -1)}
                            className="w-7 h-7 grid place-items-center bg-white border border-gray-200 hover:bg-gray-100 rounded text-gray-700"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold">{i.quantity}</span>
                          <button
                            onClick={() => updateQty(i.product.id, +1)}
                            className="w-7 h-7 grid place-items-center bg-white border border-gray-200 hover:bg-gray-100 rounded text-gray-700"
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
                        <span className="text-sm font-bold w-20 text-right text-gray-900">
                          ${(i.unit_price * i.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Cliente (Step 2) ── */}
          {cart.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">2</span>
                <span className="text-sm font-semibold text-gray-900">¿Para quién es?</span>
                <div className="flex-1" />
                <button
                  onClick={() => setNewCustomerOpen(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Nuevo cliente
                </button>
              </div>
              <select
                value={customerId || ""}
                onChange={(e) => {
                  setCustomerId(e.target.value || null);
                  if (e.target.value) {
                    setWalkInName("");
                    setWalkInPhone("");
                    setWalkInDocument("");
                  }
                }}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"
              >
                <option value="">— Cliente walk-in (escribir abajo) —</option>
                {customers.map((c) => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;
                  return (
                    <option key={c.id} value={c.id}>
                      {name}{c.phone ? ` · ${c.phone}` : ""}
                    </option>
                  );
                })}
              </select>

              {!customerId && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    placeholder="Nombre (opcional)"
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded bg-white text-gray-900 placeholder:text-gray-400"
                  />
                  <input
                    type="text"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    placeholder="Teléfono (opc.)"
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded bg-white text-gray-900 placeholder:text-gray-400"
                  />
                  <input
                    type="text"
                    value={walkInDocument}
                    onChange={(e) => setWalkInDocument(e.target.value)}
                    placeholder="Cédula / RUC (opc.)"
                    className="col-span-2 text-xs px-2 py-1.5 border border-gray-200 rounded bg-white text-gray-900 placeholder:text-gray-400"
                  />
                  <p className="col-span-2 text-[10px] text-gray-400">
                    Walk-in: estos datos se guardan en el ticket y la nota del pedido (sin crear cliente).
                    <button
                      type="button"
                      onClick={() => setNewCustomerOpen(true)}
                      className="text-indigo-600 hover:underline ml-1"
                    >
                      Registrar cliente →
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Pago + total (Step 3) ── */}
          {cart.length > 0 && (
            <div className="border-t border-gray-100 p-4 space-y-2.5 bg-gradient-to-b from-gray-50/30 to-gray-50/60">
              <div className="flex items-center gap-2 mb-1">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">3</span>
                <span className="text-sm font-semibold text-gray-900">Cobrar</span>
              </div>

              {/* Totales */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Descuento</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={discount || ""}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24 text-right px-2 py-0.5 border border-gray-200 rounded bg-white text-gray-900 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Envío</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={shipping || ""}
                    onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24 text-right px-2 py-0.5 border border-gray-200 rounded bg-white text-gray-900 text-sm"
                  />
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                  <span>TOTAL</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Métodos de pago como chips grandes */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Método de pago</div>
                  <Link
                    href="/app/settings/payments"
                    className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Agregar
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {methods.map((m) => {
                    const provInfo = providersInfo.find((p) => p.key === m.provider);
                    const sel = paymentMethodId === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setPaymentMethodId(m.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition text-left ${
                          sel
                            ? "border-indigo-500 bg-indigo-50 shadow-sm"
                            : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        {provInfo && <ProviderLogo provider={provInfo} size={36} rounded="md" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 line-clamp-1">
                            {m.display_name || provInfo?.name || m.provider}
                          </div>
                          {sel && (
                            <div className="text-[10px] text-indigo-600 font-medium inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Seleccionado
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inputs según tipo */}
              {selectedKind === "cash" && paymentMethodId && (
                <div className="pt-2 space-y-1">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wide">Efectivo recibido</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={paymentReceived}
                    onChange={(e) => setPaymentReceived(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className="w-full text-lg font-bold px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"
                  />
                  {cashReceived > 0 && !cashShort && (
                    <div className="flex justify-between text-sm text-emerald-700 font-bold pt-1 px-1">
                      <span>Vuelto</span>
                      <span>${changeDue.toFixed(2)}</span>
                    </div>
                  )}
                  {cashShort && (
                    <div className="text-xs text-red-600 inline-flex items-center gap-1 px-1">
                      <AlertTriangle className="w-3 h-3" /> Falta ${(total - cashReceived).toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              {selectedKind === "manual_transfer" && paymentMethodId && (
                <div className="pt-2">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                    Comprobante (link / nº op. / texto)
                  </label>
                  <input
                    type="text"
                    value={paymentProof}
                    onChange={(e) => setPaymentProof(e.target.value)}
                    placeholder="Si no tenés, queda 'a verificar'"
                    className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded bg-white text-gray-900 placeholder:text-gray-400"
                  />
                </div>
              )}

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                  {error}
                </div>
              )}

              {/* Botón cobrar */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={clearCart}
                  disabled={submitting}
                  className="px-3 py-2.5 border border-gray-200 hover:bg-gray-50 rounded-lg text-sm font-medium disabled:opacity-50"
                  title="Vaciar (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={onSubmitSale}
                  disabled={cart.length === 0 || submitting || !paymentMethodId}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                  Cobrar ${total.toFixed(2)} (F8)
                </button>
              </div>

              <p className="text-[10px] text-gray-400 text-center">
                {customerSummary}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modales ── */}
      {openCashModal && (
        <OpenCashModal
          onClose={() => setOpenCashModal(false)}
          onSubmit={async (amt) => {
            if (!currentStore) return;
            try {
              const reg = await openRegister(currentStore.id, amt);
              setRegister(reg);
              setOpenCashModal(false);
            } catch (e: any) {
              alert(e.message || "Error abriendo caja");
            }
          }}
        />
      )}

      {closeCashModal && register && (
        <CloseCashModal
          register={register}
          onClose={() => setCloseCashModal(false)}
          onSubmit={async (counted, notes) => {
            if (!currentStore) return;
            try {
              const reg = await closeRegister(currentStore.id, counted, notes);
              setCloseCashModal(false);
              const diff = parseFloat(reg.cash_difference || "0");
              const sign = diff >= 0 ? "+" : "";
              alert(
                `Cierre Z\n\n` +
                `Apertura: $${reg.opening_cash}\n` +
                `Esperado: $${reg.expected_cash}\n` +
                `Contado: $${reg.counted_cash}\n` +
                `Diferencia: ${sign}$${diff}\n\n` +
                `Ventas: ${reg.sales_count} · Total: $${reg.sales_total}`
              );
              setRegister(null);
            } catch (e: any) {
              alert(e.message || "Error cerrando caja");
            }
          }}
        />
      )}

      {newCustomerOpen && (
        <NewCustomerModal
          onClose={() => setNewCustomerOpen(false)}
          onCreate={onCreateCustomer}
          initialName={walkInName}
          initialPhone={walkInPhone}
          initialDocument={walkInDocument}
        />
      )}

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
//  Modal: Nuevo cliente
// ═════════════════════════════════════════════════════

function NewCustomerModal({
  onClose,
  onCreate,
  initialName,
  initialPhone,
  initialDocument,
}: {
  onClose: () => void;
  onCreate: (p: { first_name: string; last_name: string; phone: string; email: string; document: string }) => Promise<void>;
  initialName?: string;
  initialPhone?: string;
  initialDocument?: string;
}) {
  // Si el initialName tiene espacio, separa nombre y apellido
  const initParts = (initialName || "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(initParts[0] || "");
  const [lastName, setLastName] = useState(initParts.slice(1).join(" ") || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState(initialDocument || "");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() && !phone.trim() && !email.trim()) {
      setErr("Ingresá al menos nombre, teléfono o email");
      return;
    }
    setSubmitting(true);
    setErr("");
    try {
      await onCreate({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        document: document.trim(),
      });
    } catch (e: any) {
      setErr(e.message || "Error creando cliente");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 inline-flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-500" /> Nuevo cliente
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Queda registrado para futuras ventas y reportes.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nombre</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                placeholder="Juan"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Apellido</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Teléfono</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+595 981 123456"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Email (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@ejemplo.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Cédula / RUC / DNI</label>
            <input
              type="text"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="1234567-8"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {err && <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{err}</div>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
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
        <div className="text-center mb-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 grid place-items-center mb-3">
            <Unlock className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Abrir caja</h3>
          <p className="text-sm text-gray-500 mt-1">¿Cuánto efectivo tenés al iniciar el turno?</p>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount || ""}
            autoFocus
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full pl-8 pr-3 py-3 border border-gray-200 rounded-lg text-xl font-bold bg-white text-gray-900 text-center"
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
        <h3 className="text-lg font-semibold text-gray-900 mb-2 inline-flex items-center gap-2">
          <Lock className="w-5 h-5 text-gray-600" /> Cerrar caja (Z)
        </h3>
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
            <label className="block text-xs text-gray-600 mb-1.5">Efectivo contado</label>
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
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-base font-bold bg-white text-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej: faltante de $50 — devolución sin recibo"
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
  const printTicket = () => window.print();

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
              <Printer className="w-4 h-4" /> Imprimir
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

      {/* Ticket imprimible */}
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
