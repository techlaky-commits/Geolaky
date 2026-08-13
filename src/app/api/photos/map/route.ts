import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const photos = await prisma.photo.findMany({
    where: {
      project: { ownerId: user.id },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      projectId: true,
      project: { select: { name: true } },
      stampedPath: true,
      latitude: true,
      longitude: true,
      address: true,
      country: true,
      note: true,
      groupId: true,
      mediaType: true,
      direction: true,
      capturedAt: true,
    },
    orderBy: { capturedAt: "desc" },
  });

  return NextResponse.json({
    photos: photos.map((p) => ({
      id: p.id,
      projectId: p.projectId,
      projectName: p.project.name,
      stampedPath: p.stampedPath,
      latitude: p.latitude,
      longitude: p.longitude,
      address: p.address,
      country: p.country,
      note: p.note,
      groupId: p.groupId,
      mediaType: p.mediaType,
      direction: p.direction,
      capturedAt: p.capturedAt,
    })),
  });
}
