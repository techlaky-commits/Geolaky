import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getOwnedPhoto } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { RetouchClient } from "@/components/RetouchClient";

export default async function PhotoPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const photo = await getOwnedPhoto(user.id, params.id);
  if (!photo) notFound();

  const siblings = await prisma.photo.findMany({
    where: { projectId: photo.projectId },
    orderBy: { capturedAt: "desc" },
    select: { id: true },
  });
  const index = siblings.findIndex((s) => s.id === photo.id);
  const total = siblings.length;
  const prevPhotoId = total > 1 && index !== -1 ? siblings[(index - 1 + total) % total].id : null;
  const nextPhotoId = total > 1 && index !== -1 ? siblings[(index + 1) % total].id : null;

  return (
    <RetouchClient
      photo={{
        id: photo.id,
        projectId: photo.projectId,
        projectName: photo.project.name,
        originalPath: photo.originalPath,
        stampedPath: photo.stampedPath,
        address: photo.address,
        note: photo.note,
        latitude: photo.latitude,
        longitude: photo.longitude,
        updatedAt: photo.updatedAt.toISOString(),
        cropData: photo.cropData,
        mediaType: photo.mediaType,
        durationSeconds: photo.durationSeconds,
      }}
      navigation={
        total > 1
          ? { prevPhotoId, nextPhotoId, position: index + 1, total }
          : undefined
      }
    />
  );
}
