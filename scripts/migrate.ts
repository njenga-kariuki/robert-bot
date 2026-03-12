import "../src/config.js";
import { initDb, migrate } from "../src/db/client.js";

async function main() {
  console.log("Running database migration...");
  await initDb();
  migrate();
  console.log("Migration complete.");
}

main().catch(console.error);
