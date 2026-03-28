import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(connectionString);
await migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("Migrations complete");
process.exit(0);
