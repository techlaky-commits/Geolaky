import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnedProject } from "@/lib/authz";
import { saveProjectFile } from "@/lib/storage";
import { reverseGeocode } from "@/lib/geocode";
import { normalizeImage, renderStampedImage } from "@/lib/stamp";
import { compressVideo, getVideoDurationSeconds } from "@/lib/video";

export const runtime = "nodejs";

const fieldsSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  accuracy: z.coerce.number().min(0).max(100000).optional(),
  capturedAt: z.coerce.date().optional(),
  note: z.string().trim().max(1000).optional(),
  groupId: z.string().trim().min(1).max(60).optional(),
  direction: z.coerce.number().min(0).max(360).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const project = await getOwnedProject(user.id, params.id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Requete multipart invalide" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: "Le fichier doit etre une image ou une video" }, { status: 400 });
  }

  const parsed = fieldsSchema.safeParse({
    latitude: form.get("latitude") ?? undefined,
    longitude: form.get("longitude") ?? undefined,
    accuracy: form.get("accuracy") ?? undefined,
    capturedAt: form.get("capturedAt") ?? undefined,
    note: form.get("note") ?? undefined,
    groupId: form.get("groupId") ?? undefined,
    direction: form.get("direction") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Metadonnees invalides" }, { status: 400 });
  }
  const { latitude, longitude, accuracy, capturedAt, note, groupId, direction } = parsed.data;

  const geocoded =
    latitude !== undefined && longitude !== undefined
      ? await reverseGeocode(latitude, longitude)
      : null;
  const address = geocoded?.address ?? null;
  const country = geocoded?.country ?? null;
  const capturedDate = capturedAt ?? new Date();

  let originalPath: string;
  let stampedPath: string;
  let durationSeconds: number | null = null;

  if (isVideo) {
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    durationSeconds = await getVideoDurationSeconds(rawBuffer);
    const compressed = await compressVideo(rawBuffer);
    // Pas de tampon geoloc incruste pour une video (pas de retouche image
    // possible) : originalPath et stampedPath pointent vers le meme fichier.
    originalPath = await saveProjectFile(project.id, compressed, "original", "mp4");
    stampedPath = originalPath;
  } else {
    const originalBuffer = await normalizeImage(Buffer.from(await file.arrayBuffer()));
    const stampedBuffer = await renderStampedImage(originalBuffer, {
      title: project.name,
      address,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      accuracy: accuracy ?? null,
      capturedAt: capturedDate,
      note: note ?? null,
    });
    originalPath = await saveProjectFile(project.id, originalBuffer, "original");
    stampedPath = await saveProjectFile(project.id, stampedBuffer, "stamped");
  }

  const photo = await prisma.photo.create({
    data: {
      projectId: project.id,
      mediaType: isVideo ? "video" : "photo",
      originalPath,
      stampedPath,
      durationSeconds,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      accuracy: accuracy ?? null,
      address,
      country,
      note: note ?? null,
      groupId: groupId ?? null,
      direction: direction ?? null,
      capturedAt: capturedDate,
    },
  });

  return NextResponse.json({ photo }, { status: 201 });
}
