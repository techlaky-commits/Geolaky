"use client";

import { useState } from "react";
import { FolderKanban, Loader2, MapPin, MessageSquare, X } from "lucide-react";
import { ProjectPicker } from "@/components/ProjectPicker";

type Panel = "project" | "address" | "note" | null;

export function BulkEditBar({
  count,
  busy,
  error,
  onClear,
  onApplyProject,
  onApplyAddress,
  onApplyNote,
}: {
  count: number;
  busy: boolean;
  error: string | null;
  onClear: () => void;
  onApplyProject: (projectId: string, projectName: string) => void;
  onApplyAddress: (address: string) => void;
  onApplyNote: (note: string) => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [addressValue, setAddressValue] = useState("");
  const [noteValue, setNoteValue] = useState("");

  function confirmProject(id: string, name: string) {
    if (!confirm(`Deplacer ${count} photo${count > 1 ? "s" : ""} vers le projet "${name}" ?`)) return;
    onApplyProject(id, name);
    setPanel(null);
  }

  function confirmAddress() {
    if (!confirm(`Remplacer l'adresse affichee sur ${count} photo${count > 1 ? "s" : ""} ?`)) return;
    onApplyAddress(addressValue.trim());
    setPanel(null);
    setAddressValue("");
  }

  function confirmNote() {
    if (!confirm(`Remplacer le commentaire de ${count} photo${count > 1 ? "s" : ""} ?`)) return;
    onApplyNote(noteValue.trim());
    setPanel(null);
    setNoteValue("");
  }

  return (
    <div className="absolute inset-x-0 bottom-4 z-[1000] mx-auto flex w-fit max-w-[95%] flex-col items-center gap-2 rounded-lg border border-brand-200 bg-white p-3 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">
          {count} photo{count > 1 ? "s" : ""} selectionnee{count > 1 ? "s" : ""}
        </span>
        <button
          onClick={() => {
            onClear();
            setPanel(null);
          }}
          disabled={busy}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Deselectionner
        </button>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {panel === null && (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setPanel("project")}
            disabled={busy}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Changer de projet
          </button>
          <button
            onClick={() => setPanel("address")}
            disabled={busy}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <MapPin className="h-3.5 w-3.5" />
            Modifier l&apos;adresse
          </button>
          <button
            onClick={() => setPanel("note")}
            disabled={busy}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Modifier le commentaire
          </button>
        </div>
      )}

      {panel === "project" && (
        <div className="flex w-full max-w-sm items-center gap-2">
          <ProjectPicker
            value=""
            placeholder="Choisir un projet..."
            onChange={confirmProject}
            className="flex-1"
          />
          <button
            onClick={() => setPanel(null)}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      )}

      {panel === "address" && (
        <div className="flex w-full max-w-sm items-center gap-2">
          <input
            autoFocus
            value={addressValue}
            onChange={(e) => setAddressValue(e.target.value)}
            placeholder="Nouvelle adresse pour toute la selection"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === "Enter" && confirmAddress()}
          />
          <button
            onClick={confirmAddress}
            className="shrink-0 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Appliquer
          </button>
          <button
            onClick={() => setPanel(null)}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      )}

      {panel === "note" && (
        <div className="flex w-full max-w-sm items-center gap-2">
          <input
            autoFocus
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="Nouveau commentaire pour toute la selection"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === "Enter" && confirmNote()}
          />
          <button
            onClick={confirmNote}
            className="shrink-0 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Appliquer
          </button>
          <button
            onClick={() => setPanel(null)}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
