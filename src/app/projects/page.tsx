import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { NewProjectForm } from "@/components/NewProjectForm";
import { RecompressButton } from "@/components/RecompressButton";
import { ProjectListClient } from "@/components/ProjectListClient";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  const projects = user
    ? await prisma.project.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { photos: true } } },
      })
    : [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Mes projets</h1>
        <NewProjectForm />
      </div>
      <div className="mb-6 flex justify-end">
        <RecompressButton />
      </div>

      <ProjectListClient
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          address: project.address,
          coverPhotoPath: project.coverPhotoPath,
          photoCount: project._count.photos,
          createdAt: project.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
