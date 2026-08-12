import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnedPhoto } from "@/lib/authz";
import { deleteProjectFile, overwriteProjectFile, readProjectFile } from "@/lib/storage";
import { renderStampedImage, type CropData } from "@/lib/stamp";

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

const updateSchema = z.object({
  note: z.string().trim().max(1000).nullable().optional(),
  address: z.string().trim().max(400).nullable().optional(),
  crop: cropSchema.nullable().optional(),
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
  const address = parsed.data.address !== undefined ? parsed.data.address : photo.address;
  const crop: CropData | null =
    parsed.data.crop !== undefined ? parsed.data.crop : photo.cropData ? JSON.parse(photo.cropData) : null;

  const originalBuffer = await readProjectFile(photo.originalPath);
  const stampedBuffer = await renderStampedImage(
    originalBuffer,
    {
      title: photo.project.name,
      address,
      latitude: photo.latitude,
      longitude: photo.longitude,
      accuracy: photo.accuracy,
      capturedAt: photo.capturedAt,
      note,
    },
    crop,
  );

  await overwriteProjectFile(photo.stampedPath, stampedBuffer);

  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: {
      note,
      address,
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
