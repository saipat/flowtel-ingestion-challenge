import pg from "pg";

export function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return new pg.Pool({ connectionString: url, max: 10 });
}