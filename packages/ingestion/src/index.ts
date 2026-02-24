// import "./discovery.js";
// import { initDb } from "./db/init.js";
// import { getPool } from "./db/pool.js";


// async function main() {
//   await initDb();

//   const pool = getPool();
//   const res = await pool.query("select now() as now, current_database() as db");
//   console.log("Connected to Postgres:", res.rows[0]);
//   await pool.end();
// }

// main().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });

import { runIngestion } from "./ingest/run.js";

runIngestion().catch((err) => {
  console.error(err);
  process.exit(1);
});