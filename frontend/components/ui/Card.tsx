/**
 * Card reutilizable
 */

import { HTMLAttributes } from "react";

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/5 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
