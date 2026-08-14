"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  ExternalLink,
  Film,
  FolderKanban,
  ImageUp,
  Loader2,
  MapPinned,
  Trash2,
} from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { GalleryBulkEditBar } from "@/components/GalleryBulkEditBar";

type GalleryPhoto = {
  id: string;
  stampedPath: string;
  address: string | null;
  mediaType: string;
  direction: number | null;
};

export function PhotoGalleryGrid({
  photos: initialPhotos,
  projectName,
}: {
  photos: GalleryPhoto[];
  projectName: string;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [versions, setVersions] = useState<Record<string, number>>({});
  const [menu, setMenu] = useState<{ x: number; y: number; photo: GalleryPhoto } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<GalleryPhoto | null>(null);

  function openMenu(e: React.MouseEvent, photo: GalleryPhoto) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, photo });
  }

  function downloadPhoto(photo: GalleryPhoto) {
    const a = document.createElement("a");
    a.href = `/api/files/${photo.stampedPath}?v=${versions[photo.id] ?? 0}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function deletePhoto(photo: GalleryPhoto) {
    if (!confirm("Supprimer definitivement cet element ?")) return;
    setBusyId(photo.id);
    try {
      const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
      if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } finally {
      setBusyId(null);
    }
  }

  function triggerReplace(photo: GalleryPhoto) {
    replaceTargetRef.current = photo;
    fileInputRef.current?.click();
  }

  async function onReplaceFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const photo = replaceTargetRef.current;
    if (!file || !photo) return;

    setBusyId(photo.id);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/photos/${photo.id}/replace`, { method: "POST", body: form });
      if (res.ok) setVersions((v) => ({ ...v, [photo.id]: (v[photo.id] ?? 0) + 1 }));
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runOnSelection(
    apply: (id: string) => Promise<boolean>,
    onSuccessIds?: (ids: string[]) => void,
  ) {
    setBulkBusy(true);
    setBulkError(null);
    const ids = Array.from(selectedIds);
    const succeeded: string[] = [];
    for (const id of ids) {
      const ok = await apply(id).catch(() => false);
      if (ok) succeeded.push(id);
    }
    setBulkBusy(false);
    if (succeeded.length < ids.length) {
      setBulkError("Certains elements n'ont pas pu etre traites.");
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      succeeded.forEach((id) => next.delete(id));
      return next;
    });
    onSuccessIds?.(succeeded);
  }

  function bulkMoveToProject(targetId: string) {
    runOnSelection(
      async (id) => {
        const res = await fetch(`/api/photos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: targetId }),
        });
        return res.ok;
      },
      (succeeded) => {
        setPhotos((prev) => prev.filter((p) => !succeeded.includes(p.id)));
        router.refresh();
      },
    );
  }

  function bulkCopyToProject(targetId: string) {
    runOnSelection(async (id) => {
      const res = await fetch(`/api/photos/${id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProjectId: targetId }),
      });
      return res.ok;
    });
  }

  function bulkApplyAddress(address: string) {
    runOnSelection(async (id) => {
      const res = await fetch(`/api/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address || null }),
      });
      return res.ok;
    });
  }

  function bulkApplyNote(note: string) {
    runOnSelection(async (id) => {
      const res = await fetch(`/api/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || null }),
      });
      return res.ok;
    });
  }

  function bulkDelete() {
    runOnSelection(
      async (id) => {
        const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
        return res.ok;
      },
      (succeeded) => {
        setPhotos((prev) => prev.filter((p) => !succeeded.includes(p.id)));
      },
    );
  }

  const menuItems: ContextMenuItem[] = menu
    ? [
        {
          label: "Modifier la description",
          icon: <ExternalLink className="h-4 w-4" />,
          onClick: () => router.push(`/photos/${menu.photo.id}#description`),
        },
        {
          label: "Modifier la position",
          icon: <MapPinned className="h-4 w-4" />,
          onClick: () => router.push(`/photos/${menu.photo.id}#emplacement`),
        },
        {
          label: "Changer de projet",
          icon: <FolderKanban className="h-4 w-4" />,
          onClick: () => router.push(`/photos/${menu.photo.id}#projet`),
        },
        {
          label: menu.photo.mediaType === "video" ? "Remplacer la video" : "Remplacer la photo",
          icon: <ImageUp className="h-4 w-4" />,
          onClick: () => triggerReplace(menu.photo),
        },
        {
          label: "Telecharger",
          icon: <Download className="h-4 w-4" />,
          onClick: () => downloadPhoto(menu.photo),
        },
        {
          label: "Supprimer",
          icon: <Trash2 className="h-4 w-4" />,
          onClick: () => deletePhoto(menu.photo),
          danger: true,
        },
      ]
    : [];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={replaceTargetRef.current?.mediaType === "video" ? "video/*" : "image/*"}
        className="hidden"
        onChange={onReplaceFileSelected}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => {
          const selected = selectedIds.has(photo.id);
          return (
            <div
              key={photo.id}
              className={`relative overflow-hidden rounded-lg border bg-white shadow-sm ${
                selected ? "border-brand-400 ring-2 ring-brand-200" : "border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSelect(photo.id);
                }}
                className={`absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow transition ${
                  selected
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-white bg-white/85 text-transparent hover:bg-white"
                }`}
                aria-label={selected ? "Deselectionner" : "Selectionner"}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <Link
                href={`/photos/${photo.id}`}
                onContextMenu={(e) => openMenu(e, photo)}
                className="group block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${photo.stampedPath}?v=${versions[photo.id] ?? 0}`}
                  alt={photo.address || projectName}
                  className="aspect-square w-full object-cover transition group-hover:opacity-90"
                />
                {photo.mediaType === "video" && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55">
                      <Film className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
                {typeof photo.direction === "number" && (
                  <div
                    className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55"
                    title="Direction de prise de vue"
                  >
                    <div
                      className="h-0 w-0"
                      style={{
                        borderLeft: "4px solid transparent",
                        borderRight: "4px solid transparent",
                        borderBottom: "7px solid #ffffff",
                        transform: `rotate(${photo.direction}deg)`,
                      }}
                    />
                  </div>
                )}
              </Link>
              {busyId === photo.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}

      {selectedIds.size > 0 && (
        <GalleryBulkEditBar
          count={selectedIds.size}
          busy={bulkBusy}
          error={bulkError}
          onClear={() => setSelectedIds(new Set())}
          onMoveToProject={(id) => bulkMoveToProject(id)}
          onCopyToProject={(id) => bulkCopyToProject(id)}
          onApplyAddress={bulkApplyAddress}
          onApplyNote={bulkApplyNote}
          onDelete={bulkDelete}
        />
      )}
    </>
  );
}
