import Link from "next/link";
import { ImageIcon } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  price: string;
  compare_at_price?: string | null;
  images?: { url: string; alt?: string }[];
  storeSlug: string;
}

export function ProductCard({ id, name, price, compare_at_price, images, storeSlug }: ProductCardProps) {
  const imageUrl = images?.[0]?.url;
  const hasDiscount = compare_at_price && parseFloat(compare_at_price) > parseFloat(price);

  return (
    <Link href={`/store/${storeSlug}/product/${id}`} className="group">
      <div className="overflow-hidden transition-all duration-300 hover:-translate-y-1 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md">
        <div className="aspect-[4/5] relative overflow-hidden flex items-center justify-center p-3 bg-gray-50">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
              <ImageIcon className="w-10 h-10 mb-2" />
              <span className="text-xs">Sin imagen</span>
            </div>
          )}
          {hasDiscount && (
            <div
              className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-fg)" }}
            >
              Oferta
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-sm font-medium line-clamp-2 mb-2 text-gray-800 group-hover:text-gray-900 transition-colors">
            {name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: "var(--color-primary)" }}>${price}</span>
            {hasDiscount && (
              <span className="text-sm line-through text-gray-400">${compare_at_price}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
