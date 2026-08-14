import shpwrite from "@mapbox/shp-write";

export type ShapefilePhoto = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  direction: number | null;
  mediaType: string;
  address: string | null;
  note: string | null;
  capturedAt: Date;
};

const METERS_PER_DEG_LAT = 111320;
// Meme geometrie que le secteur affiche sur la carte web (voir
// buildDirectionCone dans PhotoMapClient.tsx) : ~56 degres d'ouverture,
// suffisant pour rester lisible sans presenter une precision superieure a
// celle d'un cap boussole.
const CONE_RADIUS_METERS = 15;
const CONE_HALF_ANGLE_DEG = 28;
const DOT_RADIUS_METERS = 3;

function offsetPoint(latitude: number, longitude: number, bearingDeg: number, distanceMeters: number): [number, number] {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const dx = distanceMeters * Math.sin(bearingRad); // deplacement vers l'est, en metres
  const dy = distanceMeters * Math.cos(bearingRad); // deplacement vers le nord, en metres
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180);
  const lon = longitude + dx / metersPerDegLon;
  const lat = latitude + dy / METERS_PER_DEG_LAT;
  return [lon, lat];
}

/** Secteur/faisceau (meme forme que le marqueur carte) pour un media dont la
 * direction de prise de vue est connue. */
function buildConeRing(latitude: number, longitude: number, direction: number): [number, number][] {
  const steps = 8;
  const ring: [number, number][] = [[longitude, latitude]];
  for (let i = 0; i <= steps; i++) {
    const bearing = direction - CONE_HALF_ANGLE_DEG + (2 * CONE_HALF_ANGLE_DEG * i) / steps;
    ring.push(offsetPoint(latitude, longitude, bearing, CONE_RADIUS_METERS));
  }
  ring.push([longitude, latitude]);
  return ring;
}

/** Petit polygone circulaire (sans direction connue) - garde le meme type de
 * geometrie (polygone) que les medias orientes, requis par le format
 * Shapefile qui n'autorise qu'un seul type de geometrie par fichier. */
function buildDotRing(latitude: number, longitude: number): [number, number][] {
  const steps = 10;
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    ring.push(offsetPoint(latitude, longitude, (360 * i) / steps, DOT_RADIUS_METERS));
  }
  ring.push(ring[0]);
  return ring;
}

/** Construit un Shapefile (zippe : .shp/.shx/.dbf/.prj) representant les
 * medias geolocalises d'un projet, chacun sous forme de polygone (secteur
 * oriente si une direction de prise de vue est connue, sinon un petit
 * cercle), exploitable directement dans QGIS. Renvoie null si aucun media du
 * projet n'a de position GPS. */
export async function buildProjectShapefile(
  projectName: string,
  photos: ShapefilePhoto[],
): Promise<Buffer | null> {
  const geolocated = photos.filter(
    (p): p is ShapefilePhoto & { latitude: number; longitude: number } =>
      p.latitude !== null && p.longitude !== null,
  );
  if (geolocated.length === 0) return null;

  const features = geolocated.map((p) => ({
    type: "Feature" as const,
    properties: {
      photo_id: p.id,
      project: projectName.slice(0, 254),
      address: (p.address ?? "").slice(0, 254),
      note: (p.note ?? "").slice(0, 254),
      mediatype: p.mediaType,
      direction: p.direction ?? -1,
      captured: p.capturedAt.toISOString().slice(0, 10),
      lat: p.latitude,
      lng: p.longitude,
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [p.direction !== null ? buildConeRing(p.latitude, p.longitude, p.direction) : buildDotRing(p.latitude, p.longitude)],
    },
  }));

  const geojson = { type: "FeatureCollection" as const, features };
  const base64 = await shpwrite.zip<"base64">(geojson, {
    outputType: "base64",
    compression: "DEFLATE",
    types: { polygon: "photos" },
  });
  return Buffer.from(base64, "base64");
}
