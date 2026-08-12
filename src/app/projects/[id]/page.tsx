import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Download, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const project = await prisma.project.findFirst({
    where: { id: params.id, ownerId: user.id },
    include: { photos: { orderBy: { capturedAt: "desc" } } },
  });
  if (!project) notFound();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          {project.address && (
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {project.address}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/projects/${project.id}/report`}
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Rapport PDF
          </a>
          <Link
            href={`/capture/${project.id}`}
            className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Camera className="h-4 w-4" />
            Prendre une photo
          </Link>
        </div>
      </div>

      {project.photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Aucune photo pour ce projet. Utilisez &laquo;&nbsp;Prendre une photo&nbsp;&raquo; depuis votre mobile.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {project.photos.map((photo) => (
            <Link
              key={photo.id}
              href={`/photos/${photo.id}`}
              className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              {/* Servi via une route API protegee, pas via /public : usage d'un <img> classique. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/${photo.stampedPath}`}
                alt={photo.address || project.name}
                className="aspect-square w-full object-cover transition group-hover:opacity-90"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
