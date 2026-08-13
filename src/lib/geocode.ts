export type GeocodeResult = {
  address: string;
  country: string | null;
};

export type ForwardGeocodeMatch = {
  label: string;
  latitude: number;
  longitude: number;
};

/**
 * Geocodage inverse via Nominatim (OpenStreetMap), gratuit mais soumis a une
 * politique d'usage stricte (User-Agent obligatoire, ~1 req/s). Suffisant pour
 * du MVP a faible volume ; pour de la prod a plus fort trafic, remplacer par
 * un fournisseur paye (Google/Mapbox) ou une instance Nominatim auto-hebergee.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodeResult | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "18");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: {
        "User-Agent": process.env.NOMINATIM_USER_AGENT || "LakyMaps/0.1",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[geocode] Nominatim a repondu ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      display_name?: string;
      address?: { country?: string };
    };
    if (!data.display_name) return null;

    return { address: data.display_name, country: data.address?.country ?? null };
  } catch (err) {
    // Pas bloquant : la photo reste utilisable sans adresse resolue.
    console.warn("[geocode] echec du geocodage inverse:", err);
    return null;
  }
}

/** Geocodage direct (adresse -> coordonnees), pour la recherche sur la carte. */
export async function forwardGeocode(query: string): Promise<ForwardGeocodeMatch[]> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "5");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: {
        "User-Agent": process.env.NOMINATIM_USER_AGENT || "LakyMaps/0.1",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[geocode] Nominatim (search) a repondu ${res.status}`);
      return [];
    }
    const data = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;

    return data
      .filter((d) => d.display_name && d.lat && d.lon)
      .map((d) => ({
        label: d.display_name as string,
        latitude: Number(d.lat),
        longitude: Number(d.lon),
      }));
  } catch (err) {
    console.warn("[geocode] echec du geocodage direct:", err);
    return [];
  }
}
