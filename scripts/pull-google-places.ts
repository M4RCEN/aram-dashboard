/**
 * Automatic Google Places importer.
 *
 * Pulls places located in Sarawak, Malaysia with a rating of 3.0 or
 * higher, for every table (events, places, restaurants, stays, tours),
 * and inserts only records that aren't already in the database
 * (matched by google_place_id). Existing rows -- including ones edited
 * by hand on the dashboard -- are never touched.
 *
 * Queries run per-district (Kuching, Miri, Sibu, Bintulu, ...) rather
 * than one statewide "in Sarawak" search, because Google's Text Search
 * only treats location as a ranking hint, not a hard filter -- a
 * single broad query returns almost entirely Kuching (the capital)
 * and starves every other town of coverage.
 *
 * Intended to run on a schedule (cron/systemd timer). It self-gates so
 * that even if the scheduler fires more often than intended, an actual
 * pull only happens once every PULL_INTERVAL_DAYS. Run with --force to
 * bypass the gate (useful for manual testing).
 *
 * Usage:
 *   npm run pull:places
 *   npm run pull:places -- --force
 */
import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGoogleImportPayload, SARAWAK_DISTRICTS } from "../lib/google-import";
import { ALL_TABLES } from "../lib/table-config";
import type { TableKey } from "../lib/types";
import type { GooglePlaceDetails } from "../lib/postgrest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, "..", ".env.local") });

const PLACES_API = "https://maps.googleapis.com/maps/api/place";
const STATE_FILE = path.join(__dirname, ".pull-state.json");
const PULL_INTERVAL_DAYS = 14;
const MIN_RATING = 3;
const REGION_KEYWORD = "Sarawak";
const MAX_PAGES_PER_QUERY = 2; // Google returns up to 20 results/page.
const NEXT_PAGE_DELAY_MS = 4000; // Google requires a short delay before a page token becomes valid.
const BETWEEN_QUERY_DELAY_MS = 200;

const CATEGORY_TERMS: Record<TableKey, string> = {
  restaurants: "restaurants",
  places: "tourist attractions",
  stays: "hotels",
  tours: "tour operators",
  events: "event venues",
};

// Approximate town-center coordinates, used to bias each per-district
// search toward that district specifically (rather than the whole state).
const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  Kuching: { lat: 1.5533, lng: 110.3592 },
  Miri: { lat: 4.4148, lng: 113.9885 },
  Sibu: { lat: 2.287, lng: 111.8305 },
  Bintulu: { lat: 3.1667, lng: 113.0333 },
  Samarahan: { lat: 1.4589, lng: 110.4936 },
  "Sri Aman": { lat: 1.2373, lng: 111.4649 },
  Sarikei: { lat: 2.1281, lng: 111.517 },
  Betong: { lat: 1.4048, lng: 111.5261 },
  Mukah: { lat: 2.8973, lng: 112.0813 },
  Limbang: { lat: 4.75, lng: 115.0 },
  Kapit: { lat: 1.995, lng: 112.933 },
  Bau: { lat: 1.4167, lng: 110.1333 },
  Serian: { lat: 1.1667, lng: 110.5833 },
  Lawas: { lat: 4.85, lng: 115.4 },
};
const DISTRICT_BIAS_RADIUS_M = 60000; // 60km around each town center.

type TextSearchResult = {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
};

type PullState = {
  lastRun: string | null;
};

function readState(): PullState {
  if (!existsSync(STATE_FILE)) return { lastRun: null };
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { lastRun: null };
  }
}

function writeState(state: PullState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function textSearch(
  apiKey: string,
  query: string,
  district: string
): Promise<TextSearchResult[]> {
  const results: TextSearchResult[] = [];
  let pageToken: string | undefined;
  const coords = DISTRICT_COORDS[district];

  for (let page = 0; page < MAX_PAGES_PER_QUERY; page++) {
    const url = new URL(`${PLACES_API}/textsearch/json`);
    url.searchParams.set("key", apiKey);

    if (pageToken) {
      url.searchParams.set("pagetoken", pageToken);
      await sleep(NEXT_PAGE_DELAY_MS);
    } else {
      url.searchParams.set("query", query);
    }

    let res = await fetch(url.toString());
    let data = await res.json();

    // A fresh page token is occasionally not active yet even after the
    // initial delay; give it one more short wait before giving up.
    if (pageToken && data.status === "INVALID_REQUEST") {
      await sleep(NEXT_PAGE_DELAY_MS);
      res = await fetch(url.toString());
      data = await res.json();
    }

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(`    search failed (${data.status}): ${data.error_message ?? "unknown error"}`);
      break;
    }

    results.push(...(data.results ?? []));

    pageToken = data.next_page_token;
    if (!pageToken) break;
  }

  return results;
}

