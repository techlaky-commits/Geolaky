"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** La carte occupe tout l'ecran ; les autres pages restent dans la colonne centree habituelle. */
export function MainShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullBleed = pathname?.startsWith("/map");

  if (fullBleed) {
    return <main className="flex-1">{children}</main>;
  }

  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>;
}
