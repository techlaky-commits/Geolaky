"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { LayersControl, MapContainer, Marker, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Loader2, MapPin, X } from "lucide-react";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";

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
  capturedAt: string;
};

/** Un point sur la carte : soit une photo isolee, soit un lot de photos
 * prises/importees ensemble (meme groupId), fusionnees en un seul marqueur. */
type MapPoint = {
  key: string;
  latitude: number;
  longitude: number;
  coverUrl: string;
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
      members: sorted,
    });
  }

  return points;
}

function photoIcon(url: string, count: number): DivIconWithMeta {
  const badge =
    count > 1
      ? `<div style="position:absolute;left:6px;bottom:3px;color:#ffffff;font-weight:700;font-size:15px;font-family:system-ui,sans-serif;text-shadow:0 1px 4px rgba(0,0,0,0.95);">${count}</div>`
      : "";
  const size = count > 1 ? 64 : 56;
  const icon = L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:14px;overflow:hidden;border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.45);">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;" />
        ${badge}
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
  }));
}

const IGN_WMTS_BASE = "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile";

export function PhotoMapClient({ initialProjectId }: { initialProjectId?: string }) {
  const [photos, setPhotos] = useState<MapPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId ?? "");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [lightboxPoint, setLightboxPoint] = useState<MapPoint | null>(null);

  useEffect(() => {
    fetch("/api/photos/map")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data) => setPhotos(data.photos))
      .catch(() => setError("Impossible de charger les photos geolocalisees."));
  }, []);

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

  const mapPoints = useMemo(() => buildMapPoints(filteredPhotos), [filteredPhotos]);

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

  if (photos.length === 0) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-2 text-center text-slate-500">
        <MapPin className="h-10 w-10 text-slate-300" />
        Aucune photo geolocalisee pour l&apos;instant. Prenez des photos depuis un projet pour
        les voir apparaitre ici.
      </div>
    );
  }

  const center: [number, number] = [
    mapPoints[0]?.latitude ?? photos[0].latitude,
    mapPoints[0]?.longitude ?? photos[0].longitude,
  ];

  return (
    <div className="relative h-full min-h-[70vh] w-full">
      <div className="absolute left-3 top-3 z-[1000] flex flex-wrap items-center gap-2 rounded-lg bg-white/95 p-2 shadow-md backdrop-blur">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Tous les projets</option>
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
          <option value="">Tous les pays</option>
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
            Reinitialiser
          </button>
        )}

        <span className="px-1 text-sm text-slate-500">
          {filteredPhotos.length} photo{filteredPhotos.length > 1 ? "s" : ""}
        </span>
      </div>

      <MapContainer center={center} zoom={6} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        <LayersControl position="topright">
          <LayersControl.Overlay name="Cadastre (France)">
            <TileLayer
              attribution="Cadastre &copy; IGN / DGFiP"
              url={`${IGN_WMTS_BASE}&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`}
              minZoom={14}
              maxZoom={19}
              tileSize={256}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Limites administratives (France)">
            <TileLayer
              attribution="Limites administratives &copy; IGN"
              url={`${IGN_WMTS_BASE}&LAYER=LIMITES_ADMINISTRATIVES_EXPRESS.LATEST&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`}
              minZoom={6}
              maxZoom={16}
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
          {mapPoints.map((point) => (
            <Marker
              key={point.key}
              position={[point.latitude, point.longitude]}
              icon={photoIcon(point.coverUrl, point.members.length)}
              eventHandlers={{ click: () => setLightboxPoint(point) }}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {lightboxPoint && (
        <PhotoLightbox
          photos={toLightboxPhotos(lightboxPoint.members)}
          onClose={() => setLightboxPoint(null)}
        />
      )}
    </div>
  );
}
