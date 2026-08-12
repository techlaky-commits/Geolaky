import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnedPhoto } from "@/lib/authz";
import { overwriteProjectFile } from "@/lib/storage";
import { normalizeImage, renderStampedImage } from "@/lib/stamp";

export const runtime = "nodejs";

/** Remplace l'image d'une photo existante (meme localisation/note/projet),
 * en reinitialisant le recadrage puisqu'il ne s'appliquerait plus au nouveau
 * fichier. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const photo = await getOwnedPhoto(user.id, params.id);
  if (!photo) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Requete multipart invalide" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier image manquant" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Le fichier doit etre une image" }, { status: 400 });
  }

  const originalBuffer = await normalizeImage(Buffer.from(await file.arrayBuffer()));

  const stampedBuffer = await renderStampedImage(originalBuffer, {
    title: photo.project.name,
    address: photo.address,
    latitude: photo.latitude,
    longitude: photo.longitude,
    accuracy: photo.accuracy,
    capturedAt: photo.capturedAt,
    note: photo.note,
  });

  // Ecrase les fichiers en place (memes chemins) : les URLs deja affichees
  // cote client (photo.originalPath/stampedPath) restent valides sans
  // attendre un rechargement complet de la page.
  await overwriteProjectFile(photo.originalPath, originalBuffer);
  await overwriteProjectFile(photo.stampedPath, stampedBuffer);

  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: { cropData: null },
  });

  return NextResponse.json({ photo: updated });
}
