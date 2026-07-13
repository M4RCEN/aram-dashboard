import type {
  PaginatedResult,
  QueryParams,
  RecordItem,
  TableKey,
  TableStats,
} from "./types";
import { ALL_TABLES, TABLE_META } from "./table-config";

const API_URL = process.env.NEXT_PUBLIC_POSTGREST_URL;

export function getApiUrl(): string | undefined {
  return API_URL;
}

function buildQueryString(table: TableKey, params: QueryParams): string {
  const parts: string[] = [];
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 15;
  const offset = (page - 1) * pageSize;

  parts.push(`limit=${pageSize}`);
  parts.push(`offset=${offset}`);

  const sortBy = params.sortBy ?? "created_at";
  const sortDir = params.sortDir ?? "desc";
  parts.push(`order=${sortBy}.${sortDir}`);

  if (params.status) {
    parts.push(`status=eq.${encodeURIComponent(params.status)}`);
  }

  const meta = TABLE_META[table];

  if (params.category && meta.categoryField) {
    parts.push(
      `${meta.categoryField}=eq.${encodeURIComponent(params.category)}`
    );
  }

  if (params.location && meta.locationField) {
    parts.push(
      `${meta.locationField}=eq.${encodeURIComponent(params.location)}`
    );
  }

  if (params.search?.trim()) {
    const term = encodeURIComponent(`*${params.search.trim()}*`);
    const orClause = meta.searchFields
      .map((field) => `${field}.ilike.${term}`)
      .join(",");
    parts.push(`or=(${orClause})`);
  }

  return parts.join("&");
}

function parseTotalCount(contentRange: string | null): number {
  if (!contentRange) return 0;
  const match = contentRange.match(/\/(\d+|\*)/);
  if (!match || match[1] === "*") return 0;
  return parseInt(match[1], 10);
}

export async function fetchRecordsPaginated(
  table: TableKey,
  params: QueryParams = {}
): Promise<PaginatedResult> {
  if (!API_URL) {
    throw new Error("Missing NEXT_PUBLIC_POSTGREST_URL in .env.local");
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 15;
  const query = buildQueryString(table, params);

  const response = await fetch(`${API_URL}/${table}?${query}`, {
    headers: {
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed fetching ${table}`);
  }

  const data = await response.json();
  const total = parseTotalCount(response.headers.get("content-range"));
  const records = Array.isArray(data) ? data : [];

  return {
    records,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function fetchTableCount(table: TableKey): Promise<number> {
  if (!API_URL) return 0;

  const response = await fetch(`${API_URL}/${table}?select=id&limit=0`, {
    headers: {
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });

  if (!response.ok) return 0;
  return parseTotalCount(response.headers.get("content-range"));
}

export async function fetchAllTableStats(): Promise<TableStats> {
  const counts = await Promise.all(
    ALL_TABLES.map(async (table) => ({
      table,
      count: await fetchTableCount(table),
    }))
  );

  return counts.reduce(
    (acc, { table, count }) => {
      acc[table] = count;
      return acc;
    },
    {} as TableStats
  );
}

export async function fetchAnalyticsData(
  table: TableKey
): Promise<RecordItem[]> {
  if (!API_URL) return [];

  const meta = TABLE_META[table];
  const fields = ["status"];
  if (meta.locationField) fields.push(meta.locationField);
  if (meta.categoryField) fields.push(meta.categoryField);

  const response = await fetch(
    `${API_URL}/${table}?select=${fields.join(",")}&limit=1000`,
    { headers: { Accept: "application/json" } }
  );

  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchFilterOptions(
  table: TableKey
): Promise<{ locations: string[]; categories: string[] }> {
  const records = await fetchAnalyticsData(table);
  const meta = TABLE_META[table];

  const locations = new Set<string>();
  const categories = new Set<string>();

  for (const record of records) {
    if (meta.locationField) {
      const loc = record[meta.locationField];
      if (loc && typeof loc === "string") locations.add(loc);
    }
    if (meta.categoryField) {
      const cat = record[meta.categoryField];
      if (cat && typeof cat === "string") categories.add(cat);
    }
  }

  return {
    locations: Array.from(locations).sort(),
    categories: Array.from(categories).sort(),
  };
}

export async function createRecord(
  table: TableKey,
  payload: Record<string, unknown>
): Promise<RecordItem> {
  if (!API_URL) {
    throw new Error("Missing NEXT_PUBLIC_POSTGREST_URL in .env.local");
  }

  const response = await fetch(`${API_URL}/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Create failed");
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function updateRecord(
  table: TableKey,
  id: string | number,
  payload: Record<string, unknown>
): Promise<RecordItem> {
  if (!API_URL) {
    throw new Error("Missing NEXT_PUBLIC_POSTGREST_URL in .env.local");
  }

  const response = await fetch(`${API_URL}/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Update failed");
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function deleteRecord(
  table: TableKey,
  id: string | number
): Promise<void> {
  if (!API_URL) {
    throw new Error("Missing NEXT_PUBLIC_POSTGREST_URL in .env.local");
  }

  const response = await fetch(`${API_URL}/${table}?id=eq.${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Delete failed");
  }
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Upload failed");
  }

  const data = await response.json();
  return data.url;
}

export type GooglePlaceDetails = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  image_url: string | null;
  menu_images: string[];
  website: string | null;
  google_maps_url: string | null;
};

export async function fetchGooglePlaceDetails(
  placeId: string
): Promise<GooglePlaceDetails> {
  const response = await fetch(
    `/api/google-places?place_id=${encodeURIComponent(placeId)}`
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to fetch place details");
  }

  return response.json();
}
