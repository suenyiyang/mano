import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { healthRoutes } from "./routes/health.js";

const app = new Hono();

app.route("/api", healthRoutes);

app.get("/", (c) => c.json({ message: "Mano API" }));

const port = Number(process.env.PORT) || 3000;
console.log(`Server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
