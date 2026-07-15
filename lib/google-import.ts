import type { TableKey } from "./types";
import type { GooglePlaceDetails } from "./postgrest";

const SARAWAK_DISTRICTS = [
  "Kuching",
  "Miri",
  "Sibu",
  "Bintulu",
  "Samarahan",
  "Sri Aman",
  "Sarikei",
  "Betong",
  "Mukah",
  "Limbang",
  "Kapit",
  "Bau",
  "Serian",
  "Lawas",
];

const PLACE_TYPE_LABELS: Record<string, string> = {
  tourist_attraction: "Landmark",
  museum: "Museum",
  park: "Nature",
  natural_feature: "Nature",
  beach: "Beach",
  church: "Culture",
  hindu_temple: "Culture",
  mosque: "Culture",
  art_gallery: "Culture",
  shopping_mall: "Shopping",
  point_of_interest: "Landmark",
};

const RESTAURANT_TYPE_LABELS: Record<string, string> = {
  restaurant: "restaurant",
  food: "restaurant",
  cafe: "cafe",
  bakery: "bakery",
  meal_takeaway: "takeaway",
  meal_delivery: "delivery",
};

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function extractDistrict(
  address: string,
  addressComponents?: GooglePlaceDetails["address_components"]
): string | null {
  if (addressComponents?.length) {
    for (const component of addressComponents) {
      if (
        component.types.includes("locality") ||
        component.types.includes("administrative_area_level_2")
      ) {
        return component.long_name;
      }
    }
  }

  for (const district of SARAWAK_DISTRICTS) {
    if (address.toLowerCase().includes(district.toLowerCase())) {
      return district;
    }
  }

  return null;
}

export function mapCategory(
  table: TableKey,
  types: string[] = []
): string | null {
  for (const type of types) {
    if (table === "restaurants" && RESTAURANT_TYPE_LABELS[type]) {
      return RESTAURANT_TYPE_LABELS[type];
    }
    if (table === "places" && PLACE_TYPE_LABELS[type]) {
      return PLACE_TYPE_LABELS[type];
    }
  }

  const fallback = types.find((type) => !type.startsWith("establishment"));
  return fallback ? titleCase(fallback.replaceAll("_", " ")) : null;
}

export function buildGoogleImportPayload(
  table: TableKey,
  details: GooglePlaceDetails,
  placeId: string
): Record<string, unknown> {
  const district = extractDistrict(
    details.address,
    details.address_components
  );
  const category = mapCategory(table, details.types);
  const nameField = table === "places" || table === "events" ? "title" : "name";

  const payload: Record<string, unknown> = {
    [nameField]: details.name,
    address: details.address,
    latitude: details.latitude,
    longitude: details.longitude,
    rating: details.rating,
    image_url: details.image_url,
    status: "draft",
  };

  if (table === "restaurants") {
    if (category) payload.category = category;
    if (district) payload.district = district;
    payload.halal_status = "unknown";
    payload.menu_images = details.menu_images ?? [];
    payload.google_place_id = placeId;
  }

  if (table === "places") {
    if (category) payload.category = category;
    if (district) payload.region = district.toLowerCase();
    payload.source = "google";
    payload.content_type = "landmark";
    payload.google_place_id = placeId;
    if (details.website) payload.website = details.website;
  }

  if (table === "stays" || table === "tours") {
    if (district) payload.district = district;
    if (details.website) payload.website = details.website;
  }

  if (table === "events") {
    if (district) payload.district = district;
    if (details.website) payload.registration_url = details.website;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== null && value !== undefined && value !== ""
    )
  );
}
