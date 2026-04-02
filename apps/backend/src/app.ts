import { Hono } from "hono";
import { createDb, type Db } from "./db/index.js";
import { getEnv } from "./env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { attachmentRoutes } from "./routes/attachments.js";
import { authRoutes } from "./routes/auth.js";
import { chatRoutes } from "./routes/chat.js";
import { healthRoutes } from "./routes/health.js";
import { mcpServerRoutes } from "./routes/mcp-servers.js";
import { messageRoutes } from "./routes/messages.js";
import { sessionRoutes } from "./routes/sessions.js";
import { skillRoutes } from "./routes/skills.js";
import { subscriptionRoutes } from "./routes/subscriptions.js";
import { webhookRoutes } from "./routes/webhooks.js";

export type AppEnv = {
  Variables: {
    db: Db;
    userId: string;
    userTier: string;
  };
};

const app = new Hono<AppEnv>();

// Global middleware
app.use("/api/*", requestId);
app.use("/api/*", errorHandler);

// DB middleware — must be before routes (lazy init to avoid env validation at import time)
let db: Db | undefined;
app.use("/api/*", async (c, next) => {
  if (!db) {
    db = createDb(getEnv().DATABASE_URL);
  }
  c.set("db", db);
  await next();
});

// Routes
app.route("/api", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/sessions", sessionRoutes);
app.route("/api/sessions", messageRoutes);
app.route("/api/sessions", chatRoutes);
app.route("/api/attachments", attachmentRoutes);
app.route("/api/skills", skillRoutes);
app.route("/api/mcp-servers", mcpServerRoutes);
app.route("/api/subscriptions", subscriptionRoutes);
app.route("/api/webhooks", webhookRoutes);

app.get("/", (c) => c.json({ message: "Mano API" }));

export default app;
