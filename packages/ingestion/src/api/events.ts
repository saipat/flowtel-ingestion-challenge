import { request } from "undici";

export type EventRow = {
  id: string;
  timestamp?: number | string;
  type?: string;
  name?: string;
  [k: string]: any;
};

export type EventsResponse = {
  data: EventRow[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
    cursorExpiresIn?: number;
  };
  meta?: {
    total?: number;
    returned?: number;
    requestId?: string;
  };
};

function headerMap(h: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (h && typeof h.entries === "function") {
    for (const [k, v] of h.entries()) out[String(k).toLowerCase()] = String(v);
    return out;
  }
  if (h && typeof h === "object") {
    for (const k of Object.keys(h)) out[String(k).toLowerCase()] = String(h[k]);
    return out;
  }
  return out;
}

export async function fetchEventsPage(params: {
  base: string;
  apiKey: string;
  limit: number;
  cursor?: string | null;
}) {
  const makeUrl = () =>
    params.cursor
      ? `${params.base}/events?limit=${params.limit}&cursor=${encodeURIComponent(params.cursor)}`
      : `${params.base}/events?limit=${params.limit}`;

  const maxAttempts = 8;
  let attempt = 0;
  let backoffMs = 500;

  while (true) {
    attempt += 1;
    const url = makeUrl();

    try {
      const res = await request(url, {
        method: "GET",
        headers: { "x-api-key": params.apiKey, accept: "application/json" }
      });

      const headers = headerMap(res.headers);
      const text = await res.body.text();

      // Retry on gateway / server errors
      if (res.statusCode === 504 || (res.statusCode >= 500 && res.statusCode <= 599)) {
        if (attempt >= maxAttempts) {
          throw new Error(`Server error ${res.statusCode} after ${attempt} attempts`);
        }
        await new Promise((r) => setTimeout(r, backoffMs));
        backoffMs = Math.min(backoffMs * 2, 10_000);
        continue;
      }

      // Cursor errors handled upstream (400)
      let json: EventsResponse;
      try {
        json = JSON.parse(text);
      } catch {
        // If it’s not JSON and it's not 2xx, treat as retryable sometimes
        if (res.statusCode === 504) {
          if (attempt >= maxAttempts) {
            throw new Error(`Non-JSON response (status ${res.statusCode}): ${text.slice(0, 200)}`);
          }
          await new Promise((r) => setTimeout(r, backoffMs));
          backoffMs = Math.min(backoffMs * 2, 10_000);
          continue;
        }
        throw new Error(`Non-JSON response (status ${res.statusCode}): ${text.slice(0, 200)}`);
      }

      return { status: res.statusCode, headers, json };
    } catch (err: any) {
      // Network / socket errors: retry
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs = Math.min(backoffMs * 2, 10_000);
    }
  }
}