"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const PhotoMapClient = dynamic(
  () => import("@/components/PhotoMapClient").then((mod) => mod.PhotoMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[70vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  },
);

export function MapClientWrapper({ initialProjectId }: { initialProjectId?: string }) {
  return <PhotoMapClient initialProjectId={initialProjectId} />;
}
