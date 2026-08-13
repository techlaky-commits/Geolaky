export type LatLng = { latitude: number; longitude: number };

const COMPASS_LABELS = [
  "Nord",
  "Nord-Est",
  "Est",
  "Sud-Est",
  "Sud",
  "Sud-Ouest",
  "Ouest",
  "Nord-Ouest",
];

/** Convertit un cap en degres (0-360, 0 = Nord, sens horaire) en libelle cardinal (8 directions). */
export function compassLabel(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return COMPASS_LABELS[index];
}

/** Parse un texte de coordonnees GPS collees, ex: "48.858370, 2.294481". */
export function parseCoordsInput(input: string): LatLng | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/** Distance approximative en metres entre deux points (formule de haversine). */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
