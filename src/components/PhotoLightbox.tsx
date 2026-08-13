"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, MapPinned, Trash2, X } from "lucide-react";
import { compassLabel } from "@/lib/geo";

export type LightboxPhoto = {
  id: string;
  projectName: string;
  stampedPath: string;
  address: string | null;
  note: string | null;
  capturedAt: string;
  latitude: number;
  longitude: number;
  mediaType?: string;
  direction?: number | null;
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export function PhotoLightbox({
  photos,
  initialIndex = 0,
  onClose,
  onEditPosition,
  onDelete,
}: {
  photos: LightboxPhoto[];
  initialIndex?: number;
  onClose: () => void;
  onEditPosition?: (photo: LightboxPhoto) => void;
  onDelete?: (photoId: string) => Promise<boolean>;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [deleting, setDeleting] = useState(false);
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

  const isVideo = current.mediaType === "video";

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("Delete this item permanently?")) return;
    setDeleting(true);
    const ok = await onDelete(current.id);
    if (!ok) {
      setDeleting(false);
      alert("Could not delete this item.");
    }
  }

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
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-14 py-2">
        {count > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-2 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 sm:left-4"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {isVideo ? (
          <video
            key={current.id}
            src={`/api/files/${current.stampedPath}`}
            controls
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${current.stampedPath}`}
            alt={current.address ?? current.projectName}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        )}

        {count > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-2 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 sm:right-4"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      <div
        className="max-h-[35vh] space-y-1 overflow-y-auto bg-slate-950 px-5 py-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">{current.projectName}</p>
        {current.address && <p className="text-sm text-white/80">{current.address}</p>}
        <p className="text-xs text-white/60">{formatDateTime(current.capturedAt)}</p>
        {typeof current.direction === "number" && (
          <p className="flex items-center gap-1.5 text-xs text-white/60">
            <span
              className="inline-block h-0 w-0"
              style={{
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderBottom: "7px solid #ffffff",
                transform: `rotate(${current.direction}deg)`,
              }}
            />
            Orientation : {compassLabel(current.direction)} ({Math.round(current.direction)}°)
          </p>
        )}
        {current.note && <p className="text-sm italic text-white/80">{current.note}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            href={`/photos/${current.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-white/25 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
          >
            Open in editor
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {onEditPosition && (
            <button
              onClick={() => onEditPosition(current)}
              className="inline-flex items-center gap-1 rounded-md border border-white/25 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
            >
              Edit position
              <MapPinned className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded-md border border-red-400/40 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
