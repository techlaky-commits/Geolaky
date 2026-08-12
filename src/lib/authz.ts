import { prisma } from "@/lib/prisma";

/** Renvoie le projet uniquement s'il appartient a l'utilisateur, sinon null. */
export async function getOwnedProject(userId: string, projectId: string) {
  return prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
}

/** Renvoie la photo (avec son projet) uniquement si le projet appartient a l'utilisateur. */
export async function getOwnedPhoto(userId: string, photoId: string) {
  const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { project: true } });
  if (!photo || photo.project.ownerId !== userId) return null;
  return photo;
}
