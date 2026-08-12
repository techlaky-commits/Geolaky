import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { CaptureClient } from "@/components/CaptureClient";

export default async function CapturePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const project = await prisma.project.findFirst({
    where: { id: params.id, ownerId: user.id },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  return <CaptureClient projectId={project.id} projectName={project.name} />;
}
