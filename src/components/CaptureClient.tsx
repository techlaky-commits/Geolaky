"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, Loader2, MapPin, RotateCcw, Send, TriangleAlert } from "lucide-react";

type Coords = { latitude: number; longitude: number; accuracy: number };

type Shot = {
  file: File;
  previewUrl: string;
  capturedAt: Date;
  coords: Coords | null;
};

function formatCoords(coords: Coords) {
  return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${Math.round(coords.accuracy)} m)`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function CaptureClient({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [geo, setGeo] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<"locating" | "ok" | "error">("locating");
  const [shot, setShot] = useState<Shot | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      setShot({ file, previewUrl: URL.createObjectURL(file), capturedAt: new Date(), coords: geo });
      setUploadError(null);
      setSuccess(false);
    },
    [geo],
  );

  function retake() {
    if (shot) URL.revokeObjectURL(shot.previewUrl);
    setShot(null);
    setNote("");
    setUploadError(null);
  }

  async function onSend() {
    if (!shot) return;
    setUploading(true);
    setUploadError(null);

    const form = new FormData();
    form.append("file", shot.file);
    form.append("capturedAt", shot.capturedAt.toISOString());
    if (shot.coords) {
      form.append("latitude", String(shot.coords.latitude));
      form.append("longitude", String(shot.coords.longitude));
      form.append("accuracy", String(shot.coords.accuracy));
    }
    if (note.trim()) form.append("note", note.trim());

    try {
      const res = await fetch(`/api/projects/${projectId}/photos`, { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
      URL.revokeObjectURL(shot.previewUrl);
      setShot(null);
      setNote("");
      setSuccess(true);
    } catch {
      setUploadError("Echec de l'envoi. Verifiez votre connexion et reessayez.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">{projectName}</h1>
      <p className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <MapPin className="h-3.5 w-3.5" />
        {geoStatus === "locating" && "Recherche de la position GPS..."}
        {geoStatus === "ok" && geo && `Position acquise (±${Math.round(geo.accuracy)} m)`}
        {geoStatus === "error" && "Position GPS indisponible - activez la localisation"}
      </p>

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Photo envoyee et geolocalisee avec succes.
        </div>
      )}

      {!shot && (
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
          <p className="text-center text-sm text-slate-500">Appuyez pour prendre une photo geolocalisee</p>
          <Link href={`/projects/${projectId}`} className="text-sm text-brand-600 hover:underline">
            Retour au projet
          </Link>
        </div>
      )}

      {shot && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot.previewUrl} alt="Apercu" className="w-full" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-black/10 p-3 text-white">
              <p className="text-sm font-semibold">{projectName}</p>
              {shot.coords ? (
                <p className="text-xs opacity-90">{formatCoords(shot.coords)}</p>
              ) : (
                <p className="flex items-center gap-1 text-xs opacity-90">
                  <TriangleAlert className="h-3 w-3" /> Position GPS non disponible
                </p>
              )}
              <p className="text-xs opacity-90">{formatDateTime(shot.capturedAt)}</p>
              <p className="mt-1 text-[10px] opacity-70">
                L&apos;adresse complete sera ajoutee automatiquement a l&apos;envoi.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note (optionnel)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Ex : Facade nord, fissure observee"
            />
          </div>

          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

          <div className="flex gap-2">
            <button
              onClick={retake}
              disabled={uploading}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              Reprendre
            </button>
            <button
              onClick={onSend}
              disabled={uploading}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {uploading ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
