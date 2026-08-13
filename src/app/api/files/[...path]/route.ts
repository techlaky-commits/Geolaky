import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readProjectFile } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function contentTypeFor(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Sert les fichiers stockes hors du dossier public, en verifiant que
 * l'utilisateur connecte est bien proprietaire du projet concerne.
 * Route: /api/files/<projectId>/<filename>
 * Supporte les requetes Range (necessaire pour la lecture/recherche video).
 */
export async function GET(request: Request, { params }: { params: { path: string[] } }) {
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
    const contentType = contentTypeFor(filename);

    const range = request.headers.get("range");
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      const start = match?.[1] ? Number(match[1]) : 0;
      const end = match?.[2] ? Number(match[2]) : buffer.length - 1;
      const chunk = buffer.subarray(start, end + 1);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.length),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
