"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/postgrest";

type ImagesFieldProps = {
  value: string[];
  onChange: (urls: string[]) => void;
  label: string;
};

export default function ImagesField({
  value,
  onChange,
  label,
}: ImagesFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const urls = Array.isArray(value) ? value : [];

  async function handleUpload(file: File) {
    try {
      setUploading(true);
      setError(null);
      const url = await uploadImage(file);
      onChange([...urls, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function addUrl() {
    if (!urlInput.trim()) return;
    onChange([...urls, urlInput.trim()]);
    setUrlInput("");
  }

  function removeUrl(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      {urls.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {urls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="group relative overflow-hidden rounded-xl border border-slate-200"
            >
              <img
                src={url}
                alt={`Image ${index + 1}`}
                className="h-24 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeUrl(index)}
                className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Add image URL"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-600"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
        />
        <button
          type="button"
          onClick={addUrl}
          className="rounded-xl bg-slate-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Add URL
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        {uploading ? "Uploading..." : "Upload Image"}
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
