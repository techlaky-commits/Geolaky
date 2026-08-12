/**
 * Geocodage inverse via Nominatim (OpenStreetMap), gratuit mais soumis a une
 * politique d'usage stricte (User-Agent obligatoire, ~1 req/s). Suffisant pour
 * du MVP a faible volume ; pour de la prod a plus fort trafic, remplacer par
 * un fournisseur paye (Google/Mapbox) ou une instance Nominatim auto-hebergee.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
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
        "User-Agent": process.env.NOMINATIM_USER_AGENT || "Geolaky/0.1",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[geocode] Nominatim a repondu ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch (err) {
    // Pas bloquant : la photo reste utilisable sans adresse resolue.
    console.warn("[geocode] echec du geocodage inverse:", err);
    return null;
  }
}
