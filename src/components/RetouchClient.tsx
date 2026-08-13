"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { parseCoordsInput } from "@/lib/geo";
import { ProjectPicker } from "@/components/ProjectPicker";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderKanban,
  ImageUp,
  Loader2,
  MapPinned,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Undo2,
  ZoomIn,
} from "lucide-react";

const PositionMap = dynamic(() => import("@/components/PositionMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ),
});

type PhotoData = {
  id: string;
  projectId: string;
  projectName: string;
  originalPath: string;
  stampedPath: string;
  address: string | null;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
  cropData: string | null;
  mediaType: string;
  durationSeconds: number | null;
};

type NavigationInfo = {
  prevPhotoId: string | null;
  nextPhotoId: string | null;
  position: number;
  total: number;
};

type Position = { latitude: number; longitude: number };

type EditSnapshot = {
  address: string;
  note: string;
  projectId: string;
  position: Position | null;
  rotation: number;
  aspect: number | null;
  crop: { x: number; y: number };
  zoom: number;
  croppedAreaPixels: Area | null;
};

const ASPECT_OPTIONS = [
  { label: "Libre", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
];

const DEFAULT_POSITION: Position = { latitude: 48.8566, longitude: 2.3522 }; // Paris, si aucune position n'est definie
const MAX_HISTORY = 30;

export function RetouchClient({ photo, navigation }: { photo: PhotoData; navigation?: NavigationInfo }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isVideo = photo.mediaType === "video";
  const savedCrop = useMemo(() => (photo.cropData ? JSON.parse(photo.cropData) : null), [photo.cropData]);
  const originalPosition = useMemo(
    () =>
      photo.latitude !== null && photo.longitude !== null
        ? { latitude: photo.latitude, longitude: photo.longitude }
        : null,
    [photo.latitude, photo.longitude],
  );

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<number>(savedCrop?.rotation ?? 0);
  const [aspect, setAspect] = useState<number | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    savedCrop ? { x: savedCrop.x, y: savedCrop.y, width: savedCrop.width, height: savedCrop.height } : null,
  );

  const [address, setAddress] = useState(photo.address ?? "");
  const [note, setNote] = useState(photo.note ?? "");
  const [projectId, setProjectId] = useState(photo.projectId);
  const [position, setPosition] = useState(originalPosition);
  const [pasteCoords, setPasteCoords] = useState("");
  const [editingCrop, setEditingCrop] = useState(!isVideo && searchParams.get("edit") === "crop");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [history, setHistory] = useState<EditSnapshot[]>([]);

  const replaceInputRef = useRef<HTMLInputElement>(null);
  const sessionKeysRef = useRef<Set<string>>(new Set());

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  useEffect(() => {
    const targetId = window.location.hash.replace("#", "");
    if (!targetId) return;
    const timer = setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const snapshot = useCallback(
    (): EditSnapshot => ({ address, note, projectId, position, rotation, aspect, crop, zoom, croppedAreaPixels }),
    [address, note, projectId, position, rotation, aspect, crop, zoom, croppedAreaPixels],
  );

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h, snapshot()].slice(-MAX_HISTORY));
  }, [snapshot]);

  function pushHistoryOnce(key: string) {
    if (sessionKeysRef.current.has(key)) return;
    sessionKeysRef.current.add(key);
    pushHistory();
  }

  function releaseSessionKey(key: string) {
    sessionKeysRef.current.delete(key);
  }

  // Filet de securite : si le drag du cadrage/zoom se termine hors de son
  // conteneur, on relache quand meme la cle pour que le prochain geste pousse
  // un nouveau niveau d'historique.
  useEffect(() => {
    function onGlobalRelease() {
      releaseSessionKey("crop");
      releaseSessionKey("zoom");
    }
    window.addEventListener("mouseup", onGlobalRelease);
    window.addEventListener("touchend", onGlobalRelease);
    return () => {
      window.removeEventListener("mouseup", onGlobalRelease);
      window.removeEventListener("touchend", onGlobalRelease);
    };
  }, []);

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setAddress(prev.address);
    setNote(prev.note);
    setProjectId(prev.projectId);
    setPosition(prev.position);
    setRotation(prev.rotation);
    setAspect(prev.aspect);
    setCrop(prev.crop);
    setZoom(prev.zoom);
    setCroppedAreaPixels(prev.croppedAreaPixels);
  }

  // Ctrl+Z / Cmd+Z pour annuler, sauf si le focus est dans un champ texte
  // (pour laisser le undo natif du navigateur fonctionner dans les inputs).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  // Navigation clavier (fleches gauche/droite) vers la photo/video precedente
  // ou suivante du projet, sauf si le focus est dans un champ de saisie.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowLeft" && navigation?.prevPhotoId) {
        router.push(`/photos/${navigation.prevPhotoId}`);
      }
      if (e.key === "ArrowRight" && navigation?.nextPhotoId) {
        router.push(`/photos/${navigation.nextPhotoId}`);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigation, router]);

  const positionChanged =
    position !== null &&
    (!originalPosition ||
      position.latitude !== originalPosition.latitude ||
      position.longitude !== originalPosition.longitude);

  function applyPastedCoords() {
    const parsed = parseCoordsInput(pasteCoords);
    if (!parsed) {
      setError("Format de coordonnees invalide. Exemple : 48.858370, 2.294481");
      return;
    }
    pushHistory();
    setPosition(parsed);
    setPasteCoords("");
    setError(null);
  }

  function rotateBy(delta: number) {
    pushHistory();
    setRotation((r) => (r + delta + 360) % 360);
  }

  function changeAspect(value: number | null) {
    pushHistory();
    setAspect(value);
  }

  function updatePositionFromMap(latitude: number, longitude: number) {
    pushHistory();
    setPosition({ latitude, longitude });
  }

  function setDefaultPosition() {
    pushHistory();
    setPosition(DEFAULT_POSITION);
  }

  function changeProject(id: string) {
    pushHistory();
    setProjectId(id);
  }

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
          position: positionChanged ? position : undefined,
          projectId: projectId !== photo.projectId ? projectId : undefined,
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
    if (!confirm(`Supprimer definitivement cet${isVideo ? "te video" : "te photo"} ?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push(`/projects/${photo.projectId}`);
      router.refresh();
    } else {
      setDeleting(false);
      setError(`Impossible de supprimer ${isVideo ? "la video" : "la photo"}.`);
    }
  }

  async function onReplaceFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const confirmMsg = isVideo
      ? "Remplacer la video actuelle par ce nouveau fichier ?"
      : "Remplacer l'image actuelle par cette nouvelle photo ? Le recadrage en cours sera reinitialise.";
    if (!confirm(confirmMsg)) return;

    setReplacing(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/photos/${photo.id}/replace`, { method: "POST", body: form });
      if (!res.ok) throw new Error("replace failed");
      setEditingCrop(false);
      setVersion((v) => v + 1);
      router.refresh();
    } catch {
      setError(`Impossible de remplacer ${isVideo ? "la video" : "la photo"}.`);
    } finally {
      setReplacing(false);
    }
  }

  const stampedUrl = `/api/files/${photo.stampedPath}?v=${version}`;
  const originalUrl = `/api/files/${photo.originalPath}?v=${version}`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/projects/${photo.projectId}`} className="text-sm text-brand-600 hover:underline">
          &larr; {photo.projectName}
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            title="Annuler la derniere modification (Ctrl+Z)"
            className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
            Annuler
          </button>
          <a
            href={stampedUrl}
            download
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <Download className="h-4 w-4" /> Telecharger
          </a>
        </div>
      </div>

      {navigation && (navigation.prevPhotoId || navigation.nextPhotoId) && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <button
            type="button"
            onClick={() => navigation.prevPhotoId && router.push(`/photos/${navigation.prevPhotoId}`)}
            disabled={!navigation.prevPhotoId}
            className="flex items-center gap-1 font-medium text-slate-700 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Precedent
          </button>
          <span className="text-xs text-slate-400">
            {navigation.position} / {navigation.total}
          </span>
          <button
            type="button"
            onClick={() => navigation.nextPhotoId && router.push(`/photos/${navigation.nextPhotoId}`)}
            disabled={!navigation.nextPhotoId}
            className="flex items-center gap-1 font-medium text-slate-700 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {isVideo ? (
        <div className="flex max-h-[45vh] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-black">
          <video key={photo.id} src={stampedUrl} controls className="max-h-[45vh] w-full" />
        </div>
      ) : !editingCrop ? (
        <div className="flex max-h-[45vh] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stampedUrl}
            alt={photo.address || photo.projectName}
            className="max-h-[45vh] w-full object-contain"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className="relative h-96 w-full overflow-hidden rounded-xl bg-slate-900"
            onMouseDown={() => pushHistoryOnce("crop")}
            onTouchStart={() => pushHistoryOnce("crop")}
            onMouseUp={() => releaseSessionKey("crop")}
            onTouchEnd={() => releaseSessionKey("crop")}
          >
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
                onMouseDown={() => pushHistoryOnce("zoom")}
                onTouchStart={() => pushHistoryOnce("zoom")}
                onMouseUp={() => releaseSessionKey("zoom")}
                onTouchEnd={() => releaseSessionKey("zoom")}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-28"
              />
            </div>
            <button
              type="button"
              onClick={() => rotateBy(-90)}
              className="rounded-md border border-slate-300 p-2 hover:bg-slate-50"
              title="Rotation -90°"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => rotateBy(90)}
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
                  onClick={() => changeAspect(opt.value)}
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

      {isVideo && photo.durationSeconds ? (
        <p className="mt-2 text-xs text-slate-500">Duree : {Math.round(photo.durationSeconds)} s</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-4">
        {!isVideo && (
          <button
            type="button"
            onClick={() => setEditingCrop((v) => !v)}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            {editingCrop ? "Annuler le recadrage" : "Modifier le cadrage / la rotation"}
          </button>
        )}

        <input
          ref={replaceInputRef}
          type="file"
          accept={isVideo ? "video/*" : "image/*"}
          className="hidden"
          onChange={onReplaceFileSelected}
        />
        <button
          type="button"
          onClick={() => replaceInputRef.current?.click()}
          disabled={replacing}
          className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline disabled:opacity-60"
        >
          {replacing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
          {isVideo ? "Remplacer la video" : "Remplacer la photo"}
        </button>
      </div>

      <div id="description" className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Description</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Adresse affichee sur le tampon</label>
          <input
            value={address}
            onFocus={() => pushHistoryOnce("address")}
            onBlur={() => releaseSessionKey("address")}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Adresse resolue automatiquement ou saisie manuelle"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
          <textarea
            value={note}
            onFocus={() => pushHistoryOnce("note")}
            onBlur={() => releaseSessionKey("note")}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      <div id="projet" className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <FolderKanban className="h-4 w-4" />
          Projet
        </h2>
        <p className="text-xs text-slate-500">
          Deplacez cet{isVideo ? "te video" : "te photo"} vers un autre projet existant, ou creez-en un nouveau.
        </p>
        <ProjectPicker value={projectId} onChange={changeProject} />
      </div>

      <div id="emplacement" className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <MapPinned className="h-4 w-4" />
          Emplacement
        </h2>

        {position ? (
          <>
            <PositionMap
              latitude={position.latitude}
              longitude={position.longitude}
              onChange={updatePositionFromMap}
            />
            <p className="text-xs text-slate-500">
              Faites glisser le repere rouge pour affiner la position directement sur la carte.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={position.latitude}
                  onFocus={() => pushHistoryOnce("latlng")}
                  onBlur={() => releaseSessionKey("latlng")}
                  onChange={(e) =>
                    setPosition((p) => (p ? { ...p, latitude: Number(e.target.value) } : p))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={position.longitude}
                  onFocus={() => pushHistoryOnce("latlng")}
                  onBlur={() => releaseSessionKey("latlng")}
                  onChange={(e) =>
                    setPosition((p) => (p ? { ...p, longitude: Number(e.target.value) } : p))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Ou coller des coordonnees GPS exactes
              </label>
              <div className="flex gap-2">
                <input
                  value={pasteCoords}
                  onChange={(e) => setPasteCoords(e.target.value)}
                  placeholder="48.858370, 2.294481"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={applyPastedCoords}
                  disabled={!pasteCoords.trim()}
                  className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Cet{isVideo ? "te video n'a" : "te photo n'a"} pas de position enregistree.
            <button
              type="button"
              onClick={setDefaultPosition}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              Definir une position
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
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
