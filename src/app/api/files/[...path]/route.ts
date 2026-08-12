import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readProjectFile } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Sert les fichiers stockes hors du dossier public, en verifiant que
 * l'utilisateur connecte est bien proprietaire du projet concerne.
 * Route: /api/files/<projectId>/<filename>
 */
export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const [projectId, ...rest] = params.path;
  const filename = rest.join("/");
  if (!projectId || !filename) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: user.id } });
  if (!project) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  try {
    const buffer = await readProjectFile(`${projectId}/${filename}`);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
