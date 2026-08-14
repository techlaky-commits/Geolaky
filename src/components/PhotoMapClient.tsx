"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { LayersControl, MapContainer, Marker, TileLayer, ZoomControl, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Check, Loader2, LocateFixed, MapPin, X } from "lucide-react";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { MapSearchBar } from "@/components/MapSearchBar";
import { BulkEditBar } from "@/components/BulkEditBar";
import { haversineDistanceMeters } from "@/lib/geo";

type MapPhoto = {
  id: string;
  projectId: string;
  projectName: string;
  stampedPath: string;
  latitude: number;
  longitude: number;
  address: string | null;
  country: string | null;
  note: string | null;
  groupId: string | null;
  mediaType: string;
  direction: number | null;
  capturedAt: string;
};

/** Un point sur la carte : soit un media isole, soit un lot de photos/videos
 * prises/importees ensemble (meme groupId), fusionnees en un seul marqueur. */
type MapPoint = {
  key: string;
  latitude: number;
  longitude: number;
  coverUrl: string;
  isVideo: boolean;
  direction: number | null;
  members: MapPhoto[];
};

type DivIconWithMeta = L.DivIcon & { options: L.DivIconOptions & { thumbUrl?: string; photoCount?: number } };

function buildMapPoints(photos: MapPhoto[]): MapPoint[] {
  const groups = new Map<string, MapPhoto[]>();
  const points: MapPoint[] = [];

  for (const photo of photos) {
    if (!photo.groupId) {
      points.push({
        key: photo.id,
        latitude: photo.latitude,
        longitude: photo.longitude,
        coverUrl: `/api/files/${photo.stampedPath}`,
        isVideo: photo.mediaType === "video",
        direction: photo.direction,
        members: [photo],
      });
      continue;
    }
    const arr = groups.get(photo.groupId) ?? [];
    arr.push(photo);
    groups.set(photo.groupId, arr);
  }

  for (const members of groups.values()) {
    const sorted = [...members].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    );
    const latitude = members.reduce((sum, m) => sum + m.latitude, 0) / members.length;
    const longitude = members.reduce((sum, m) => sum + m.longitude, 0) / members.length;
    points.push({
      key: sorted[0].groupId as string,
      latitude,
      longitude,
      coverUrl: `/api/files/${sorted[0].stampedPath}`,
      isVideo: sorted[0].mediaType === "video",
      // Une direction n'est affichee que pour un media isole : un lot peut
      // regrouper des prises de vue orientees differemment.
      direction: members.length === 1 ? members[0].direction : null,
      members: sorted,
    });
  }

  return points;
}

const VIDEO_PLACEHOLDER_SVG = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#1e293b"/>
    <circle cx="32" cy="32" r="14" fill="#ffffff" fill-opacity="0.9"/>
    <path d="M27 24 L41 32 L27 40 Z" fill="#1e293b"/>
  </svg>
`.trim());

function photoIcon(url: string, count: number, isVideo: boolean, direction: number | null, selected = false): DivIconWithMeta {
  const badge =
    count > 1
      ? `<div style="position:absolute;left:6px;bottom:3px;color:#ffffff;font-weight:700;font-size:15px;font-family:system-ui,sans-serif;text-shadow:0 1px 4px rgba(0,0,0,0.95);">${count}</div>`
      : "";
  const checkBadge = selected
    ? `<div style="position:absolute;right:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#f39815;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:11px;font-weight:700;">&#10003;</div>`
    : "";
  const playBadge =
    isVideo && count === 1
      ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
          <div style="width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;">
            <div style="width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid #ffffff;margin-left:2px;"></div>
          </div>
        </div>`
      : "";
  const size = count > 1 ? 64 : 56;
  const border = selected ? "3px solid #f39815" : "2.5px solid #ffffff";
  // La fleche part du bord du marqueur et pointe dans la direction de prise
  // de vue (0deg = Nord = vers le haut, sens horaire, comme un cap boussole).
  const arrow =
    direction !== null
      ? `<div style="position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-100%) rotate(${direction}deg);transform-origin:50% 100%;">
          <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:22px solid #006f9c;margin-top:-${size / 2 + 20}px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6));"></div>
        </div>`
      : "";
  const icon = L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${arrow}
        <div style="position:absolute;inset:0;border-radius:14px;overflow:hidden;border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.45);">
          <img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;" />
          ${playBadge}
          ${badge}
          ${checkBadge}
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  }) as DivIconWithMeta;
  icon.options.thumbUrl = url;
  icon.options.photoCount = count;
  return icon;
}

function clusterIcon(url: string, count: number) {
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:64px;height:64px;border-radius:14px;overflow:hidden;border:2.5px solid #ffffff;box-shadow:0 2px 10px rgba(0,0,0,0.5);">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;" />
        <div style="position:absolute;left:6px;bottom:3px;color:#ffffff;font-weight:700;font-size:15px;font-family:system-ui,sans-serif;text-shadow:0 1px 4px rgba(0,0,0,0.95);">${count}</div>
      </div>
    `,
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  });
}

