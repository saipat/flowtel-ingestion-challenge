import { getPool } from "../db/pool.js";
import { initDb } from "../db/init.js";
import { loadState, saveState } from "./state.js";
import { fetchEventsPage } from "../api/events.js";
import { insertEvents } from "../db/insertEvents.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function computeWaitMs(headers: Record<string, string>) {
  const remaining = Number(headers["x-ratelimit-remaining"]);
  const reset = Number(headers["x-ratelimit-reset"]);

  if (!Number.isFinite(remaining) || !Number.isFinite(reset)) {
    return 6200;
  }

  if (remaining <= 0) return Math.max(0, reset * 1000 + 250);

  const spacing = (reset / Math.max(remaining, 1)) * 1000;
  return Math.max(250, Math.ceil(spacing));
}

export async function runIngestion() {
  await initDb();

  const base = process.env.API_BASE_URL;
  const key = process.env.API_KEY;

  if (!base) throw new Error("API_BASE_URL missing");
  if (!key) throw new Error("API_KEY missing");

  const pool = getPool();
  const state = await loadState(pool);

  let cursor = state.cursor;
  let ingestedCount = state.ingested_count;

  // ---------------- graceful shutdown ----------------
  let shouldStop = false;

  process.on("SIGINT", () => {
    console.log("SIGINT received. Stopping after current page...");
    shouldStop = true;
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Stopping after current page...");
    shouldStop = true;
  });

  // ---------------- catch-up mode logic ----------------
  let catchupMode = false;
  const originalLastId = state.last_event_id;

  function enableCatchup(reason: string) {
    if (ingestedCount > 0 && originalLastId) {
      catchupMode = true;
      console.log(
        `Catch-up mode enabled (${reason}). Fast-forwarding to last saved position...`
      );
    }
  }

  if (!cursor) enableCatchup("no cursor on startup");

  const limit = 5000;

  console.log("Starting ingestion", {
    limit,
    resumeCursor: cursor ? cursor.slice(0, 20) + "..." : null,
    ingestedCount
  });

  const startedAt = Date.now();
  let page = 0;

  while (true) {
    page += 1;

    const { status, headers, json } = await fetchEventsPage({
      base,
      apiKey: key,
      limit,
      cursor
    });

    // ---------------- cursor expired handling ----------------
    if (status === 400 && cursor) {
      console.log("Cursor expired. Restarting ingestion safely...");
      cursor = null;
      enableCatchup("cursor expired");
      continue;
    }

    if (status !== 200) {
      throw new Error(`API status ${status}`);
    }

    const pageLastId = json.data.length
      ? json.data[json.data.length - 1].id
      : null;

    let inserted = 0;

    // ---------------- catch-up vs normal insert ----------------
    if (catchupMode) {
      const reached = originalLastId && json.data.some((e) => e.id === originalLastId);

      // Only exit catch-up mode when we see NEW rows actually insert
      if (reached) {
        inserted = await insertEvents(pool, json.data);
        if (inserted > 0) {
          ingestedCount += inserted;
          catchupMode = false;
          console.log("Catch-up complete (new rows detected). Resuming normal inserts.");
        } else {
          console.log("Still replaying after reaching last id. Continuing catch-up...");
        }
      }
    } else {
      inserted = await insertEvents(pool, json.data);
      ingestedCount += inserted;

      if (inserted === 0 && ingestedCount > 0) {
        console.log("Detected replay / duplicate window. Enabling catch-up mode...");
        catchupMode = true;
      }
    }

    // ---------------- checkpoint save ----------------
    cursor = json.pagination?.nextCursor ?? null;

    await saveState(pool, {
      cursor,
      ingested_count: ingestedCount,
      last_event_id: pageLastId
    });

    if (page % 5 === 0) {
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const rate = Math.round(ingestedCount / Math.max(elapsedSec, 1));

      const remaining = headers["x-ratelimit-remaining"];
      const reset = headers["x-ratelimit-reset"];

      console.log(
        `page=${page} inserted=${inserted} total=${ingestedCount} rate=${rate}/s remaining=${remaining} reset=${reset}s hasMore=${json.pagination?.hasMore} catchup=${catchupMode}`
      );
    }

    if (shouldStop) {
      console.log("Graceful shutdown complete. Progress saved.");
      break;
    }

    const hasMore = json.pagination?.hasMore;
    const total = json.meta?.total;

    // If API omits hasMore sometimes, keep going as long as we have a cursor or meta.total says there’s more.
    const shouldContinue =
      hasMore === true ||
      (hasMore == null && (!!json.pagination?.nextCursor || (typeof total === "number" && ingestedCount < total)));

    if (!shouldContinue) {
      console.log("Done. Total ingested:", ingestedCount);
      break;
    }

    const waitMs = computeWaitMs(headers);
    await sleep(waitMs);
  }

  await pool.end();
}
