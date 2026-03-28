import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export const createDb = (connectionString: string) => {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
};

export type Db = ReturnType<typeof createDb>;