function toLightboxPhotos(members: MapPhoto[]): LightboxPhoto[] {
  return members.map((m) => ({
    id: m.id,
    projectName: m.projectName,
    stampedPath: m.stampedPath,
    address: m.address,
    note: m.note,
    capturedAt: m.capturedAt,
    latitude: m.latitude,
    longitude: m.longitude,
    mediaType: m.mediaType,
    direction: m.direction,
  }));
}

/** Repere "ma position" (suivi GPS temps reel) : point bleu pulsant, avec un
 * petit cap directionnel si le navigateur fournit un heading (deplacement). */
function userLocationIcon(heading: number | null) {
  const arrow =
    heading !== null
      ? `<div style="position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-100%) rotate(${heading}deg);transform-origin:50% 100%;">
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:15px solid #006f9c;margin-top:-29px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));"></div>
        </div>`
      : "";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:26px;height:26px;">
        ${arrow}
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,111,156,0.35);animation:lakymaps-pulse 1.6s ease-out infinite;"></div>
        <div style="position:absolute;top:6px;left:6px;width:14px;height:14px;border-radius:50%;background:#006f9c;border:3px solid #ffffff;box-shadow:0 1px 6px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const repositionIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:48px;height:48px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(239,68,68,0.35);animation:lakymaps-pulse 1.4s ease-out infinite;"></div>
      <div style="position:absolute;top:10px;left:10px;width:28px;height:28px;border-radius:50%;background:#ef4444;border:3px solid #ffffff;box-shadow:0 2px 10px rgba(0,0,0,0.6);cursor:grab;"></div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

/** Centre la carte sur le marqueur au moment ou le mode repositionnement demarre. */
function RepositionMarker({
  position,
  onDrag,
}: {
  position: [number, number];
  onDrag: (pos: [number, number]) => void;
}) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(position, Math.max(map.getZoom(), 18), { duration: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Marker
      position={position}
      icon={repositionIcon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const latLng = e.target.getLatLng();
          onDrag([latLng.lat, latLng.lng]);
        },
      }}
    />
  );
}

type FlyTarget =
  | { kind: "point"; center: [number, number]; zoom: number }
  | { kind: "bounds"; bounds: [[number, number], [number, number]] };

