import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { overwriteProjectFile, readProjectFile } from "@/lib/storage";
import { normalizeImage, renderStampedImage } from "@/lib/stamp";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Recompresse retroactivement toutes les photos existantes de l'utilisateur
 * (redimensionnement + qualite JPEG reduite), pour les photos uploadees
 * avant la mise en place de la compression automatique a l'envoi.
 * Reinitialise le recadrage de chaque photo, puisque ses coordonnees en
 * pixels ne correspondraient plus a l'image une fois redimensionnee.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const photos = await prisma.photo.findMany({
    where: { project: { ownerId: user.id } },
    include: { project: true },
  });

  let processed = 0;
  const errors: string[] = [];

  for (const photo of photos) {
    try {
      const originalBuffer = await readProjectFile(photo.originalPath);
      const normalized = await normalizeImage(originalBuffer);

      const stampedBuffer = await renderStampedImage(normalized, {
        title: photo.project.name,
        address: photo.address,
        latitude: photo.latitude,
        longitude: photo.longitude,
        accuracy: photo.accuracy,
        capturedAt: photo.capturedAt,
        note: photo.note,
      });

      await overwriteProjectFile(photo.originalPath, normalized);
      await overwriteProjectFile(photo.stampedPath, stampedBuffer);

      await prisma.photo.update({ where: { id: photo.id }, data: { cropData: null } });
      processed++;
    } catch {
      errors.push(photo.id);
    }
  }

  return NextResponse.json({ processed, total: photos.length, errors });
}
