import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnedProject } from "@/lib/authz";
import { deleteProjectFile, saveProjectFile } from "@/lib/storage";
import { normalizeImage } from "@/lib/stamp";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const project = await getOwnedProject(user.id, params.id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Fichier image requis" }, { status: 400 });
  }

  const buffer = await normalizeImage(Buffer.from(await file.arrayBuffer()));
  const coverPhotoPath = await saveProjectFile(project.id, buffer, "cover", "jpg");

  if (project.coverPhotoPath) await deleteProjectFile(project.coverPhotoPath);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { coverPhotoPath },
  });

  return NextResponse.json({ project: updated });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const project = await getOwnedProject(user.id, params.id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  if (project.coverPhotoPath) await deleteProjectFile(project.coverPhotoPath);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { coverPhotoPath: null },
  });

  return NextResponse.json({ project: updated });
}
