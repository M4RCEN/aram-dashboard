import { NextRequest, NextResponse } from "next/server";

const POSTGREST_URL =
  process.env.POSTGREST_URL || "http://localhost:3001";

const FORWARD_REQUEST_HEADERS = ["accept", "content-type", "prefer", "range"];

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyRequest(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { path } = await context.params;
  const targetPath = path.join("/");
  const targetUrl = `${POSTGREST_URL.replace(/\/$/, "")}/${targetPath}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const response = await fetch(targetUrl, init);
    const responseHeaders = new Headers();

    const contentType = response.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);

    const contentRange = response.headers.get("content-range");
    if (contentRange) responseHeaders.set("content-range", contentRange);

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("PostgREST proxy error:", error);
    return NextResponse.json(
      {
        error: "Failed to reach PostgREST. Check POSTGREST_URL on the server.",
      },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
