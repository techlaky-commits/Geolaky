"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Trash2,
  X,
} from "lucide-react";

type ProjectItem = {
  id: string;
  name: string;
  address: string | null;
  coverPhotoPath: string | null;
  photoCount: number;
  createdAt: string;
};

type SortOption = "date-desc" | "date-asc" | "name-asc" | "name-desc";

const SORT_LABELS: Record<SortOption, string> = {
  "date-desc": "Date (recent d'abord)",
  "date-asc": "Date (ancien d'abord)",
  "name-asc": "Nom (A → Z)",
  "name-desc": "Nom (Z → A)",
};

export function ProjectListClient({ projects: initialProjects }: { projects: ProjectItem[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const sortedProjects = useMemo(() => {
    const arr = [...projects];
    switch (sortBy) {
      case "date-asc":
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "name-asc":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        arr.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "date-desc":
      default:
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
    return arr;
  }, [projects, sortBy]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    const count = selectedIds.size;
    if (
      !confirm(
        `Supprimer definitivement ${count} projet${count > 1 ? "s" : ""} et toutes leurs photos/videos ? Cette action est irreversible.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setBulkError(null);
    const ids = Array.from(selectedIds);
    let anyError = false;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
        setProjects((prev) => prev.filter((p) => p.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch {
        anyError = true;
      }
    }
    setBulkBusy(false);
    if (anyError) setBulkError("Certains projets n'ont pas pu etre supprimes.");
    router.refresh();
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        <FolderOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        Aucun projet pour le moment. Creez-en un pour commencer a prendre des photos geolocalisees.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Trier par
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-400">
          Touchez le cercle en haut a gauche d&apos;un projet pour le selectionner
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sortedProjects.map((project) => {
          const selected = selectedIds.has(project.id);
          return (
            <div key={project.id} className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSelect(project.id);
                }}
                className={`absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow transition ${
                  selected
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-white bg-white/85 text-transparent hover:bg-white"
                }`}
                aria-label={selected ? "Deselectionner ce projet" : "Selectionner ce projet"}
              >
                <Check className="h-4 w-4" />
              </button>
              <Link
                href={`/projects/${project.id}`}
                className={`group block overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${
                  selected ? "border-brand-400 ring-2 ring-brand-200" : "border-slate-200 hover:border-brand-300"
                }`}
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
                    {project.photoCount} photo{project.photoCount > 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-[1000] mx-auto flex w-fit max-w-[92%] flex-wrap items-center justify-center gap-3 rounded-lg border border-brand-200 bg-white p-3 shadow-lg">
          <span className="text-sm font-medium text-slate-700">
            {selectedIds.size} projet{selectedIds.size > 1 ? "s" : ""} selectionne{selectedIds.size > 1 ? "s" : ""}
          </span>
          {bulkError && <span className="text-sm text-red-600">{bulkError}</span>}
          <button
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkBusy}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Annuler
          </button>
          <button
            onClick={bulkDelete}
            disabled={bulkBusy}
            className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}
