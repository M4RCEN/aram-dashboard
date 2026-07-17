import { NextRequest, NextResponse } from "next/server";

const PLACES_API = "https://maps.googleapis.com/maps/api/place";

// Rough bounding circle around Sarawak state, used to bias results
// toward the region. Combined with the "Sarawak, Malaysia" suffix and
// the address filter below, this keeps results limited to Sarawak.
const SARAWAK_LOCATION_BIAS = "circle:400000@2.5,113.0";
const REGION_KEYWORD = "sarawak";

type GooglePlacePhoto = { photo_reference: string };

type GooglePlaceResult = {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  photos?: GooglePlacePhoto[];
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const query = request.nextUrl.searchParams.get("query");

  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY is not configured" },
      { status: 500 }
    );
  }

  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const scopedQuery = query.toLowerCase().includes(REGION_KEYWORD)
      ? query
      : `${query}, Sarawak, Malaysia`;

    const searchUrl = new URL(`${PLACES_API}/textsearch/json`);
    searchUrl.searchParams.set("query", scopedQuery);
    searchUrl.searchParams.set("locationbias", SARAWAK_LOCATION_BIAS);
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString());
    const data = await searchRes.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        { error: data.error_message || "Place search failed" },
        { status: 502 }
      );
    }

    const results = ((data.results ?? []) as GooglePlaceResult[])
      .filter((place) =>
        (place.formatted_address ?? "").toLowerCase().includes(REGION_KEYWORD)
      )
      .slice(0, 8)
      .map((place) => {
        let photoUrl: string | null = null;

        if (place.photos?.[0]?.photo_reference) {
          const photoUrlObj = new URL(`${PLACES_API}/photo`);
          photoUrlObj.searchParams.set("maxwidth", "200");
          photoUrlObj.searchParams.set(
            "photo_reference",
            place.photos[0].photo_reference
          );
          photoUrlObj.searchParams.set("key", apiKey);
          photoUrl = photoUrlObj.toString();
        }

        return {
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address ?? "",
          rating: place.rating ?? null,
          user_ratings_total: place.user_ratings_total ?? null,
          photo_url: photoUrl,
        };
      });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Google Places search error:", error);
    return NextResponse.json(
      { error: "Failed to search places" },
      { status: 500 }
    );
  }
}
