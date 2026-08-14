"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";

type Project = {
  id: string;
  name: string;
  address: string | null;
  sharePointUrl: string | null;
  coverPhotoPath: string | null;
  photoCount: number;
};

export function EditProjectForm({ project }: { project: Project }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [address, setAddress] = useState(project.address ?? "");
  const [sharePointUrl, setSharePointUrl] = useState(project.sharePointUrl ?? "");
  const [coverPhotoPath, setCoverPhotoPath] = useState(project.coverPhotoPath);
  const [coverVersion, setCoverVersion] = useState(0);
  const [coverBusy, setCoverBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function deleteProject() {
    const count = project.photoCount;
    const warning =
      count > 0
        ? `Supprimer definitivement le projet "${project.name}" et ${count} photo${count > 1 ? "s/videos" : "/video"} associee${count > 1 ? "s" : ""} ? Cette action est irreversible.`
        : `Supprimer definitivement le projet "${project.name}" ? Cette action est irreversible.`;
    if (!confirm(warning)) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      router.push("/projects");
      router.refresh();
    } catch {
      setError("Impossible de supprimer le projet.");
      setDeleting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        address: address.trim() || null,
        sharePointUrl: sharePointUrl.trim() || null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Impossible d'enregistrer les modifications.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  async function onCoverFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setCoverBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/projects/${project.id}/cover`, { method: "POST", body: form });
      if (!res.ok) throw new Error("cover upload failed");
      const data = await res.json();
      setCoverPhotoPath(data.project.coverPhotoPath);
      setCoverVersion((v) => v + 1);
      router.refresh();
    } catch {
      setError("Impossible d'enregistrer la vignette.");
    } finally {
      setCoverBusy(false);
    }
  }

  async function removeCover() {
    if (!confirm("Supprimer la vignette de ce projet ?")) return;
    setCoverBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/cover`, { method: "DELETE" });
      if (!res.ok) throw new Error("cover delete failed");
      setCoverPhotoPath(null);
      router.refresh();
    } catch {
      setError("Impossible de supprimer la vignette.");
    } finally {
      setCoverBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Pencil className="h-4 w-4" />
        Modifier le projet
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 w-full space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-slate-900">Parametres du projet</h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Vignette du projet</label>
        <div className="flex items-center gap-3">
          <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {coverPhotoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/files/${coverPhotoPath}?v=${coverVersion}`}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ImagePlus className="h-6 w-6 text-slate-300" />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onCoverFileSelected}
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverBusy}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {coverBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {coverPhotoPath ? "Changer l'image" : "Ajouter une image"}
            </button>
            {coverPhotoPath && (
              <button
                type="button"
                onClick={removeCover}
                disabled={coverBusy}
                className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer l&apos;image
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nom du projet / site</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Adresse (optionnel)</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Dossier SharePoint (optionnel)
        </label>
        <input
          value={sharePointUrl}
          onChange={(e) => setSharePointUrl(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="https://votreentreprise.sharepoint.com/sites/.../Documents/..."
        />
        <p className="mt-1 text-xs text-slate-400">
          Lien de reference vers le dossier SharePoint du projet (aucune synchronisation automatique des fichiers).
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>

      <div className="mt-2 border-t border-red-100 pt-4">
        <h3 className="mb-1 text-sm font-semibold text-red-700">Zone de suppression</h3>
        <p className="mb-2 text-xs text-slate-500">
          Supprime definitivement ce projet ainsi que toutes ses photos et videos.
        </p>
        <button
          type="button"
          onClick={deleteProject}
          disabled={deleting}
          className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleting ? "Suppression..." : "Supprimer le projet"}
        </button>
      </div>
    </form>
  );
}
