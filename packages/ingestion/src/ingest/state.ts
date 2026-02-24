import type { Pool } from "pg";

export type IngestionState = {
  cursor: string | null;
  ingested_count: number;
  last_event_id: string | null;
};

export async function loadState(pool: Pool): Promise<IngestionState> {
  const res = await pool.query(
    "SELECT cursor, ingested_count, last_event_id FROM ingestion_state WHERE id=1"
  );
  const row = res.rows[0];
  return {
    cursor: row?.cursor ?? null,
    ingested_count: Number(row?.ingested_count ?? 0),
    last_event_id: row?.last_event_id ?? null
  };
}

export async function saveState(
  pool: Pool,
  next: Partial<IngestionState>
): Promise<void> {
  await pool.query(
    `
    UPDATE ingestion_state
    SET
      cursor = COALESCE($1, cursor),
      ingested_count = COALESCE($2, ingested_count),
      last_event_id = COALESCE($3, last_event_id),
      updated_at = now()
    WHERE id=1
    `,
    [next.cursor ?? null, next.ingested_count ?? null, next.last_event_id ?? null]
  );
}