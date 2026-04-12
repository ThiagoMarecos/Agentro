"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getProduct } from "@/lib/api/storefront";
import { useCart } from "@/lib/context/CartContext";
import { ShoppingBag, Heart, Package, CreditCard, Check } from "lucide-react";

interface ProductData {
  name: string;
  description?: string;
  price: string;
  compare_at_price?: string;
  sku?: string;
  images?: { url: string; alt?: string }[];
  variants?: { id: string; name: string; price: string; stock_quantity: number }[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const id = params.id as string;
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    if (!slug || !id) return;
    getProduct(slug, id).then((p) => {
      setProduct(p);
      if (p.variants?.length) setSelectedVariant(p.variants[0].id);
    }).catch(() => setProduct(null)).finally(() => setLoading(false));
  }, [slug, id]);

  const buildCartItem = () => {
    if (!product) return null;
    const currentV = product.variants?.find((v) => v.id === selectedVariant);
    return {
      productId: id,
      variantId: selectedVariant ?? undefined,
      name: product.name + (currentV ? ` - ${currentV.name}` : ""),
      price: parseFloat(currentV ? currentV.price : product.price),
      compareAtPrice: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
      image: product.images?.[0]?.url,
      variant: currentV?.name,
    };
  };

  const handleAddToCart = () => {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    router.push(`/store/${slug}/checkout`);
  };

  if (loading) {
    return (
      <div className="bg-white min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid md:grid-cols-2 gap-12 animate-pulse">
            <div className="aspect-square rounded-2xl bg-gray-100" />
            <div className="space-y-4 py-4">
              <div className="h-8 w-3/4 rounded-lg bg-gray-100" />
              <div className="h-6 w-32 rounded bg-gray-100" />
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-2/3 rounded bg-gray-100" />
              <div className="h-14 w-full rounded-full mt-8 bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Producto no encontrado</h1>
          <Link href={`/store/${slug}/catalog`} className="font-medium text-sm" style={{ color: "var(--color-primary)" }}>Volver al catálogo</Link>
        </div>
      </div>
    );
  }

  const hasDiscount = product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price);
  const currentVariant = product.variants?.find((v) => v.id === selectedVariant);
  const displayPrice = currentVariant ? currentVariant.price : product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compare_at_price!)) * 100)
    : 0;

  return (
    <div className="bg-white min-h-[60vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-sm mb-8 text-gray-400">
          <Link href={`/store/${slug}`} className="transition hover:text-gray-700" style={{ color: "var(--color-primary)" }}>Inicio</Link>
          <span className="mx-2">/</span>
          <Link href={`/store/${slug}/catalog`} className="transition hover:text-gray-700" style={{ color: "var(--color-primary)" }}>Catálogo</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-500">{product.name}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-gray-50 border border-gray-100 p-4 sm:p-6 flex items-center justify-center relative">
              {product.images?.[selectedImage] ? (
                <img
                  src={product.images[selectedImage].url}
                  alt={product.images[selectedImage].alt || product.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <Package className="w-20 h-20 text-gray-300" />
              )}
              <button
                onClick={() => setWishlisted(!wishlisted)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md"
                style={{
                  backgroundColor: wishlisted ? "var(--color-primary)" : "#fff",
                  color: wishlisted ? "var(--color-primary-fg)" : "#9ca3af",
                }}
              >
                <Heart className="w-5 h-5" fill={wishlisted ? "currentColor" : "none"} />
              </button>
              {hasDiscount && (
                <div
                  className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: "var(--color-accent)" }}
                >
                  -{discountPercent}%
                </div>
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 transition p-1.5 flex items-center justify-center bg-gray-50"
                    style={{
                      border: selectedImage === i ? "2px solid var(--color-primary)" : "2px solid #e5e7eb",
                    }}
                  >
                    <img src={img.url} alt={img.alt || ""} className="max-w-full max-h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="py-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5 leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
              {product.name}
            </h1>

            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>${displayPrice}</span>
              {hasDiscount && (
                <span className="text-lg line-through text-gray-400">${product.compare_at_price}</span>
              )}
            </div>

            {product.description && (
              <p className="leading-relaxed mb-8 text-base text-gray-600">{product.description}</p>
            )}

            {product.variants && product.variants.length > 0 && (
              <div className="mb-8">
                <p className="text-sm font-semibold text-gray-900 mb-3">Variante</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      className="px-5 py-2.5 text-sm font-medium transition rounded-full"
                      style={{
                        border: selectedVariant === v.id ? "2px solid var(--color-primary)" : "1px solid #d1d5db",
                        backgroundColor: selectedVariant === v.id ? "var(--color-primary)" : "#fff",
                        color: selectedVariant === v.id ? "var(--color-primary-fg)" : "#374151",
                      }}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
                {currentVariant && (
                  <p className="text-xs mt-2 text-gray-500">
                    {currentVariant.stock_quantity > 0 ? `${currentVariant.stock_quantity} disponibles` : "Agotado"}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleBuyNow}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 font-bold transition text-sm hover:opacity-90 rounded-full"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
              >
                <CreditCard className="w-5 h-5" />
                Comprar ahora
              </button>
              <button
                onClick={handleAddToCart}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 font-semibold transition text-sm rounded-full border-2 border-gray-200 text-gray-700 hover:border-gray-900 hover:text-gray-900"
              >
                {addedToCart ? (
                  <>
                    <Check className="w-5 h-5" />
                    Agregado al carrito
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" />
                    Agregar al carrito
                  </>
                )}
              </button>
            </div>

            {product.sku && (
              <p className="text-xs mt-6 text-gray-400">SKU: {product.sku}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
