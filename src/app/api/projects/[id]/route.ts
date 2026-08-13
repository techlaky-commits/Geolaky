import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnedProject } from "@/lib/authz";
import { deleteProjectFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.id, ownerId: user.id },
    include: { photos: { orderBy: { capturedAt: "desc" } } },
  });
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  return NextResponse.json({ project });
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().max(400).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  sharePointUrl: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const existing = await getOwnedProject(user.id, params.id);
  if (!existing) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });

  const project = await prisma.project.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const existing = await getOwnedProject(user.id, params.id);
  if (!existing) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const photos = await prisma.photo.findMany({ where: { projectId: params.id } });
  await Promise.all(
    photos.flatMap((p) => [deleteProjectFile(p.originalPath), deleteProjectFile(p.stampedPath)]),
  );
  await prisma.project.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
