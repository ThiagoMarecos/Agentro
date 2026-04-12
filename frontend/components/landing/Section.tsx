"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";

interface SectionProps {
  id?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ id, title, subtitle, children, className = "" }: SectionProps) {
  return (
    <section id={id} className={`py-16 lg:py-24 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll>
          {(title || subtitle) && (
            <div className="max-w-2xl mb-12">
              {title && (
                <h2 className="heading-section text-3xl md:text-4xl mb-3">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-lg text-text-muted">{subtitle}</p>
              )}
            </div>
          )}
          {children}
        </AnimateOnScroll>
      </div>
    </section>
  );
}
