import { NextRequest, NextResponse } from "next/server";

const PLACES_API = "https://maps.googleapis.com/maps/api/place";

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = request.nextUrl.searchParams.get("place_id");

  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY is not configured" },
      { status: 500 }
    );
  }

  if (!placeId) {
    return NextResponse.json(
      { error: "place_id is required" },
      { status: 400 }
    );
  }

  try {
    const detailsUrl = new URL(`${PLACES_API}/details/json`);
    detailsUrl.searchParams.set("place_id", placeId);
    detailsUrl.searchParams.set(
      "fields",
      "name,formatted_address,geometry,rating,photos,types,website,url"
    );
    detailsUrl.searchParams.set("key", apiKey);

    const detailsRes = await fetch(detailsUrl.toString());
    const details = await detailsRes.json();

    if (details.status !== "OK") {
      return NextResponse.json(
        { error: details.error_message || "Place not found" },
        { status: 404 }
      );
    }

    const result = details.result;
    let imageUrl: string | null = null;

    if (result.photos?.[0]?.photo_reference) {
      const photoUrl = new URL(`${PLACES_API}/photo`);
      photoUrl.searchParams.set("maxwidth", "800");
      photoUrl.searchParams.set(
        "photo_reference",
        result.photos[0].photo_reference
      );
      photoUrl.searchParams.set("key", apiKey);
      imageUrl = photoUrl.toString();
    }

    const photoUrls: string[] = (result.photos ?? [])
      .slice(0, 5)
      .map((photo: { photo_reference: string }) => {
        const url = new URL(`${PLACES_API}/photo`);
        url.searchParams.set("maxwidth", "800");
        url.searchParams.set("photo_reference", photo.photo_reference);
        url.searchParams.set("key", apiKey);
        return url.toString();
      });

    return NextResponse.json({
      name: result.name,
      address: result.formatted_address,
      latitude: result.geometry?.location?.lat ?? null,
      longitude: result.geometry?.location?.lng ?? null,
      rating: result.rating ?? null,
      image_url: imageUrl,
      menu_images: photoUrls,
      website: result.website ?? null,
      google_maps_url: result.url ?? null,
    });
  } catch (error) {
    console.error("Google Places error:", error);
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 500 }
    );
  }
}
