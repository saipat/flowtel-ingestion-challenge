import { request } from "undici";

function headerMap(h: any): Record<string, string> {
  const out: Record<string, string> = {};

  if (h && typeof h.entries === "function") {
    for (const [k, v] of h.entries()) out[String(k).toLowerCase()] = String(v);
    return out;
  }

  if (h && typeof h === "object") {
    for (const k of Object.keys(h)) out[String(k).toLowerCase()] = String((h as any)[k]);
    return out;
  }

  return out;
}

async function main() {
  const base = process.env.API_BASE_URL;
  const key = process.env.API_KEY;

  if (!base) throw new Error("API_BASE_URL missing");
  if (!key) throw new Error("API_KEY missing");

  const limits = [1000, 5000, 10000];

  for (const lim of limits) {
    const url = `${base}/events?limit=${lim}`;

    const res = await request(url, {
      method: "GET",
      headers: { "x-api-key": key, accept: "application/json" }
    });

    const headers = headerMap(res.headers);
    const text = await res.body.text();

    console.log(`\n==== limit ${lim} ====`);
    console.log("STATUS:", res.statusCode);
    console.log("x-ratelimit-limit:", headers["x-ratelimit-limit"]);
    console.log("x-ratelimit-remaining:", headers["x-ratelimit-remaining"]);
    console.log("x-ratelimit-reset:", headers["x-ratelimit-reset"]);
    console.log("body length:", text.length);

    try {
      const j = JSON.parse(text);
      console.log("returned:", j?.meta?.returned, "hasMore:", j?.pagination?.hasMore);
      console.log("cursorExpiresIn:", j?.pagination?.cursorExpiresIn);
    } catch {
      console.log("could not parse json");
    }

    // small delay so we don’t burn all remaining quickly
    await new Promise((r) => setTimeout(r, 1200));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});