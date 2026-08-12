import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Le WMS cadastral italien (Agenzia delle Entrate) ne supporte pas la
 * projection Web Mercator (EPSG:3857) utilisee par les tuiles Leaflet/OSM,
 * seulement EPSG:6706 (coordonnees geographiques, ~ equivalent WGS84).
 * Cette route convertit chaque tuile Web Mercator {z}/{x}/{y} en boite
 * lat/lon, interroge le WMS avec cette boite, et relaie l'image obtenue
 * comme une tuile XYZ classique - transparent pour Leaflet cote client.
 */
const WMS_BASE = "https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php";
const TILE_SIZE = 256;

function tileToLon(x: number, z: number) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tileToLat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export async function GET(
  _request: Request,
  { params }: { params: { z: string; x: string; y: string } },
) {
  const z = Number(params.z);
  const x = Number(params.x);
  const y = Number(params.y);

  const maxTile = Math.pow(2, z);
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 22 || x < 0 || y < 0 || x >= maxTile || y >= maxTile) {
    return NextResponse.json({ error: "Coordonnees de tuile invalides" }, { status: 400 });
  }

  const north = tileToLat(y, z);
  const south = tileToLat(y + 1, z);
  const west = tileToLon(x, z);
  const east = tileToLon(x + 1, z);

  // WMS 1.3.0 + CRS geographique : ordre lat,lon (et non lon,lat comme en 1.1.1)
  const bbox = `${south},${west},${north},${east}`;

  const url = new URL(WMS_BASE);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.3.0");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("LAYERS", "CP.CadastralParcel");
  url.searchParams.set("STYLES", "");
  url.searchParams.set("CRS", "EPSG:6706");
  url.searchParams.set("BBOX", bbox);
  url.searchParams.set("WIDTH", String(TILE_SIZE));
  url.searchParams.set("HEIGHT", String(TILE_SIZE));
  url.searchParams.set("FORMAT", "image/png");
  url.searchParams.set("TRANSPARENT", "true");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok || !res.headers.get("content-type")?.includes("image")) {
      return new NextResponse(null, { status: 204 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
