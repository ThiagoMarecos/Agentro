import { HeroSection } from "./HeroSection";
import { FeaturedProductsSection } from "./FeaturedProductsSection";
import { DropsSection } from "./DropsSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { NewsletterSection } from "./NewsletterSection";
import { CustomTextSection } from "./CustomTextSection";
import { ImageSliderSection } from "./ImageSliderSection";
import { BannerSection } from "./BannerSection";
import { DividerSection } from "./DividerSection";
import { VideoSection } from "./VideoSection";
import {
  HeroSliderHybrid,
  HeroVideoHybrid,
  ProductsVideoHybrid,
  ProductsBannerHybrid,
  BannerSliderHybrid,
  BannerVideoHybrid,
  TextVideoHybrid,
  TestimonialsVideoHybrid,
  NewsletterVideoHybrid,
  DropsVideoHybrid,
  SliderVideoHybrid,
} from "./hybrids";

const SECTION_MAP: Record<string, React.ComponentType<any>> = {
  hero: HeroSection,
  featured_products: FeaturedProductsSection,
  drops: DropsSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
  custom_text: CustomTextSection,
  image_slider: ImageSliderSection,
  banner: BannerSection,
  divider: DividerSection,
  video: VideoSection,
};

const HYBRID_MAP: Record<string, React.ComponentType<any>> = {
  "banner+image_slider": BannerSliderHybrid,
  "banner+video": BannerVideoHybrid,
  "custom_text+video": TextVideoHybrid,
  "drops+video": DropsVideoHybrid,
  "featured_products+banner": ProductsBannerHybrid,
  "featured_products+video": ProductsVideoHybrid,
  "hero+image_slider": HeroSliderHybrid,
  "hero+video": HeroVideoHybrid,
  "image_slider+video": SliderVideoHybrid,
  "newsletter+video": NewsletterVideoHybrid,
  "testimonials+video": TestimonialsVideoHybrid,
};

function getHybridKey(types: [string, string]): string {
  return [...types].sort().join("+");
}

interface SectionRendererProps {
  section: {
    id?: string;
    type: string;
    enabled: boolean;
    order: number;
    config: any;
  };
  store: any;
  products: any[];
  drops: any[];
  slug: string;
}

export function SectionRenderer({ section, store, products, drops, slug }: SectionRendererProps) {
  if (!section.enabled) return null;

  if (section.type === "hybrid") {
    const types: [string, string] = section.config.types;
    const key = getHybridKey(types);
    const HybridComponent = HYBRID_MAP[key];
    if (!HybridComponent) return null;

    const needsStore = key.startsWith("hero");
    const needsProducts = key.includes("featured_products");
    const needsDrops = key.includes("drops");

    return (
      <HybridComponent
        config={section.config}
        slug={slug}
        {...(needsStore ? { store } : {})}
        {...(needsProducts ? { products } : {})}
        {...(needsDrops ? { drops } : {})}
      />
    );
  }

  const Component = SECTION_MAP[section.type];
  if (!Component) return null;

  const propsMap: Record<string, Record<string, any>> = {
    hero: { store, config: section.config, slug },
    featured_products: { products, config: section.config, slug },
    drops: { drops, slug },
    testimonials: { config: section.config },
    newsletter: { config: section.config },
    custom_text: { config: section.config },
    image_slider: { config: section.config },
    banner: { config: section.config },
    divider: { config: section.config },
    video: { config: section.config },
  };

  const props = propsMap[section.type] || { config: section.config };

  return <Component {...props} />;
}
