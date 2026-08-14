"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Film,
  ImagePlus,
  Loader2,
  MapPin,
  Send,
  TriangleAlert,
  Video,
  X,
} from "lucide-react";
import { useCompassHeading } from "@/hooks/useCompassHeading";
import { compassAbbreviation, formatDMS } from "@/lib/geo";

type Coords = { latitude: number; longitude: number; accuracy: number };

type Shot = {
  id: string;
  file: File;
  previewUrl: string;
  capturedAt: Date;
  coords: Coords | null;
  direction: number | null;
  status: "pending" | "uploading" | "done" | "error";
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function pickVideoMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/** Boussole temps reel superposee au flux camera : aiguille fixe pointant
 * vers le cap actuel, dans un cadran gradue N/E/S/O. */
function CompassDial({ heading, absolute }: { heading: number; absolute: boolean }) {
  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-white/40 bg-black/45 shadow-lg backdrop-blur-sm">
      <span className="absolute top-1.5 text-[10px] font-bold text-white">N</span>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/70">E</span>
      <span className="absolute bottom-1.5 text-[10px] font-bold text-white/70">S</span>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/70">O</span>

      <svg
        className="absolute left-1/2 top-1/2 h-24 w-24"
        style={{ transform: `translate(-50%, -50%) rotate(${heading}deg)` }}
        viewBox="-50 -50 100 100"
      >
        <line x1="0" y1="4" x2="0" y2="-36" stroke="#006f9c" strokeWidth="3" strokeLinecap="round" />
        <polygon points="0,-44 -7,-32 7,-32" fill="#006f9c" />
      </svg>

      <div className="flex flex-col items-center">
        <span className="text-lg font-bold leading-none text-white">{Math.round(heading)}°</span>
        <span className="text-xs font-semibold leading-none text-white/80">{compassAbbreviation(heading)}</span>
      </div>

      {!absolute && (
        <span className="absolute -bottom-5 whitespace-nowrap rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-medium text-white">
          Calibration recommandee
        </span>
      )}
    </div>
  );
}

