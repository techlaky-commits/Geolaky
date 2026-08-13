"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, FolderKanban, Loader2, MapPin, Search, X } from "lucide-react";
import { parseCoordsInput } from "@/lib/geo";

type ProjectOption = { id: string; name: string };

type Suggestion =
  | { type: "coords"; latitude: number; longitude: number; label: string }
  | { type: "project"; id: string; label: string }
  | { type: "place"; latitude: number; longitude: number; label: string };

export function MapSearchBar({
  projects,
  onSelectProject,
  onSelectLocation,
}: {
  projects: ProjectOption[];
  onSelectProject: (projectId: string) => void;
  onSelectLocation: (latitude: number, longitude: number, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }

    const coords = parseCoordsInput(trimmed);
    if (coords) {
      setSuggestions([
        {
          type: "coords",
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
        },
      ]);
      return;
    }

    const projectMatches: Suggestion[] = projects
      .filter((p) => p.name.toLowerCase().includes(trimmed.toLowerCase()))
      .slice(0, 4)
      .map((p) => ({ type: "project", id: p.id, label: p.name }));

    // Affiche les projets correspondants immediatement, sans attendre le reseau.
    setSuggestions(projectMatches);

    if (trimmed.length < 3) return;

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/geocode/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const placeMatches: Suggestion[] = (data.matches ?? []).map(
            (m: { label: string; latitude: number; longitude: number }) => ({
              type: "place",
              latitude: m.latitude,
              longitude: m.longitude,
              label: m.label,
            }),
          );
          setSuggestions([...projectMatches, ...placeMatches]);
        })
        .catch(() => {
          if (!cancelled) setSuggestions(projectMatches);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, projects]);

  function pick(s: Suggestion) {
    if (s.type === "project") {
      onSelectProject(s.id);
    } else {
      onSelectLocation(s.latitude, s.longitude, s.label);
    }
    setQuery(s.label);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && suggestions.length > 0) {
      pick(suggestions[0]);
    }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-64">
      <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-2 py-1.5 shadow-md backdrop-blur">
        <Search className="h-4 w-4 shrink-0 text-brand-600" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search: project, address, or GPS"
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />}
        {query && !loading && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
            }}
            className="shrink-0 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-[1001] mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => pick(s)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              {s.type === "project" && <FolderKanban className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              {s.type === "coords" && <Crosshair className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              {s.type === "place" && <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
