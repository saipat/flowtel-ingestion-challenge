import { readFileSync } from "node:fs";
import { getPool } from "./pool.js";

export async function initDb() {
  const pool = getPool();

  const schemaPath = process.env.SCHEMA_PATH || "/app/schema.sql";
  const sql = readFileSync(schemaPath, "utf8");

  await pool.query(sql);
  await pool.end();
}