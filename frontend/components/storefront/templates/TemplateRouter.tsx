import { StreetTemplate } from "./StreetTemplate";
import { BoutiqueTemplate } from "./BoutiqueTemplate";
import { TechTemplate } from "./TechTemplate";
import { ArtesanalTemplate } from "./ArtesanalTemplate";
import type { TemplateProps, Section } from "./types";

const TEMPLATES: Record<string, React.ComponentType<TemplateProps>> = {
  streetwear: StreetTemplate,
  boutique: BoutiqueTemplate,
  tech: TechTemplate,
  artesanal: ArtesanalTemplate,
};

interface TemplateRouterProps extends TemplateProps {
  templateName: string;
}

export function TemplateRouter({ templateName, ...props }: TemplateRouterProps) {
  const Template = TEMPLATES[templateName] || StreetTemplate;
  return <Template {...props} />;
}
