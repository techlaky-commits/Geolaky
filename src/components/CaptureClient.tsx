"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";

type Coords = { latitude: number; longitude: number; accuracy: number };

type Shot = {
  id: string;
  file: File;
  previewUrl: string;
  capturedAt: Date;
  coords: Coords | null;
  status: "pending" | "uploading" | "done" | "error";
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function CaptureClient({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [geo, setGeo] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<"locating" | "ok" | "error">("locating");
  const [shots, setShots] = useState<Shot[]>([]);
  const [step, setStep] = useState<"shooting" | "note" | "done">("shooting");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGeo({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGeoStatus("ok");
      },
      () => setGeoStatus("error"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setShots((prev) => [
        ...prev,
        {
          id: makeId(),
          file,
          previewUrl: URL.createObjectURL(file),
          capturedAt: new Date(),
          coords: geo,
          status: "pending",
        },
      ]);
    },
    [geo],
  );

  function removeShot(id: string) {
    setShots((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  function resetAll() {
    shots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setShots([]);
    setNote("");
    setUploadError(null);
    setStep("shooting");
  }

  async function sendBatch() {
    setUploading(true);
    setUploadError(null);

    const groupId = shots.length > 1 ? makeId() : null;
    let anyError = false;

    for (const shot of shots) {
      setShots((prev) => prev.map((s) => (s.id === shot.id ? { ...s, status: "uploading" } : s)));

      const form = new FormData();
      form.append("file", shot.file);
      form.append("capturedAt", shot.capturedAt.toISOString());
      if (shot.coords) {
        form.append("latitude", String(shot.coords.latitude));
        form.append("longitude", String(shot.coords.longitude));
        form.append("accuracy", String(shot.coords.accuracy));
      }
      if (note.trim()) form.append("note", note.trim());
      if (groupId) form.append("groupId", groupId);

      try {
        const res = await fetch(`/api/projects/${projectId}/photos`, { method: "POST", body: form });
        if (!res.ok) throw new Error("upload failed");
        setShots((prev) => prev.map((s) => (s.id === shot.id ? { ...s, status: "done" } : s)));
      } catch {
        anyError = true;
        setShots((prev) => prev.map((s) => (s.id === shot.id ? { ...s, status: "error" } : s)));
      }
    }

    setUploading(false);
    if (anyError) {
      setUploadError("Certaines photos n'ont pas pu etre envoyees. Vous pouvez reessayer.");
    } else {
      setStep("done");
    }
  }

  const geoLabel =
    geoStatus === "locating"
      ? "Recherche de la position GPS..."
      : geoStatus === "ok" && geo
        ? `Position acquise (±${Math.round(geo.accuracy)} m)`
        : "Position GPS indisponible - activez la localisation";

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">{projectName}</h1>
      <p className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <MapPin className="h-3.5 w-3.5" />
        {geoLabel}
      </p>

      {step === "shooting" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-8">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-700 active:scale-95"
            >
              <Camera className="h-10 w-10" />
            </button>
            <p className="text-center text-sm text-slate-500">
              {shots.length === 0
                ? "Appuyez pour prendre une photo geolocalisee"
                : "Reprenez une autre photo du meme endroit si besoin"}
            </p>
            {shots.length === 0 && (
              <Link href={`/projects/${projectId}`} className="text-sm text-brand-600 hover:underline">
                Retour au projet
              </Link>
            )}
          </div>

          {shots.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {shots.map((shot) => (
                  <div
                    key={shot.id}
                    className="relative overflow-hidden rounded-lg border border-slate-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.previewUrl} alt="" className="aspect-square w-full object-cover" />
                    <div className="absolute left-1 top-1 rounded-full bg-black/60 p-1">
                      {shot.coords ? (
                        <MapPin className="h-3 w-3 text-green-400" />
                      ) : (
                        <TriangleAlert className="h-3 w-3 text-amber-400" />
                      )}
                    </div>
                    <button
                      onClick={() => removeShot(shot.id)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep("note")}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700"
              >
                Continuer avec {shots.length} photo{shots.length > 1 ? "s" : ""}
              </button>
            </>
          )}
        </div>
      )}

      {step === "note" && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
            {shots.map((shot) => (
              <div
                key={shot.id}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.previewUrl} alt="" className="h-full w-full object-cover" />
                {shot.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                {shot.status === "done" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                )}
                {shot.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
                    <TriangleAlert className="h-5 w-5 text-red-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {shots.length > 1
              ? `${shots.length} photos - date, position et adresse seront ajoutees individuellement, le commentaire ci-dessous s'appliquera aux ${shots.length}.`
              : `Prise le ${formatDateTime(shots[0].capturedAt)}. L'adresse complete sera ajoutee automatiquement a l'envoi.`}
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Commentaire {shots.length > 1 ? "(applique aux photos du lot)" : "(optionnel)"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={uploading}
              className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:opacity-60"
              placeholder="Ex : Facade nord, fissure observee"
            />
          </div>

          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setStep("shooting")}
              disabled={uploading}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </button>
            <button
              onClick={sendBatch}
              disabled={uploading}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {uploading ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {shots.length} photo{shots.length > 1 ? "s" : ""} envoyee{shots.length > 1 ? "s" : ""} et
            geolocalisee{shots.length > 1 ? "s" : ""} avec succes.
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetAll}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              <ImagePlus className="h-4 w-4" />
              Prendre d&apos;autres photos
            </button>
            <Link
              href={`/projects/${projectId}`}
              className="flex-1 rounded-md bg-brand-600 px-4 py-2.5 text-center font-medium text-white hover:bg-brand-700"
            >
              Voir le projet
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
