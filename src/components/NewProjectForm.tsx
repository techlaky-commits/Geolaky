"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function NewProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address: address || undefined }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Impossible de creer le projet.");
      return;
    }

    setName("");
    setAddress("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" />
        Nouveau projet
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nom du projet / site</label>
        <input
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="Ex : Chantier Rue de la Paix"
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Creation..." : "Creer"}
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
