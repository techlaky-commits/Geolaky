"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImagePlus, Loader2, MapPin, TriangleAlert, Upload, X } from "lucide-react";

type ImportItem = {
  id: string;
  file: File;
  previewUrl: string;
  latitude: number | null;
  longitude: number | null;
  capturedAt: Date;
  gpsChecked: boolean;
  status: "pending" | "uploading" | "done" | "error";
  errorMsg?: string;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ImportClient({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setDone(false);
    const newItems: ImportItem[] = files.map((file) => ({
      id: makeId(),
      file,
      previewUrl: URL.createObjectURL(file),
      latitude: null,
      longitude: null,
      capturedAt: new Date(file.lastModified || Date.now()),
      gpsChecked: false,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...newItems]);

    // Lecture des tags EXIF (GPS + date de prise de vue) en arriere-plan,
    // photo par photo, sans bloquer l'affichage de la grille d'apercu.
    newItems.forEach(async (item) => {
      try {
        const exifr = await import("exifr");
        // Deux appels separes : le champ "latitude"/"longitude" calcule par exifr.gps()
        // n'est pas reconnu par l'option `pick` de exifr.parse(), qui ne filtre que
        // les tags EXIF bruts.
        const [gps, dates] = await Promise.all([
          exifr.gps(item.file).catch(() => null),
          exifr.parse(item.file, { pick: ["DateTimeOriginal", "CreateDate"] }).catch(() => null),
        ]);
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  latitude: typeof gps?.latitude === "number" ? gps.latitude : null,
                  longitude: typeof gps?.longitude === "number" ? gps.longitude : null,
                  capturedAt: dates?.DateTimeOriginal ?? dates?.CreateDate ?? it.capturedAt,
                  gpsChecked: true,
                }
              : it,
          ),
        );
      } catch {
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, gpsChecked: true } : it)));
      }
    });
  }, []);

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  }

  async function importAll() {
    setImporting(true);
    setDone(false);

    for (const item of items) {
      if (item.status === "done") continue;
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "uploading" } : it)));

      const form = new FormData();
      form.append("file", item.file);
      form.append("capturedAt", item.capturedAt.toISOString());
      if (item.latitude !== null && item.longitude !== null) {
        form.append("latitude", String(item.latitude));
        form.append("longitude", String(item.longitude));
      }

      try {
        const res = await fetch(`/api/projects/${projectId}/photos`, { method: "POST", body: form });
        if (!res.ok) throw new Error("upload failed");
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "done" } : it)));
      } catch {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "error", errorMsg: "Echec de l'envoi" } : it,
          ),
        );
      }
    }

    setImporting(false);
    setDone(true);
  }

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const withGps = items.filter((i) => i.latitude !== null).length;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">{projectName}</h1>
      <p className="mb-4 text-sm text-slate-500">
        Importez des photos depuis votre galerie - la position GPS et la date sont lues
        automatiquement dans la photo si elles y sont enregistrees.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFilesSelected}
        className="hidden"
      />

      {items.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-slate-500 hover:border-brand-400 hover:text-brand-600"
        >
          <ImagePlus className="h-10 w-10" />
          Choisir des photos dans la galerie
        </button>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="text-sm font-medium text-brand-600 hover:underline disabled:opacity-60"
            >
              + Ajouter d&apos;autres photos
            </button>
            <span className="text-sm text-slate-500">
              {withGps}/{items.length} avec position GPS
            </span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            {items.map((item) => (
              <div key={item.id} className="relative overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" className="aspect-square w-full object-cover" />

                <div className="absolute left-1 top-1 rounded-full bg-black/60 p-1">
                  {!item.gpsChecked ? (
                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                  ) : item.latitude !== null ? (
                    <MapPin className="h-3 w-3 text-green-400" />
                  ) : (
                    <TriangleAlert className="h-3 w-3 text-amber-400" />
                  )}
                </div>

                {item.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                {item.status === "done" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                  </div>
                )}
                {item.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
                    <TriangleAlert className="h-6 w-6 text-red-300" />
                  </div>
                )}

                {item.status === "pending" && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {done ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {doneCount} photo{doneCount > 1 ? "s" : ""} importee{doneCount > 1 ? "s" : ""}
                {errorCount > 0 && `, ${errorCount} en echec`}.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setItems([])}
                  className="flex-1 rounded-md border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Importer d&apos;autres photos
                </button>
                <Link
                  href={`/projects/${projectId}`}
                  className="flex-1 rounded-md bg-brand-600 px-4 py-2.5 text-center font-medium text-white hover:bg-brand-700"
                >
                  Voir le projet
                </Link>
              </div>
            </div>
          ) : (
            <button
              onClick={importAll}
              disabled={importing || items.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing
                ? `Import en cours... (${doneCount}/${items.length})`
                : `Importer ${items.length} photo${items.length > 1 ? "s" : ""}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
