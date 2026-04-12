import { ProductCard } from "./ProductCard";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  compare_at_price?: string | null;
  images?: { url: string; alt?: string }[];
}

interface ProductGridProps {
  products: Product[];
  storeSlug: string;
}

export function ProductGrid({ products, storeSlug }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          id={p.id}
          name={p.name}
          slug={p.slug}
          price={p.price}
          compare_at_price={p.compare_at_price}
          images={p.images}
          storeSlug={storeSlug}
        />
      ))}
    </div>
  );
}
