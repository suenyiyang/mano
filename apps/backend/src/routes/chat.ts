import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import {
  findActiveGeneration,
  findGenerationByResponseId,
  insertActiveGeneration,
  updateGenerationStatus,
} from "../db/queries/active-generations.js";
import { getNextOrdinal, insertMessage } from "../db/queries/messages.js";
import { findSessionById } from "../db/queries/sessions.js";
import { findEventsAfter, insertSseEvent } from "../db/queries/sse-events.js";
import { generateResponseId } from "../lib/id.js";
import { createSseStream, SSE_HEADERS } from "../lib/sse.js";
import { authMiddleware } from "../middleware/auth.js";
import { conflict, forbidden, notFound } from "../middleware/error-handler.js";

const chatSendSchema = z.object({
  content: z.string().min(1),
  attachments: z.array(z.string()).optional(),
});

const chatTerminateSchema = z.object({
  responseId: z.string().min(1),
});

const chatRespondSchema = z.object({
  responseId: z.string().min(1),
  toolCallId: z.string().min(1),
  type: z.enum(["ask_user_answer", "hitl_approval"]),
  payload: z.object({
    answer: z.string().optional(),
    selectedOptions: z.array(z.string()).optional(),
    approved: z.boolean().optional(),
    reason: z.string().optional(),
  }),
});

// Track active AbortControllers for cancellation
const activeControllers = new Map<string, AbortController>();

export const chatRoutes = new Hono<AppEnv>();

chatRoutes.use("/*", authMiddleware);

// Send message and get SSE response
chatRoutes.post("/:id/chat/send", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  // Check for existing active generation
  const existing = await findActiveGeneration(db, session.id);
  if (existing) {
    throw conflict("A generation is already in progress for this session");
  }

  const body = chatSendSchema.parse(await c.req.json());
  const responseId = generateResponseId();

  // Insert user message
  const ordinal = await getNextOrdinal(db, session.id);
  await insertMessage(db, {
    sessionId: session.id,
    role: "user",
    content: body.content,
    ordinal,
    responseId,
  });

  // Track active generation
  await insertActiveGeneration(db, { responseId, sessionId: session.id });

  // Set up abort controller
  const controller = new AbortController();
  activeControllers.set(responseId, controller);

  const stream = createSseStream(async (send) => {
    try {
      send("0", "response_start", { responseId });

      // TODO: Wire up the actual agent loop here
      // For now, echo back a placeholder response
      const assistantOrdinal = ordinal + 1;

      send("1", "text_delta", { text: "I received your message: " });
      send("2", "text_delta", { text: body.content });

      // Save assistant message
      const assistantMessage = await insertMessage(db, {
        sessionId: session.id,
        role: "assistant",
        content: `I received your message: ${body.content}`,
        ordinal: assistantOrdinal,
        responseId,
      });

      // Store SSE events for resume
      await insertSseEvent(db, {
        responseId,
        sessionId: session.id,
        eventType: "message_complete",
        data: { message: assistantMessage },
      });

      send("3", "message_complete", { message: assistantMessage });
      send("4", "done", { usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } });

      await updateGenerationStatus(db, responseId, "completed");
    } catch (error) {
      await updateGenerationStatus(db, responseId, "failed");
      throw error;
    } finally {
      activeControllers.delete(responseId);
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
});

// Terminate in-progress generation
chatRoutes.post("/:id/chat/terminate", async (c) => {
  const body = chatTerminateSchema.parse(await c.req.json());

  const controller = activeControllers.get(body.responseId);
  if (controller) {
    controller.abort();
    activeControllers.delete(body.responseId);
  }

  const db = c.var.db;
  await updateGenerationStatus(db, body.responseId, "cancelled");

  return c.json({ success: true });
});

// Respond to ask_user or HITL interrupt
chatRoutes.post("/:id/chat/respond", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  // Validate input shape even though we don't use it yet
  chatRespondSchema.parse(await c.req.json());

  // TODO: Wire up to the agent loop's interrupt mechanism
  // For now, acknowledge the response
  return c.json({ success: true, message: "Response acknowledged (agent loop not yet wired)" });
});

// Check for active generation
chatRoutes.get("/:id/chat/active", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  const active = await findActiveGeneration(db, session.id);
  if (active) {
    return c.json({ active: true, responseId: active.responseId });
  }
  return c.json({ active: false });
});

// Resume SSE stream
chatRoutes.get("/:id/chat/:responseId/resume", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  const responseId = c.req.param("responseId");
  const generation = await findGenerationByResponseId(db, responseId);
  if (!generation) {
    throw notFound("Generation not found");
  }

  const lastEventIdHeader = c.req.header("last-event-id");
  const afterId = lastEventIdHeader ? Number(lastEventIdHeader) : undefined;

  const stream = createSseStream(async (send) => {
    // Replay stored events
    const events = await findEventsAfter(db, responseId, afterId);
    for (const event of events) {
      send(String(event.id), event.eventType, event.data);
    }

    // If generation is still running, switch to live streaming
    if (generation.status === "running") {
      // TODO: Subscribe to live events from the agent loop
      // For now, just close after replaying stored events
      send("resume_end", "done", {
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
});
