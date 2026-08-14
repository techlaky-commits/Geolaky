"use client";

import { useState } from "react";
import { Copy, FolderKanban, Loader2, MapPin, MessageSquare, Trash2, X } from "lucide-react";
import { ProjectPicker } from "@/components/ProjectPicker";

type Panel = "move" | "copy" | "address" | "note" | null;

/** Barre d'actions groupees pour la galerie d'un projet (equivalent en
 * francais de BulkEditBar, utilisee sur la carte en anglais) : deplacer,
 * copier vers un autre projet, modifier l'adresse/la note, supprimer. */
export function GalleryBulkEditBar({
  count,
  busy,
  error,
  onClear,
  onMoveToProject,
  onCopyToProject,
  onApplyAddress,
  onApplyNote,
  onDelete,
}: {
  count: number;
  busy: boolean;
  error: string | null;
  onClear: () => void;
  onMoveToProject: (projectId: string, projectName: string) => void;
  onCopyToProject: (projectId: string, projectName: string) => void;
  onApplyAddress: (address: string) => void;
  onApplyNote: (note: string) => void;
  onDelete: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [addressValue, setAddressValue] = useState("");
  const [noteValue, setNoteValue] = useState("");

  function confirmMove(id: string, name: string) {
    if (!confirm(`Deplacer ${count} element${count > 1 ? "s" : ""} vers le projet "${name}" ?`)) return;
    onMoveToProject(id, name);
    setPanel(null);
  }

  function confirmCopy(id: string, name: string) {
    if (!confirm(`Copier ${count} element${count > 1 ? "s" : ""} vers le projet "${name}" ? Les originaux resteront ici.`)) return;
    onCopyToProject(id, name);
    setPanel(null);
  }

  function confirmAddress() {
    if (!confirm(`Remplacer l'adresse de ${count} element${count > 1 ? "s" : ""} ?`)) return;
    onApplyAddress(addressValue.trim());
    setPanel(null);
    setAddressValue("");
  }

  function confirmNote() {
    if (!confirm(`Remplacer le commentaire de ${count} element${count > 1 ? "s" : ""} par le nouveau texte saisi ?`)) return;
    onApplyNote(noteValue.trim());
    setPanel(null);
    setNoteValue("");
  }

  function confirmDelete() {
    if (!confirm(`Supprimer definitivement ${count} element${count > 1 ? "s" : ""} ? Cette action est irreversible.`)) return;
    onDelete();
    setPanel(null);
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[1000] mx-auto flex w-fit max-w-[95%] flex-col items-center gap-2 rounded-lg border border-brand-200 bg-white p-3 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">
          {count} element{count > 1 ? "s" : ""} selectionne{count > 1 ? "s" : ""}
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
          Effacer
        </button>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {panel === null && (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setPanel("move")}
            disabled={busy}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Deplacer vers...
          </button>
          <button
            onClick={() => setPanel("copy")}
            disabled={busy}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Copy className="h-3.5 w-3.5" />
            Copier vers...
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
            Grouper un commentaire
          </button>
          <button
            onClick={confirmDelete}
            disabled={busy}
            className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        </div>
      )}

      {panel === "move" && (
        <div className="flex w-full max-w-sm items-center gap-2">
          <ProjectPicker value="" placeholder="Choisir un projet..." onChange={confirmMove} className="flex-1" />
          <button
            onClick={() => setPanel(null)}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      )}

      {panel === "copy" && (
        <div className="flex w-full max-w-sm items-center gap-2">
          <ProjectPicker value="" placeholder="Choisir un projet..." onChange={confirmCopy} className="flex-1" />
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
            placeholder="Commentaire pour toute la selection"
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