async function fetchPlaceDetails(
  apiKey: string,
  placeId: string
): Promise<GooglePlaceDetails | null> {
  const url = new URL(`${PLACES_API}/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "name,formatted_address,address_components,geometry,rating,photos,types,website,url"
  );
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") {
    console.error(`  Failed to fetch details for ${placeId}: ${data.status}`);
    return null;
  }

  const result = data.result;
  let imageUrl: string | null = null;

  if (result.photos?.[0]?.photo_reference) {
    const photoUrl = new URL(`${PLACES_API}/photo`);
    photoUrl.searchParams.set("maxwidth", "800");
    photoUrl.searchParams.set("photo_reference", result.photos[0].photo_reference);
    photoUrl.searchParams.set("key", apiKey);
    imageUrl = photoUrl.toString();
  }

  const menuImages: string[] = (result.photos ?? [])
    .slice(0, 5)
    .map((photo: { photo_reference: string }) => {
      const url = new URL(`${PLACES_API}/photo`);
      url.searchParams.set("maxwidth", "800");
      url.searchParams.set("photo_reference", photo.photo_reference);
      url.searchParams.set("key", apiKey);
      return url.toString();
    });

  return {
    name: result.name,
    address: result.formatted_address,
    latitude: result.geometry?.location?.lat ?? null,
    longitude: result.geometry?.location?.lng ?? null,
    rating: result.rating ?? null,
    image_url: imageUrl,
    menu_images: menuImages,
    website: result.website ?? null,
    google_maps_url: result.url ?? null,
    types: result.types ?? [],
    address_components: result.address_components ?? [],
  };
}

async function alreadyImported(
  postgrestUrl: string,
  table: TableKey,
  placeId: string
): Promise<boolean> {
  const res = await fetch(
    `${postgrestUrl}/${table}?google_place_id=eq.${encodeURIComponent(placeId)}&select=id&limit=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    throw new Error(`Lookup failed for ${table} (${res.status})`);
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function insertRecord(
  postgrestUrl: string,
  table: TableKey,
  payload: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${postgrestUrl}/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=ignore-duplicates",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    // A unique-constraint violation here means another process (or a
    // race with itself) already inserted this place -- not an error.
    if (res.status === 409 || /duplicate key|unique/i.test(text)) {
      return;
    }
    throw new Error(`Insert failed for ${table}: ${res.status} ${text}`);
  }
}

async function pullTable(
  apiKey: string,
  postgrestUrl: string,
  table: TableKey
): Promise<{ scanned: number; imported: number; skipped: number; byDistrict: Record<string, number> }> {
  const category = CATEGORY_TERMS[table];
  console.log(`\n[${table}] category: "${category}"`);

  let scanned = 0;
  let imported = 0;
  let skipped = 0;
  const byDistrict: Record<string, number> = {};
  const seenThisRun = new Set<string>();

  for (const district of SARAWAK_DISTRICTS) {
    const query = `${category} in ${district}, Sarawak, Malaysia`;
    const results = await textSearch(apiKey, query, district);
    scanned += results.length;
    byDistrict[district] = 0;

    for (const result of results) {
      if (seenThisRun.has(result.place_id)) continue;
      seenThisRun.add(result.place_id);

      const rating = result.rating ?? 0;
      const address = result.formatted_address ?? "";

      if (rating < MIN_RATING) {
        skipped++;
        continue;
      }
      if (!address.toLowerCase().includes(REGION_KEYWORD.toLowerCase())) {
        skipped++;
        continue;
      }

      const exists = await alreadyImported(postgrestUrl, table, result.place_id);
      if (exists) {
        skipped++;
        continue;
      }

      const details = await fetchPlaceDetails(apiKey, result.place_id);
      if (!details) {
        skipped++;
        continue;
      }

      const payload = buildGoogleImportPayload(table, details, result.place_id, "published");

      try {
        await insertRecord(postgrestUrl, table, payload);
        imported++;
        byDistrict[district]++;
        console.log(`  + [${district}] imported: ${details.name}`);
      } catch (err) {
        skipped++;
        console.error(`  ! [${district}] failed to import ${details.name}:`, (err as Error).message);
      }
    }

    await sleep(BETWEEN_QUERY_DELAY_MS);
  }

  return { scanned, imported, skipped, byDistrict };
}

async function main() {
  const force = process.argv.includes("--force");
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const postgrestUrl = (process.env.POSTGREST_URL || "http://localhost:3001").replace(/\/$/, "");

  if (!apiKey) {
    console.error("GOOGLE_PLACES_API_KEY is not set. Aborting.");
    process.exit(1);
  }

  const state = readState();

  if (!force && state.lastRun) {
    const daysSinceLastRun = (Date.now() - new Date(state.lastRun).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastRun < PULL_INTERVAL_DAYS) {
      const daysLeft = (PULL_INTERVAL_DAYS - daysSinceLastRun).toFixed(1);
      console.log(
        `Last pull was ${daysSinceLastRun.toFixed(1)} day(s) ago. Next pull in ${daysLeft} day(s). Skipping. (use --force to override)`
      );
      return;
    }
  }

  console.log(
    `Starting Google Places pull (Sarawak-wide, ${SARAWAK_DISTRICTS.length} districts, ${MIN_RATING}★+)...`
  );

  const summary: Record<
    string,
    { scanned: number; imported: number; skipped: number; byDistrict: Record<string, number> }
  > = {};

  for (const table of ALL_TABLES) {
    summary[table] = await pullTable(apiKey, postgrestUrl, table);
  }

  writeState({ lastRun: new Date().toISOString() });

  console.log("\n--- Summary ---");
  let totalImported = 0;
  for (const [table, stats] of Object.entries(summary)) {
    console.log(
      `${table}: scanned ${stats.scanned}, imported ${stats.imported}, skipped ${stats.skipped}`
    );
    totalImported += stats.imported;
  }

  console.log("\n--- Imports by district ---");
  const districtTotals: Record<string, number> = {};
  for (const stats of Object.values(summary)) {
    for (const [district, count] of Object.entries(stats.byDistrict)) {
      districtTotals[district] = (districtTotals[district] ?? 0) + count;
    }
  }
  for (const district of SARAWAK_DISTRICTS) {
    console.log(`${district}: ${districtTotals[district] ?? 0}`);
  }

  console.log(`\nDone. ${totalImported} new record(s) imported. Next pull in ${PULL_INTERVAL_DAYS} days.`);
}

main().catch((err) => {
  console.error("Pull failed:", err);
  process.exit(1);
});
