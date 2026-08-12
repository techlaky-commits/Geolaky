"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { Download, Loader2, RotateCcw, RotateCw, Save, Trash2, ZoomIn } from "lucide-react";

type PhotoData = {
  id: string;
  projectId: string;
  projectName: string;
  originalPath: string;
  stampedPath: string;
  address: string | null;
  note: string | null;
  updatedAt: string;
  cropData: string | null;
};

const ASPECT_OPTIONS = [
  { label: "Libre", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
];

export function RetouchClient({ photo }: { photo: PhotoData }) {
  const router = useRouter();
  const savedCrop = useMemo(() => (photo.cropData ? JSON.parse(photo.cropData) : null), [photo.cropData]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<number>(savedCrop?.rotation ?? 0);
  const [aspect, setAspect] = useState<number | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    savedCrop ? { x: savedCrop.x, y: savedCrop.y, width: savedCrop.width, height: savedCrop.height } : null,
  );

  const [address, setAddress] = useState(photo.address ?? "");
  const [note, setNote] = useState(photo.note ?? "");
  const [editingCrop, setEditingCrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim() || null,
          note: note.trim() || null,
          crop: editingCrop && croppedAreaPixels
            ? {
                x: croppedAreaPixels.x,
                y: croppedAreaPixels.y,
                width: croppedAreaPixels.width,
                height: croppedAreaPixels.height,
                rotation,
              }
            : undefined,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setVersion((v) => v + 1);
      setEditingCrop(false);
      router.refresh();
    } catch {
      setError("Impossible d'enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("Supprimer definitivement cette photo ?")) return;
    setDeleting(true);
    const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push(`/projects/${photo.projectId}`);
      router.refresh();
    } else {
      setDeleting(false);
      setError("Impossible de supprimer la photo.");
    }
  }

  const stampedUrl = `/api/files/${photo.stampedPath}?v=${version}`;
  const originalUrl = `/api/files/${photo.originalPath}`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/projects/${photo.projectId}`} className="text-sm text-brand-600 hover:underline">
          &larr; {photo.projectName}
        </Link>
        <a
          href={stampedUrl}
          download
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <Download className="h-4 w-4" /> Telecharger
        </a>
      </div>

      {!editingCrop ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stampedUrl} alt={photo.address || photo.projectName} className="w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative h-96 w-full overflow-hidden rounded-xl bg-slate-900">
            <Cropper
              image={originalUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect ?? undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              restrictPosition={aspect !== null}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <ZoomIn className="h-4 w-4 text-slate-500" />
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-28"
              />
            </div>
            <button
              type="button"
              onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              className="rounded-md border border-slate-300 p-2 hover:bg-slate-50"
              title="Rotation -90°"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="rounded-md border border-slate-300 p-2 hover:bg-slate-50"
              title="Rotation +90°"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <div className="flex gap-1">
              {ASPECT_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setAspect(opt.value)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    aspect === opt.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setEditingCrop((v) => !v)}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          {editingCrop ? "Annuler le recadrage" : "Modifier le cadrage / la rotation"}
        </button>
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Adresse affichee sur le tampon</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Adresse resolue automatiquement ou saisie manuelle"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
