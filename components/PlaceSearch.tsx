"use client";

import { useEffect, useRef, useState } from "react";
import { buildGoogleImportPayload } from "@/lib/google-import";
import {
  createRecord,
  fetchGooglePlaceDetails,
  searchGooglePlaces,
  type GooglePlaceSearchResult,
} from "@/lib/postgrest";
import { TABLE_META } from "@/lib/table-config";
import type { TableKey } from "@/lib/types";

type PlaceSearchProps = {
  table: TableKey;
  onImported: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

function singularLabel(table: TableKey): string {
  const label = TABLE_META[table].label.toLowerCase();
  const singular = label.endsWith("s") ? label.slice(0, -1) : label;
  const article = /^[aeiou]/.test(singular) ? "an" : "a";
  return `${article} ${singular}`;
}

export default function PlaceSearch({
  table,
  onImported,
  onError,
  onSuccess,
}: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GooglePlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const found = await searchGooglePlaces(query);
        setResults(found);
        setOpen(true);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, onError]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleImport(place: GooglePlaceSearchResult) {
    try {
      setImportingId(place.place_id);
      const details = await fetchGooglePlaceDetails(place.place_id);
      const payload = buildGoogleImportPayload(table, details, place.place_id);
      await createRecord(table, payload);

      onSuccess(`"${place.name}" imported successfully.`);
      setQuery("");
      setResults([]);
      setOpen(false);
      onImported();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import place.";
      if (message.includes("duplicate key") || message.includes("unique")) {
        onError(`"${place.name}" is already in the database.`);
      } else {
        onError(message);
      }
    } finally {
      setImportingId(null);
    }
  }

  const label = singularLabel(table);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        Search
      </label>

      <div className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35m1.35-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={`Search for ${label} to import...`}
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-600"
        />

        {searching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            Searching...
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.map((place) => (
            <button
              key={place.place_id}
              type="button"
              onClick={() => handleImport(place)}
              disabled={importingId !== null}
              className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-b-0 hover:bg-slate-50 disabled:opacity-60"
            >
              {place.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={place.photo_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
                  📍
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {place.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {place.address}
                </p>
              </div>

              {place.rating != null && (
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                  ★ {place.rating}
                </span>
              )}

              <span className="w-20 shrink-0 text-right text-xs font-semibold text-blue-600">
                {importingId === place.place_id ? "Importing..." : "Import"}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && !searching && results.length === 0 && query.trim() && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-xl">
          No results for &ldquo;{query}&rdquo;.
        </div>
      )}
    </div>
  );
}
