import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getOwnedPhoto } from "@/lib/authz";
import { RetouchClient } from "@/components/RetouchClient";

export default async function PhotoPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const photo = await getOwnedPhoto(user.id, params.id);
  if (!photo) notFound();

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
      }}
    />
  );
}
