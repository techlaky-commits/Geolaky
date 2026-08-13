import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnedPhoto, getOwnedProject } from "@/lib/authz";
import { deleteProjectFile, overwriteProjectFile, readProjectFile } from "@/lib/storage";
import { renderStampedImage, type CropData } from "@/lib/stamp";
import { reverseGeocode } from "@/lib/geocode";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const photo = await getOwnedPhoto(user.id, params.id);
  if (!photo) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });

  return NextResponse.json({ photo });
}

const cropSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
});

const positionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const updateSchema = z.object({
  note: z.string().trim().max(1000).nullable().optional(),
  address: z.string().trim().max(400).nullable().optional(),
  crop: cropSchema.nullable().optional(),
  position: positionSchema.optional(),
  projectId: z.string().trim().min(1).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const photo = await getOwnedPhoto(user.id, params.id);
  if (!photo) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });

  const note = parsed.data.note !== undefined ? parsed.data.note : photo.note;
  const crop: CropData | null =
    parsed.data.crop !== undefined ? parsed.data.crop : photo.cropData ? JSON.parse(photo.cropData) : null;

  let latitude = photo.latitude;
  let longitude = photo.longitude;
  let accuracy = photo.accuracy;
  let address = parsed.data.address !== undefined ? parsed.data.address : photo.address;
  let country = photo.country;

  if (parsed.data.position) {
    latitude = parsed.data.position.latitude;
    longitude = parsed.data.position.longitude;
    accuracy = null; // la precision GPS d'origine ne reflete plus une position corrigee manuellement

    if (parsed.data.address === undefined) {
      const geocoded = await reverseGeocode(latitude, longitude);
      address = geocoded?.address ?? null;
      country = geocoded?.country ?? null;
    }
  }

  let projectId = photo.projectId;
  let projectName = photo.project.name;
  if (parsed.data.projectId && parsed.data.projectId !== photo.projectId) {
    const targetProject = await getOwnedProject(user.id, parsed.data.projectId);
    if (!targetProject) {
      return NextResponse.json({ error: "Projet de destination introuvable" }, { status: 404 });
    }
    projectId = targetProject.id;
    projectName = targetProject.name;
  }

  // Une video n'a pas de tampon geoloc incruste (pas de retouche image
  // possible) : seuls les champs sont mis a jour, le fichier reste intact.
  if (photo.mediaType !== "video") {
    const originalBuffer = await readProjectFile(photo.originalPath);
    const stampedBuffer = await renderStampedImage(
      originalBuffer,
      {
        title: projectName,
        address,
        latitude,
        longitude,
        accuracy,
        capturedAt: photo.capturedAt,
        note,
      },
      crop,
    );

    await overwriteProjectFile(photo.stampedPath, stampedBuffer);
  }

  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: {
      note,
      address,
      country,
      latitude,
      longitude,
      accuracy,
      projectId,
      cropData: crop ? JSON.stringify(crop) : null,
    },
  });

  return NextResponse.json({ photo: updated });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const photo = await getOwnedPhoto(user.id, params.id);
  if (!photo) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });

  await deleteProjectFile(photo.originalPath);
  await deleteProjectFile(photo.stampedPath);
  await prisma.photo.delete({ where: { id: photo.id } });

  return NextResponse.json({ ok: true });
}
