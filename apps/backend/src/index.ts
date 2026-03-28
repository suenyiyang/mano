import { serve } from "@hono/node-server";
import app from "./app.js";
import { createDb } from "./db/index.js";
import { getEnv } from "./env.js";

const env = getEnv();
const db = createDb(env.DATABASE_URL);

// Set db on all API requests
app.use("/api/*", async (c, next) => {
  c.set("db", db);
  await next();
});

const port = env.PORT;
console.log(`Server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
