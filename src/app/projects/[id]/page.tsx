import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Download, ExternalLink, FileArchive, Map, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PhotoGalleryGrid } from "@/components/PhotoGalleryGrid";
import { EditProjectForm } from "@/components/EditProjectForm";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const project = await prisma.project.findFirst({
    where: { id: params.id, ownerId: user.id },
    include: { photos: { orderBy: { capturedAt: "desc" } } },
  });
  if (!project) notFound();

  const hasGeolocatedMedia = project.photos.some((p) => p.latitude !== null && p.longitude !== null);

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
          {project.sharePointUrl && (
            <a
              href={project.sharePointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Dossier SharePoint
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/map?projectId=${project.id}`}
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Map className="h-4 w-4" />
            Voir sur la carte
          </Link>
          <a
            href={`/api/projects/${project.id}/report`}
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Rapport PDF
          </a>
          {hasGeolocatedMedia && (
            <a
              href={`/api/projects/${project.id}/export-shp`}
              title="Export georeference (polygones) pour QGIS"
              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileArchive className="h-4 w-4" />
              Export SHP (QGIS)
            </a>
          )}
          <Link
            href={`/capture/${project.id}`}
            className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Camera className="h-4 w-4" />
            Prendre une photo
          </Link>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <EditProjectForm
          project={{
            id: project.id,
            name: project.name,
            address: project.address,
            sharePointUrl: project.sharePointUrl,
            coverPhotoPath: project.coverPhotoPath,
          }}
        />
      </div>

      {project.photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Aucune photo pour ce projet. Utilisez &laquo;&nbsp;Prendre une photo&nbsp;&raquo; depuis votre mobile.
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            Clic droit sur une photo pour un acces rapide (cadrage, position, remplacement,
            telechargement, suppression).
          </p>
          <PhotoGalleryGrid
            photos={project.photos.map((p) => ({
              id: p.id,
              stampedPath: p.stampedPath,
              address: p.address,
              mediaType: p.mediaType,
              direction: p.direction,
            }))}
            projectName={project.name}
          />
        </>
      )}
    </div>
  );
}
