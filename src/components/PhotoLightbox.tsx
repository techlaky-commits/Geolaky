"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

export type LightboxPhoto = {
  id: string;
  projectName: string;
  stampedPath: string;
  address: string | null;
  note: string | null;
  capturedAt: string;
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export function PhotoLightbox({
  photos,
  initialIndex = 0,
  onClose,
}: {
  photos: LightboxPhoto[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const count = photos.length;
  const current = photos[index];

  const next = () => setIndex((i) => (i + 1) % count);
  const prev = () => setIndex((i) => (i - 1 + count) % count);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && count > 1) next();
      if (e.key === "ArrowLeft" && count > 1) prev();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm text-white/80">
          {count > 1 ? `${index + 1} / ${count}` : current.projectName}
        </span>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 hover:bg-white/10"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-2 pb-2">
        {count > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-2 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 sm:left-4"
            aria-label="Photo precedente"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/${current.stampedPath}`}
          alt={current.address ?? current.projectName}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />

        {count > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-2 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 sm:right-4"
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      <div
        className="space-y-1 bg-gradient-to-t from-black/80 to-transparent px-5 py-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">{current.projectName}</p>
        {current.address && <p className="text-sm text-white/80">{current.address}</p>}
        <p className="text-xs text-white/60">{formatDateTime(current.capturedAt)}</p>
        {current.note && <p className="text-sm italic text-white/80">{current.note}</p>}
        <Link
          href={`/photos/${current.id}`}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-300 hover:underline"
        >
          Ouvrir dans l&apos;editeur
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
