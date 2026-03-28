import { Hono } from "hono";
import { healthRoutes } from "./routes/health.js";

const app = new Hono();

app.route("/api", healthRoutes);

app.get("/", (c) => c.json({ message: "Mano API" }));

export default app;