/** Deplace la carte vers un resultat de recherche (point isole ou groupe de photos). */
function MapController({ target }: { target: FlyTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    if (target.kind === "bounds") {
      map.flyToBounds(target.bounds, { padding: [60, 60], maxZoom: 17, duration: 0.6 });
    } else {
      map.flyTo(target.center, target.zoom, { duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return null;
}

const IGN_WMTS_BASE = "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile";

export function PhotoMapClient({ initialProjectId }: { initialProjectId?: string }) {
  const [photos, setPhotos] = useState<MapPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId ?? "");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [lightboxPoint, setLightboxPoint] = useState<MapPoint | null>(null);
  const [reposition, setReposition] = useState<{
    photoId: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [savingPosition, setSavingPosition] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [userPosition, setUserPosition] = useState<{
    latitude: number;
    longitude: number;
    heading: number | null;
  } | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredRef = useRef(false);

  function stopTracking() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setTracking(false);
    setUserPosition(null);
  }

  function toggleTracking() {
    if (tracking) {
      stopTracking();
      return;
    }
    if (!("geolocation" in navigator)) {
      setTrackError("Geolocation is not available on this device.");
      return;
    }
    setTrackError(null);
    hasCenteredRef.current = false;
    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        const cleanHeading = typeof heading === "number" && Number.isFinite(heading) ? heading : null;
        setUserPosition({ latitude, longitude, heading: cleanHeading });
        setTrackError(null);
        if (!hasCenteredRef.current) {
          setFlyTarget({ kind: "point", center: [latitude, longitude], zoom: 17 });
          hasCenteredRef.current = true;
        }
      },
      (err) => {
        // Permission refusee : plus aucune position ne viendra, on arrete.
        // Sinon (signal GPS temporairement indisponible, timeout...) : le
        // navigateur continue d'essayer tout seul, on garde le suivi actif.
        if (err.code === err.PERMISSION_DENIED) {
          setTrackError("Location permission denied.");
          stopTracking();
        } else {
          setTrackError("Waiting for a GPS signal...");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPhotos = () => {
    fetch("/api/photos/map")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data) => setPhotos(data.photos))
      .catch(() => setError("Could not load geotagged media."));
  };

  useEffect(loadPhotos, []);

  async function saveRepositionedPhoto() {
    if (!reposition) return;
    setSavingPosition(true);
    setPositionError(null);
    try {
      const res = await fetch(`/api/photos/${reposition.photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: { latitude: reposition.latitude, longitude: reposition.longitude },
        }),
      });
      if (!res.ok) throw new Error("update failed");
      setReposition(null);
      loadPhotos();
    } catch {
      setPositionError("Could not save the new position.");
    } finally {
      setSavingPosition(false);
    }
  }

  /** Bascule la selection d'un point (media isole ou lot) en un seul geste. */
  function toggleSelection(point: MapPoint) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = point.members.every((m) => prev.has(m.id));
      for (const m of point.members) {
        if (allSelected) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });
  }

  /** Recherche independante des filtres : cherche parmi TOUS les medias
   * (pas seulement ceux actuellement affiches), centre la carte sur le
   * resultat et ouvre la visionneuse pour montrer les medias correspondants. */
  function locateProject(projectId: string) {
    if (!photos) return;
    const matches = photos.filter((p) => p.projectId === projectId);
    if (matches.length === 0) return;
    focusMatches(matches);
  }

  function locateAddress(latitude: number, longitude: number) {
    if (!photos) return;
    const nearby = photos
      .filter((p) => haversineDistanceMeters({ latitude, longitude }, p) <= 300)
      .sort(
        (a, b) =>
          haversineDistanceMeters({ latitude, longitude }, a) -
          haversineDistanceMeters({ latitude, longitude }, b),
      );

    if (nearby.length === 0) {
      setFlyTarget({ kind: "point", center: [latitude, longitude], zoom: 16 });
      return;
    }
    focusMatches(nearby);
  }

  function focusMatches(matches: MapPhoto[]) {
    if (matches.length === 1) {
      const [only] = matches;
      setFlyTarget({ kind: "point", center: [only.latitude, only.longitude], zoom: 17 });
    } else {
      const lats = matches.map((m) => m.latitude);
      const lngs = matches.map((m) => m.longitude);
      setFlyTarget({
        kind: "bounds",
        bounds: [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
      });
    }
    setLightboxPoint({
      key: "search-result",
      latitude: matches[0].latitude,
      longitude: matches[0].longitude,
      coverUrl: `/api/files/${matches[0].stampedPath}`,
      isVideo: matches[0].mediaType === "video",
      direction: matches.length === 1 ? matches[0].direction : null,
      members: matches,
    });
  }

  async function runBulkPatch(body: Record<string, unknown>) {
    setBulkBusy(true);
    setBulkError(null);
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/photos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("bulk update failed");
      }
      setSelectedIds(new Set());
      loadPhotos();
    } catch {
      setBulkError("Some updates could not be applied.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkDelete() {
    setBulkBusy(true);
    setBulkError(null);
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("bulk delete failed");
      }
      setSelectedIds(new Set());
      loadPhotos();
    } catch {
      setBulkError("Some items could not be deleted.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteFromLightbox(photoId: string) {
    const res = await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
    if (res.ok) {
      setLightboxPoint(null);
      loadPhotos();
    }
    return res.ok;
  }

  const projectOptions = useMemo(() => {
    if (!photos) return [];
    const map = new Map<string, string>();
    for (const p of photos) map.set(p.projectId, p.projectName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [photos]);

  const countryOptions = useMemo(() => {
    if (!photos) return [];
    const set = new Set<string>();
    for (const p of photos) if (p.country) set.add(p.country);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    if (!photos) return [];
    return photos.filter(
      (p) =>
        (!projectFilter || p.projectId === projectFilter) &&
        (!countryFilter || p.country === countryFilter),
    );
  }, [photos, projectFilter, countryFilter]);

  // Masque le media en cours de repositionnement parmi les marqueurs normaux :
  // sinon son repere de deplacement (plus petit) se retrouve cache derriere
  // sa propre vignette, au meme endroit.
  const mapPoints = useMemo(() => {
    const visible = reposition ? filteredPhotos.filter((p) => p.id !== reposition.photoId) : filteredPhotos;
    return buildMapPoints(visible);
  }, [filteredPhotos, reposition]);

  const hasFilter = Boolean(projectFilter || countryFilter);

  if (error) {
    return <p className="p-6 text-sm text-red-600">{error}</p>;
  }

  if (!photos) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const hasNoMedia = photos.length === 0;
  // Vue par defaut (Paris) tant qu'aucun media geolocalise n'existe : la
  // carte reste utilisable (recherche d'adresse, localisation en temps reel)
  // meme sans photo.
  const center: [number, number] = [
    mapPoints[0]?.latitude ?? photos[0]?.latitude ?? 48.8566,
    mapPoints[0]?.longitude ?? photos[0]?.longitude ?? 2.3522,
  ];

  return (
    <div className="relative h-full min-h-[70vh] w-full">
      {hasNoMedia && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-[1000] flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-lg bg-white/95 px-4 py-2 text-center text-sm text-slate-500 shadow-md backdrop-blur">
            <MapPin className="h-4 w-4 shrink-0 text-slate-300" />
            No geotagged media yet. Take or import photos/videos from a project to see them appear here.
          </div>
        </div>
      )}

      <div className="absolute left-3 top-3 z-[1000] flex flex-wrap items-start gap-3">
        <MapSearchBar
          projects={projectOptions}
          onSelectProject={locateProject}
          onSelectLocation={locateAddress}
        />

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/95 p-2 shadow-md backdrop-blur">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All projects</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All countries</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {hasFilter && (
            <button
              onClick={() => {
                setProjectFilter("");
                setCountryFilter("");
              }}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </button>
          )}

          <span className="px-1 text-sm text-slate-500">
            {filteredPhotos.length} item{filteredPhotos.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <MapContainer center={center} zoom={6} scrollWheelZoom zoomControl={false} className="h-full w-full">
        <ZoomControl position="bottomright" />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Map (OpenStreetMap)">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay name="Cadastre (France)">
            <TileLayer
              attribution="Cadastre &copy; IGN / DGFiP"
              url={`${IGN_WMTS_BASE}&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`}
              minZoom={14}
              maxZoom={19}
              tileSize={256}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Administrative Boundaries (France)">
            <TileLayer
              attribution="Boundaries &copy; IGN"
              url={`${IGN_WMTS_BASE}&LAYER=LIMITES_ADMINISTRATIVES_EXPRESS.LATEST&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`}
              minZoom={6}
              maxZoom={16}
              tileSize={256}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Cadastre (Italy)">
            <TileLayer
              attribution="Catasto &copy; Agenzia delle Entrate"
              url="/api/tiles/it-cadastre/{z}/{x}/{y}"
              minZoom={15}
              maxZoom={19}
              tileSize={256}
            />
          </LayersControl.Overlay>
        </LayersControl>

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={(cluster: {
            getAllChildMarkers: () => Array<{ options: { icon?: DivIconWithMeta } }>;
          }) => {
            const markers = cluster.getAllChildMarkers();
            const totalCount = markers.reduce(
              (sum, m) => sum + (m.options.icon?.options?.photoCount ?? 1),
              0,
            );
            const firstUrl = markers[0]?.options.icon?.options?.thumbUrl ?? "";
            return clusterIcon(firstUrl, totalCount);
          }}
        >
          {mapPoints.map((point) => {
            const selected = point.members.every((m) => selectedIds.has(m.id));
            const coverUrl = point.isVideo && point.members.length === 1
              ? `data:image/svg+xml,${VIDEO_PLACEHOLDER_SVG}`
              : point.coverUrl;
            return (
              <Marker
                key={point.key}
                position={[point.latitude, point.longitude]}
                icon={photoIcon(coverUrl, point.members.length, point.isVideo, point.direction, selected)}
                eventHandlers={{
                  click: (e) => {
                    const native = e.originalEvent as MouseEvent | undefined;
                    if (native?.ctrlKey || native?.metaKey) {
                      toggleSelection(point);
                    } else {
                      setLightboxPoint(point);
                    }
                  },
                }}
              />
            );
          })}
        </MarkerClusterGroup>

        {reposition && (
          <RepositionMarker
            position={[reposition.latitude, reposition.longitude]}
            onDrag={([latitude, longitude]) =>
              setReposition((prev) => (prev ? { ...prev, latitude, longitude } : prev))
            }
          />
        )}

        {tracking && userPosition && (
          <Marker
            position={[userPosition.latitude, userPosition.longitude]}
            icon={userLocationIcon(userPosition.heading)}
            interactive={false}
            zIndexOffset={1000}
          />
        )}

        <MapController target={flyTarget} />
      </MapContainer>

      <button
        type="button"
        onClick={toggleTracking}
        title={tracking ? "Stop tracking my location" : "Show my location"}
        aria-label={tracking ? "Stop tracking my location" : "Show my location"}
        className={`absolute bottom-24 right-3 z-[1000] flex h-10 w-10 items-center justify-center rounded-full shadow-md transition ${
          tracking
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <LocateFixed className="h-5 w-5" />
      </button>

      {trackError && (
        <div className="absolute bottom-24 right-16 z-[1000] max-w-[220px] rounded-md bg-red-600 px-3 py-2 text-xs text-white shadow-md">
          {trackError}
        </div>
      )}

      {reposition && (
        <div className="absolute inset-x-0 bottom-4 z-[1000] mx-auto flex w-fit max-w-[92%] flex-col items-center gap-2 rounded-lg bg-white/95 p-3 text-center shadow-md backdrop-blur">
          <p className="text-sm text-slate-600">Drag the red pin to the exact position.</p>
          {positionError && <p className="text-sm text-red-600">{positionError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setReposition(null);
                setPositionError(null);
              }}
              disabled={savingPosition}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              onClick={saveRepositionedPhoto}
              disabled={savingPosition}
              className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {savingPosition ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save position
            </button>
          </div>
        </div>
      )}

      {!reposition && selectedIds.size > 0 && (
        <BulkEditBar
          count={selectedIds.size}
          busy={bulkBusy}
          error={bulkError}
          onClear={() => setSelectedIds(new Set())}
          onApplyProject={(id) => runBulkPatch({ projectId: id })}
          onApplyAddress={(address) => runBulkPatch({ address: address || null })}
          onApplyNote={(note) => runBulkPatch({ note: note || null })}
          onDelete={runBulkDelete}
        />
      )}

      {lightboxPoint && (
        <PhotoLightbox
          photos={toLightboxPhotos(lightboxPoint.members)}
          onClose={() => setLightboxPoint(null)}
          onEditPosition={(photo) => {
            setLightboxPoint(null);
            setReposition({ photoId: photo.id, latitude: photo.latitude, longitude: photo.longitude });
          }}
          onDelete={deleteFromLightbox}
        />
      )}
    </div>
  );
}
