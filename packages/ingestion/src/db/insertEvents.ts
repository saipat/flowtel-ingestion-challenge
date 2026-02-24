import type { Pool } from "pg";
import type { EventRow } from "../api/events.js";

function toTimestamptz(v: any): Date | null {
  // API shows timestamp can be millis (number) but docs warn formats vary
  if (v === null || v === undefined) return null;

  // millis number
  if (typeof v === "number") return new Date(v);

  // numeric string
  if (typeof v === "string" && /^\d+$/.test(v)) {
    const n = Number(v);
    if (Number.isFinite(n)) return new Date(n);
  }

  // ISO-ish string
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d;

  return null;
}

export async function insertEvents(pool: Pool, events: EventRow[]) {
  if (events.length === 0) return 0;

  // Multi-row insert with ON CONFLICT DO NOTHING
  // Keep columns minimal + store full JSON payload
  const values: any[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const idx = i * 5;

    const occurredAt = toTimestamptz(e.timestamp);
    const type = typeof e.type === "string" ? e.type : null;
    const source = typeof (e as any).source === "string" ? (e as any).source : null;

    values.push(e.id, occurredAt, type, source, e);
    placeholders.push(
      `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}::jsonb)`
    );
  }

  const sql = `
    INSERT INTO events (id, occurred_at, type, source, payload)
    VALUES ${placeholders.join(",")}
    ON CONFLICT (id) DO NOTHING
  `;

  const res = await pool.query(sql, values);
  // pg returns rowCount for inserted rows (excluding conflicts)
  return res.rowCount ?? 0;
}