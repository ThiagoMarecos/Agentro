import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        <Link href="/" className="brand-nexora text-base">
          Nexora
        </Link>
        <div className="flex gap-6 text-[13px] text-text-muted">
          <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacidad</Link>
          <Link href="/terms" className="hover:text-text-primary transition-colors">Términos</Link>
        </div>
      </div>
    </footer>
  );
}
