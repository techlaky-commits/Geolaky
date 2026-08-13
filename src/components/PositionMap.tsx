"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import L from "leaflet";
import { LayersControl, MapContainer, Marker, TileLayer, ZoomControl, useMap } from "react-leaflet";

const pinIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:44px;height:44px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(239,68,68,0.35);animation:lakymaps-pulse 1.4s ease-out infinite;"></div>
      <div style="position:absolute;top:8px;left:8px;width:28px;height:28px;border-radius:50%;background:#ef4444;border:3px solid #ffffff;box-shadow:0 2px 10px rgba(0,0,0,0.6);cursor:grab;"></div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const IGN_WMTS_BASE = "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile";

function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], Math.max(map.getZoom(), 18));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function PositionMap({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
}) {
  return (
    <div className="h-64 w-full overflow-hidden rounded-lg border border-slate-200">
      <MapContainer
        center={[latitude, longitude]}
        zoom={18}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
      >
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

        <Recenter latitude={latitude} longitude={longitude} />

        <Marker
          position={[latitude, longitude]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const latLng = e.target.getLatLng();
              onChange(latLng.lat, latLng.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
