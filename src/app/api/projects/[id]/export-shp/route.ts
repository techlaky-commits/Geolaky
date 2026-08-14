import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { buildProjectShapefile } from "@/lib/shapefile";

export const runtime = "nodejs";

/** Export georeference (Shapefile zippe : .shp/.shx/.dbf/.prj) des medias
 * geolocalises d'un projet, sous forme de polygones (secteur oriente si une
 * direction de prise de vue est connue, sinon un petit cercle), pour
 * ouverture directe dans QGIS. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.id, ownerId: user.id },
    include: { photos: { orderBy: { capturedAt: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const zipBuffer = await buildProjectShapefile(project.name, project.photos);
  if (!zipBuffer) {
    return NextResponse.json({ error: "Aucun media geolocalise dans ce projet" }, { status: 400 });
  }

  const safeName = project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "projet";

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="shp-${safeName}.zip"`,
    },
  });
}
