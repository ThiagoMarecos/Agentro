import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedí tu invitación a la beta",
  description:
    "Sumate a la beta cerrada de Agentro: el agente de IA que atiende WhatsApp 24/7, muestra tu catálogo y cierra ventas por vos. Solicitá tu invitación gratis.",
  alternates: { canonical: "/request-invite" },
  openGraph: {
    title: "Pedí tu invitación a Agentro · Beta cerrada",
    description:
      "Beta gratis por invitación. Agente IA + WhatsApp + tienda online + POS. Solo para los primeros negocios.",
    url: "/request-invite",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RequestInviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
