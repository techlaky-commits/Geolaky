"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Minimize2 } from "lucide-react";

export function RecompressButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ processed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (
      !confirm(
        "Reduire la taille de toutes vos photos existantes ? Cette action est irreversible " +
          "(la qualite d'origine ne sera plus recuperable) et reinitialise le recadrage de " +
          "chaque photo deja retouchee.",
      )
    ) {
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/maintenance/recompress", { method: "POST" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setResult({ processed: data.processed, total: data.total });
    } catch {
      setError("Impossible de compresser les photos existantes.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={running}
        className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-600 disabled:opacity-60"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minimize2 className="h-3.5 w-3.5" />}
        {running ? "Compression en cours..." : "Compresser mes photos existantes"}
      </button>
      {result && (
        <p className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          {result.processed}/{result.total} photo{result.total > 1 ? "s" : ""} compressee
          {result.processed > 1 ? "s" : ""}.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
