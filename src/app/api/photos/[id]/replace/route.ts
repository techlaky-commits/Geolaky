import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnedPhoto } from "@/lib/authz";
import { overwriteProjectFile } from "@/lib/storage";
import { reverseGeocode } from "@/lib/geocode";
import { embedGpsDirection, normalizeImage, renderStampedImage } from "@/lib/stamp";
import { compressVideo, getVideoDurationSeconds, getVideoLocationMetadata } from "@/lib/video";

export const runtime = "nodejs";

/** Remplace le fichier d'une photo ou video existante (meme localisation/
 * note/projet), en reinitialisant le recadrage puisqu'il ne s'appliquerait
 * plus au nouveau fichier. Le type de media doit correspondre a l'existant. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const photo = await getOwnedPhoto(user.id, params.id);
  if (!photo) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Requete multipart invalide" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const isVideo = photo.mediaType === "video";
  if (isVideo && !file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Cette entree est une video : le remplacement attend une video" }, { status: 400 });
  }
  if (!isVideo && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Cette entree est une photo : le remplacement attend une image" }, { status: 400 });
  }

  let durationSeconds = photo.durationSeconds;
  let latitude = photo.latitude;
  let longitude = photo.longitude;
  let direction = photo.direction;
  let address = photo.address;
  let country = photo.country;

  if (isVideo) {
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const [duration, embeddedLocation, compressed] = await Promise.all([
      getVideoDurationSeconds(rawBuffer),
      getVideoLocationMetadata(rawBuffer),
      compressVideo(rawBuffer),
    ]);
    durationSeconds = duration;
    // La position/le cap existants (definis manuellement ou lors de l'envoi
    // initial) priment ; les metadonnees de la nouvelle video ne comblent
    // que ce qui manque encore.
    if (latitude === null && longitude === null && embeddedLocation) {
      latitude = embeddedLocation.latitude;
      longitude = embeddedLocation.longitude;
      const geocoded = await reverseGeocode(latitude, longitude);
      address = geocoded?.address ?? null;
      country = geocoded?.country ?? null;
    }
    if (direction === null && embeddedLocation?.direction != null) {
      direction = embeddedLocation.direction;
    }
    await overwriteProjectFile(photo.originalPath, compressed);
    // stampedPath pointe vers le meme fichier pour une video (voir route d'upload).
  } else {
    let originalBuffer = await normalizeImage(Buffer.from(await file.arrayBuffer()));
    let stampedBuffer = await renderStampedImage(originalBuffer, {
      title: photo.project.name,
      address: photo.address,
      latitude: photo.latitude,
      longitude: photo.longitude,
      accuracy: photo.accuracy,
      capturedAt: photo.capturedAt,
      note: photo.note,
    });
    if (direction !== null) {
      originalBuffer = embedGpsDirection(originalBuffer, direction);
      stampedBuffer = embedGpsDirection(stampedBuffer, direction);
    }

    // Ecrase les fichiers en place (memes chemins) : les URLs deja affichees
    // cote client (photo.originalPath/stampedPath) restent valides sans
    // attendre un rechargement complet de la page.
    await overwriteProjectFile(photo.originalPath, originalBuffer);
    await overwriteProjectFile(photo.stampedPath, stampedBuffer);
  }

  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: { cropData: null, durationSeconds, latitude, longitude, direction, address, country },
  });

  return NextResponse.json({ photo: updated });
}
