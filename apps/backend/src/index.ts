import { serve } from "@hono/node-server";
import app from "./app.js";
import { getEnv } from "./env.js";

const port = getEnv().PORT;
console.log(`Server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
