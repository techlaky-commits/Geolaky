"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

type Project = {
  id: string;
  name: string;
  address: string | null;
  sharePointUrl: string | null;
};

export function EditProjectForm({ project }: { project: Project }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [address, setAddress] = useState(project.address ?? "");
  const [sharePointUrl, setSharePointUrl] = useState(project.sharePointUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    </form>
  );
}
