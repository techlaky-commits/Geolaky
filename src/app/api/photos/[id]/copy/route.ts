import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnedPhoto, getOwnedProject } from "@/lib/authz";
import { readProjectFile, saveProjectFile } from "@/lib/storage";

export const runtime = "nodejs";

const bodySchema = z.object({ targetProjectId: z.string().trim().min(1) });

/** Duplique une photo/video (fichiers + metadonnees) vers un autre projet,
 * sans toucher a l'original : contrairement au deplacement (PATCH
 * projectId), les deux exemplaires existent ensuite independamment. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const photo = await getOwnedPhoto(user.id, params.id);
  if (!photo) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });

  const targetProject = await getOwnedProject(user.id, parsed.data.targetProjectId);
  if (!targetProject) return NextResponse.json({ error: "Projet de destination introuvable" }, { status: 404 });

  const ext = photo.mediaType === "video" ? "mp4" : "jpg";

  const originalBuffer = await readProjectFile(photo.originalPath);
  const newOriginalPath = await saveProjectFile(targetProject.id, originalBuffer, "original", ext);

  let newStampedPath = newOriginalPath;
  if (photo.stampedPath !== photo.originalPath) {
    const stampedBuffer = await readProjectFile(photo.stampedPath);
    newStampedPath = await saveProjectFile(targetProject.id, stampedBuffer, "stamped", ext);
  }

  const copy = await prisma.photo.create({
    data: {
      projectId: targetProject.id,
      mediaType: photo.mediaType,
      originalPath: newOriginalPath,
      stampedPath: newStampedPath,
      durationSeconds: photo.durationSeconds,
      latitude: photo.latitude,
      longitude: photo.longitude,
      accuracy: photo.accuracy,
      address: photo.address,
      country: photo.country,
      note: photo.note,
      direction: photo.direction,
      cropData: photo.cropData,
      // Pas de groupId : la copie ne doit pas se retrouver regroupee avec
      // l'original (ou ses freres de lot) sur la carte.
      groupId: null,
      capturedAt: photo.capturedAt,
    },
  });

  return NextResponse.json({ photo: copy }, { status: 201 });
}
