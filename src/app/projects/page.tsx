import Link from "next/link";
import { Camera, FolderOpen, Image as ImageIcon, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { NewProjectForm } from "@/components/NewProjectForm";
import { RecompressButton } from "@/components/RecompressButton";

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

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          <FolderOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          Aucun projet pour le moment. Creez-en un pour commencer a prendre des photos geolocalisees.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
                {project.coverPhotoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/files/${project.coverPhotoPath}`}
                    alt={project.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <ImageIcon className="h-9 w-9" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <h2 className="font-semibold text-slate-900">{project.name}</h2>
                {project.address && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {project.address}
                  </p>
                )}
                <p className="mt-3 flex items-center gap-1 text-sm text-slate-600">
                  <Camera className="h-3.5 w-3.5" />
                  {project._count.photos} photo{project._count.photos > 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