export function CaptureClient({
  projectId,
  projectName,
  mode = "photo",
}: {
  projectId: string;
  projectName: string;
  mode?: "photo" | "video";
}) {
  const isVideoMode = mode === "video";
  const [geo, setGeo] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<"locating" | "ok" | "error">("locating");
  const [shots, setShots] = useState<Shot[]>([]);
  const [step, setStep] = useState<"shooting" | "note" | "done">("shooting");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [cameraState, setCameraState] = useState<"starting" | "live" | "unavailable">("starting");
  const [isRecording, setIsRecording] = useState(false);
  const [compassGestureNeeded, setCompassGestureNeeded] = useState(false);

  const compass = useCompassHeading();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchIdRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<{ coords: Coords | null; direction: number | null }>({
    coords: null,
    direction: null,
  });

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

  // Demarre le flux camera en direct des le montage : permet d'afficher la
  // boussole en superposition (impossible avec l'appareil photo natif de
  // l'OS, qui ouvre une autre application hors de notre controle). Si la
  // camera n'est pas accessible (permission refusee, navigateur non
  // compatible, pas de camera...), on retombe sur l'ancien selecteur de
  // fichier natif pour que l'application reste utilisable.
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setCameraState("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: isVideoMode,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraState("live");
      } catch {
        if (!cancelled) setCameraState("unavailable");
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoMode]);

  useEffect(() => {
    const DOE = (typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined) as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> })
      | undefined;
    if (typeof DOE?.requestPermission === "function") setCompassGestureNeeded(true);
  }, []);

  async function activateCompass() {
    await compass.requestPermission();
    setCompassGestureNeeded(false);
  }

  function addShot(file: File, direction: number | null, coords: Coords | null) {
    setShots((prev) => [
      ...prev,
      {
        id: makeId(),
        file,
        previewUrl: URL.createObjectURL(file),
        capturedAt: new Date(),
        coords,
        direction,
        status: "pending",
      },
    ]);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        addShot(new File([blob], `capture-${makeId()}.jpg`, { type: "image/jpeg" }), compass.heading, geo);
      },
      "image/jpeg",
      0.92,
    );
  }

  function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    const stream = streamRef.current;
    if (!stream) return;

    recordingStartRef.current = { coords: geo, direction: compass.heading };
    recordedChunksRef.current = [];
    const mimeType = pickVideoMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(recordedChunksRef.current, { type });
      addShot(
        new File([blob], `capture-${makeId()}.${ext}`, { type }),
        recordingStartRef.current.direction,
        recordingStartRef.current.coords,
      );
      setIsRecording(false);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      addShot(file, compass.heading, geo);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geo, compass.heading],
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
      if (shot.direction !== null) form.append("direction", String(shot.direction));
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
          {cameraState === "unavailable" ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-8">
              <input
                ref={fileInputRef}
                type="file"
                accept={isVideoMode ? "video/*" : "image/*"}
                capture="environment"
                onChange={onFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-700 active:scale-95"
              >
                {isVideoMode ? <Video className="h-10 w-10" /> : <Camera className="h-10 w-10" />}
              </button>
              <p className="text-center text-sm text-slate-500">
                {shots.length === 0
                  ? isVideoMode
                    ? "Appuyez pour filmer une video geolocalisee"
                    : "Appuyez pour prendre une photo geolocalisee"
                  : isVideoMode
                    ? "Filmez une autre video du meme endroit si besoin"
                    : "Reprenez une autre photo du meme endroit si besoin"}
              </p>
              {shots.length === 0 && (
                <Link href={`/projects/${projectId}`} className="text-sm text-brand-600 hover:underline">
                  Retour au projet
                </Link>
              )}
            </div>
          ) : (
            <div className="relative mx-auto overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "3 / 4" }}>
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              {cameraState === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-3">
                {compass.heading !== null ? (
                  <CompassDial heading={compass.heading} absolute={compass.absolute} />
                ) : compassGestureNeeded ? (
                  <button
                    onClick={activateCompass}
                    className="pointer-events-auto rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80"
                  >
                    Activer la boussole
                  </button>
                ) : null}

                {geo && (
                  <div className="rounded-full bg-black/50 px-3 py-1 text-center text-xs text-white backdrop-blur-sm">
                    {formatDMS(geo.latitude, geo.longitude)} ±{Math.round(geo.accuracy)} m
                  </div>
                )}
              </div>

              {isRecording && (
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  REC
                </div>
              )}

              <div className="absolute inset-x-0 bottom-4 flex items-center justify-center">
                <button
                  onClick={isVideoMode ? toggleRecording : capturePhoto}
                  disabled={cameraState !== "live"}
                  className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-white shadow-lg transition active:scale-95 disabled:opacity-50 ${
                    isRecording ? "bg-red-600" : "bg-white/20 backdrop-blur"
                  }`}
                  aria-label={isVideoMode ? (isRecording ? "Arreter l'enregistrement" : "Demarrer l'enregistrement") : "Prendre la photo"}
                >
                  {isVideoMode && isRecording ? (
                    <span className="h-5 w-5 rounded-sm bg-white" />
                  ) : (
                    <span className={`h-12 w-12 rounded-full ${isVideoMode ? "bg-red-600" : "bg-white"}`} />
                  )}
                </button>
              </div>
            </div>
          )}

          {shots.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {shots.map((shot) => (
                  <div
                    key={shot.id}
                    className="relative overflow-hidden rounded-lg border border-slate-200"
                  >
                    {isVideoMode ? (
                      <video src={shot.previewUrl} preload="metadata" muted className="aspect-square w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shot.previewUrl} alt="" className="aspect-square w-full object-cover" />
                    )}
                    {isVideoMode && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50">
                          <Film className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    )}
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
                Continuer avec {shots.length} {isVideoMode ? "video" : "photo"}
                {shots.length > 1 ? "s" : ""}
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
                {isVideoMode ? (
                  <video src={shot.previewUrl} preload="metadata" muted className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.previewUrl} alt="" className="h-full w-full object-cover" />
                )}
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
            {shots.length} {isVideoMode ? "video" : "photo"}
            {shots.length > 1 ? "s" : ""} envoyee{shots.length > 1 ? "s" : ""} et
            geolocalisee{shots.length > 1 ? "s" : ""} avec succes.
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetAll}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              {isVideoMode ? <Video className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
              {isVideoMode ? "Filmer d'autres videos" : "Prendre d'autres photos"}
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
