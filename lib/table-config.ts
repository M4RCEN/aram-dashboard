import type { TableKey } from "./types";

export type TableMeta = {
  label: string;
  description: string;
  searchFields: string[];
  locationField: "district" | "region" | null;
  categoryField: "category" | "type" | null;
  displayColumns: string[];
};

export const TABLE_META: Record<TableKey, TableMeta> = {
  events: {
    label: "Events",
    description: "Festivals, concerts, markets and activities.",
    searchFields: ["title", "description", "district", "location_name", "type"],
    locationField: "district",
    categoryField: "type",
    displayColumns: [
      "id",
      "title",
      "type",
      "district",
      "event_date",
      "status",
      "image_url",
    ],
  },
  places: {
    label: "Places",
    description: "Landmarks, nature, museums and attractions.",
    searchFields: ["title", "description", "region", "category", "address"],
    locationField: "region",
    categoryField: "category",
    displayColumns: [
      "id",
      "title",
      "category",
      "region",
      "rating",
      "status",
      "image_url",
    ],
  },
  restaurants: {
    label: "Restaurants",
    description: "Food places and dining information.",
    searchFields: [
      "name",
      "short_description",
      "district",
      "category",
      "address",
    ],
    locationField: "district",
    categoryField: "category",
    displayColumns: [
      "id",
      "name",
      "category",
      "district",
      "rating",
      "halal_status",
      "status",
      "image_url",
    ],
  },
  stays: {
    label: "Stays",
    description: "Hotels, resorts, homestays and accommodation.",
    searchFields: ["name", "description", "district", "address", "type"],
    locationField: "district",
    categoryField: "type",
    displayColumns: [
      "id",
      "name",
      "type",
      "district",
      "rating",
      "status",
      "image_url",
    ],
  },
  tours: {
    label: "Tours",
    description: "Tours, cruises and guided activities.",
    searchFields: ["name", "subtitle", "description", "district", "type"],
    locationField: "district",
    categoryField: "type",
    displayColumns: [
      "id",
      "name",
      "type",
      "district",
      "rating",
      "status",
      "image_url",
    ],
  },
};

export const ALL_TABLES: TableKey[] = [
  "events",
  "places",
  "restaurants",
  "stays",
  "tours",
];

export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];

export const DEFAULT_PAGE_SIZE = 15;

export function formatLabel(text: string): string {
  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
