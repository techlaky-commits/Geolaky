"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type ProjectOption = { id: string; name: string };

const NEW_PROJECT_VALUE = "__new__";

/** Selecteur de projet reutilisable : liste des projets existants + creation
 * d'un nouveau projet directement depuis le composant appelant (editeur de
 * photo, actions groupees sur la carte...). */
export function ProjectPicker({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (projectId: string, projectName: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data.projects.map((p: ProjectOption) => ({ id: p.id, name: p.name }))))
      .catch(() => setError("Impossible de charger les projets."));
  }, []);

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === NEW_PROJECT_VALUE) {
      setCreating(true);
      return;
    }
    const project = projects?.find((p) => p.id === e.target.value);
    if (project) onChange(project.id, project.name);
  }

  async function createProject() {
    if (!newName.trim()) return;
    setSavingNew(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("create failed");
      const data = await res.json();
      setProjects((prev) => [...(prev ?? []), { id: data.project.id, name: data.project.name }]);
      onChange(data.project.id, data.project.name);
      setCreating(false);
      setNewName("");
    } catch {
      setError("Impossible de creer le projet.");
    } finally {
      setSavingNew(false);
    }
  }

  if (!projects) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-400 ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des projets...
      </div>
    );
  }

  if (creating) {
    return (
      <div className={`flex gap-2 ${className ?? ""}`}>
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom du nouveau projet"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && createProject()}
        />
        <button
          type="button"
          onClick={createProject}
          disabled={savingNew || !newName.trim()}
          className="shrink-0 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {savingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : "Creer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setCreating(false);
            setNewName("");
          }}
          disabled={savingNew}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Annuler
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      <select
        value={value}
        onChange={handleSelectChange}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value={NEW_PROJECT_VALUE}>+ Nouveau projet...</option>
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export { NEW_PROJECT_VALUE };
