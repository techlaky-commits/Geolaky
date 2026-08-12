"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Loader2, MapPin, X } from "lucide-react";

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
  capturedAt: string;
};

function photoIcon(url: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="width:56px;height:56px;border-radius:12px;overflow:hidden;border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.45);">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;" />
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
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

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export function PhotoMapClient({ initialProjectId }: { initialProjectId?: string }) {
  const [photos, setPhotos] = useState<MapPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId ?? "");
  const [countryFilter, setCountryFilter] = useState<string>("");

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

  const center: [number, number] = [filteredPhotos[0]?.latitude ?? photos[0].latitude, filteredPhotos[0]?.longitude ?? photos[0].longitude];

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
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={(cluster: { getChildCount: () => number; getAllChildMarkers: () => Array<{ options: { icon?: { options?: { thumbUrl?: string } } } }> }) => {
            const markers = cluster.getAllChildMarkers();
            const firstUrl = markers[0]?.options.icon?.options?.thumbUrl ?? "";
            return clusterIcon(firstUrl, cluster.getChildCount());
          }}
        >
          {filteredPhotos.map((photo) => {
            const url = `/api/files/${photo.stampedPath}`;
            const icon = photoIcon(url);
            // @ts-expect-error - on stocke l'url de vignette pour la reutiliser dans l'icone de cluster
            icon.options.thumbUrl = url;
            return (
              <Marker key={photo.id} position={[photo.latitude, photo.longitude]} icon={icon}>
                <Popup minWidth={220}>
                  <div className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="mb-2 w-full rounded-md" />
                    <p className="text-xs font-semibold text-slate-700">{photo.projectName}</p>
                    {photo.address && <p className="text-xs text-slate-500">{photo.address}</p>}
                    <p className="text-xs text-slate-500">{formatDateTime(photo.capturedAt)}</p>
                    {photo.note && <p className="text-xs italic text-slate-500">{photo.note}</p>}
                    <Link
                      href={`/photos/${photo.id}`}
                      className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline"
                    >
                      Ouvrir la photo &rarr;
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
