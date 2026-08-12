"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { MapPin, LogOut } from "lucide-react";

export function Nav() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/projects" className="flex items-center gap-2 font-semibold text-brand-700">
          <MapPin className="h-5 w-5" />
          Geolaky
        </Link>
        {session?.user && (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="hidden sm:inline">{session.user.name || session.user.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Deconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
