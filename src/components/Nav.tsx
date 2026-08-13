"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { MapPin, LogOut, Map, Home } from "lucide-react";

const TABS = [
  { href: "/projects", label: "Home", icon: Home },
  { href: "/map", label: "Carte", icon: Map },
];

export function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <Link href="/projects" className="mr-3 flex items-center gap-2 font-semibold text-brand-700">
            <MapPin className="h-5 w-5" />
            LakyMaps
          </Link>
          {session?.user &&
            TABS.map((tab) => {
              const active = tab.href === "/projects" ? pathname === "/projects" : pathname?.startsWith(tab.href);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  title={tab.label}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-brand-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Link>
              );
            })}
        </div>
        {session?.user && (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="hidden sm:inline">{session.user.name || session.user.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Deconnexion"
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Deconnexion</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
