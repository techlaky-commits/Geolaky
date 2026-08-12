"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, ImageUp, Loader2, MapPinned, Trash2 } from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";

type GalleryPhoto = {
  id: string;
  stampedPath: string;
  address: string | null;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

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
    if (!confirm("Supprimer definitivement cette photo ?")) return;
    setBusyId(photo.id);
    try {
      const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
      if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } finally {
      setBusyId(null);
    }
  }

  function triggerReplace(photo: GalleryPhoto) {
    replaceTargetRef.current = photo.id;
    fileInputRef.current?.click();
  }

  async function onReplaceFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const photoId = replaceTargetRef.current;
    if (!file || !photoId) return;

    setBusyId(photoId);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/photos/${photoId}/replace`, { method: "POST", body: form });
      if (res.ok) setVersions((v) => ({ ...v, [photoId]: (v[photoId] ?? 0) + 1 }));
    } finally {
      setBusyId(null);
    }
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
          label: "Remplacer la photo",
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
        accept="image/*"
        className="hidden"
        onChange={onReplaceFileSelected}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
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
            </Link>
            {busyId === photo.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            )}
          </div>
        ))}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
    </>
  );
}
