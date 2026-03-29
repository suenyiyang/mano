import { EventEmitter } from "node:events";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import type { Db } from "../db/index.js";
import {
  findActiveGeneration,
  findGenerationByResponseId,
  insertActiveGeneration,
  updateGenerationStatus,
} from "../db/queries/active-generations.js";
import { findAllMessagesBySession, getNextOrdinal, insertMessage } from "../db/queries/messages.js";
import { findEnabledModelsByTier } from "../db/queries/models.js";
import { addTokensToDailyUsage } from "../db/queries/rate-limits.js";
import { findSessionById } from "../db/queries/sessions.js";
import { findEventsAfter, insertSseEvent } from "../db/queries/sse-events.js";
import {
  createAgentForSession,
  createModelInstance,
  dbMessagesToLangChain,
  pickModel,
} from "../lib/agent.js";
import { generateResponseId } from "../lib/id.js";
import { createSseStream, SSE_HEADERS, type SseSender } from "../lib/sse.js";
import { authMiddleware } from "../middleware/auth.js";
import { badRequest, conflict, forbidden, notFound } from "../middleware/error-handler.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";

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

// Track active AbortControllers and EventEmitters for cancellation and resume
const activeControllers = new Map<string, AbortController>();
const activeEmitters = new Map<string, EventEmitter>();

// Track pending ask_user questions: responseId -> resolver
const pendingAskUser = new Map<string, { resolve: (answer: string) => void }>();

interface SseEvent {
  id: string;
  event: string;
  data: unknown;
}

/**
 * Helper: send an SSE event, persist it, and broadcast for resume subscribers.
 */
const createEventSender = (
  db: Db,
  responseId: string,
  sessionId: string,
  send: SseSender,
  emitter: EventEmitter,
) => {
  let counter = 0;

  return async (event: string, data: unknown) => {
    const id = String(counter++);
    send(id, event, data);

    // Persist for resume
    const stored = await insertSseEvent(db, {
      responseId,
      sessionId,
      eventType: event,
      data,
    });

    // Broadcast for live resume subscribers
    emitter.emit("event", { id: String(stored.id), event, data } satisfies SseEvent);
  };
};

export const chatRoutes = new Hono<AppEnv>();

chatRoutes.use("/*", authMiddleware);

// Send message and get SSE response
chatRoutes.post("/:id/chat/send", rateLimitMiddleware, async (c) => {
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

  // Set up abort controller and emitter for resume
  const controller = new AbortController();
  activeControllers.set(responseId, controller);
  const emitter = new EventEmitter();
  activeEmitters.set(responseId, emitter);

  const stream = createSseStream(async (send) => {
    const emit = createEventSender(db, responseId, session.id, send, emitter);

    // MCP manager reference for cleanup
    let mcpManager: Awaited<ReturnType<typeof createAgentForSession>>["mcpManager"] | undefined;

    try {
      await emit("response_start", { responseId });

      // Load model for this session's tier
      const models = await findEnabledModelsByTier(db, session.modelTier);
      if (models.length === 0) {
        throw new Error(`No enabled models for tier "${session.modelTier}"`);
      }
      const modelRow = pickModel(models);
      const model = createModelInstance(modelRow);

      // Create ask_user resolver that blocks until user responds via /respond
      const askUserResolver = (_question: string, _options?: string[]): Promise<string> => {
        return new Promise((resolve) => {
          pendingAskUser.set(responseId, { resolve });
        });
      };

      // Create agent with all tools
      const result = await createAgentForSession({
        model,
        systemPrompt: session.systemPrompt,
        db,
        userId: c.var.userId,
        askUserResolver,
      });
      mcpManager = result.mcpManager;
      const agent = result.agent;

      // Build conversation history
      const dbMessages = await findAllMessagesBySession(db, session.id);
      const langchainMessages = dbMessagesToLangChain(dbMessages);

      // Stream agent events
      let nextOrdinal = ordinal + 1;
      let accumulatedText = "";
      const toolCallNames = new Map<string, string>();
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      const eventStream = agent.streamEvents(
        { messages: langchainMessages },
        { version: "v2", signal: controller.signal },
      );

      for await (const event of eventStream) {
        if (controller.signal.aborted) break;

        // LLM token streaming
        if (event.event === "on_chat_model_stream") {
          const chunk = event.data?.chunk;
          if (!chunk) continue;

          // Text content
          const textContent =
            typeof chunk.content === "string"
              ? chunk.content
              : Array.isArray(chunk.content)
                ? chunk.content
                    .filter((b: { type: string }) => b.type === "text")
                    .map((b: { text: string }) => b.text)
                    .join("")
                : "";

          if (textContent) {
            accumulatedText += textContent;
            await emit("text_delta", { text: textContent });
          }

          // Tool call chunks
          const toolChunks = chunk.tool_call_chunks;
          if (Array.isArray(toolChunks)) {
            for (const tc of toolChunks) {
              if (tc.id && tc.name && !toolCallNames.has(tc.id)) {
                toolCallNames.set(tc.id, tc.name);
                await emit("tool_call_start", {
                  toolCallId: tc.id,
                  name: tc.name,
                });
              }
              if (tc.args) {
                await emit("tool_call_delta", {
                  toolCallId: tc.id ?? tc.index?.toString(),
                  argumentsDelta: tc.args,
                });
              }
            }
          }
        }

        // LLM finished generating (may have tool calls)
        if (event.event === "on_chat_model_end") {
          const output = event.data?.output;
          const toolCalls = output?.tool_calls;

          // Emit tool_call_end for each tool call
          if (Array.isArray(toolCalls)) {
            for (const tc of toolCalls) {
              await emit("tool_call_end", { toolCallId: tc.id });

              // Emit ask_user SSE event when agent calls ask_user
              if (tc.name === "ask_user") {
                await emit("ask_user", {
                  toolCallId: tc.id,
                  question: tc.args?.question,
                  options: tc.args?.options,
                });
              }
            }
          }

          // Extract usage if available
          const usage = output?.usage_metadata;
          if (usage) {
            totalUsage = {
              promptTokens: usage.input_tokens ?? 0,
              completionTokens: usage.output_tokens ?? 0,
              totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
            };
          }

          // Persist assistant message
          if (accumulatedText || (Array.isArray(toolCalls) && toolCalls.length > 0)) {
            const assistantMessage = await insertMessage(db, {
              sessionId: session.id,
              role: "assistant",
              content: accumulatedText || "",
              toolCalls: toolCalls ?? undefined,
              ordinal: nextOrdinal++,
              modelId: modelRow.apiModelId,
              responseId,
              tokenUsage: totalUsage,
            });

            await emit("message_complete", { message: assistantMessage });
          }

          // Reset for next LLM turn (after tool execution)
          accumulatedText = "";
        }

        // Tool execution completed
        if (event.event === "on_tool_end") {
          const output = event.data?.output;
          // output is a ToolMessage or a string
          const content =
            typeof output === "string"
              ? output
              : typeof output?.content === "string"
                ? output.content
                : JSON.stringify(output?.content ?? output);

          const toolCallId = output?.tool_call_id ?? "";
          const toolName = output?.name ?? toolCallNames.get(toolCallId) ?? event.name ?? "";
          const isError = output?.status === "error";

          // Persist tool message
          const toolMessage = await insertMessage(db, {
            sessionId: session.id,
            role: "tool",
            content,
            toolCallId,
            toolName,
            ordinal: nextOrdinal++,
            responseId,
          });

          await emit("tool_result", {
            toolCallId,
            content,
            isError,
          });

          await emit("message_complete", { message: toolMessage });
        }
      }

      // Auto-compaction: if total tokens exceed threshold, compact older messages.
      // DeepAgents' summarization middleware handles in-context compaction;
      // here we persist that state to DB for the compact_summary field.
      // We detect compaction by checking if the agent's context was trimmed
      // (indicated by the summarization middleware modifying the message list).
      // For now, emit done. The /compact endpoint handles explicit compaction.

      // Track token usage for rate limiting
      if (totalUsage.totalTokens > 0) {
        await addTokensToDailyUsage(db, c.var.userId, totalUsage.totalTokens);
      }

      await emit("done", { usage: totalUsage });
      await updateGenerationStatus(db, responseId, "completed");
    } catch (error) {
      if (controller.signal.aborted) {
        await updateGenerationStatus(db, responseId, "cancelled");
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        await emit("error", { error: message, code: "AGENT_ERROR" });
        await updateGenerationStatus(db, responseId, "failed");
      }
    } finally {
      activeControllers.delete(responseId);
      pendingAskUser.delete(responseId);
      emitter.emit("done");
      activeEmitters.delete(responseId);
      // Clean up MCP connections
      if (mcpManager) {
        mcpManager.disconnectAll().catch(() => {});
      }
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
});

// Terminate in-progress generation
chatRoutes.post("/:id/chat/terminate", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  const body = chatTerminateSchema.parse(await c.req.json());

  // Verify the generation belongs to this session
  const generation = await findGenerationByResponseId(db, body.responseId);
  if (!generation || generation.sessionId !== session.id) {
    throw notFound("Generation not found for this session");
  }

  const controller = activeControllers.get(body.responseId);
  if (controller) {
    controller.abort();
    activeControllers.delete(body.responseId);
  }

  // Resolve any pending ask_user with empty answer to unblock the tool
  const pending = pendingAskUser.get(body.responseId);
  if (pending) {
    pending.resolve("");
    pendingAskUser.delete(body.responseId);
  }

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

  const body = chatRespondSchema.parse(await c.req.json());

  // Verify the generation belongs to this session and is running
  const generation = await findGenerationByResponseId(db, body.responseId);
  if (!generation || generation.sessionId !== session.id) {
    throw notFound("Generation not found for this session");
  }
  if (generation.status !== "running") {
    throw badRequest("Generation is not in progress");
  }

  if (body.type === "ask_user_answer") {
    const pending = pendingAskUser.get(body.responseId);
    if (!pending) {
      throw badRequest("No pending question for this response");
    }

    // Build the answer from payload
    const answer = body.payload.selectedOptions?.length
      ? body.payload.selectedOptions.join(", ")
      : (body.payload.answer ?? "");

    pending.resolve(answer);
    pendingAskUser.delete(body.responseId);

    return c.json({ success: true });
  }

  if (body.type === "hitl_approval") {
    // HITL approval resolves the pending ask_user with approval/rejection info
    // that the agent can interpret
    const pending = pendingAskUser.get(body.responseId);
    if (!pending) {
      throw badRequest("No pending approval for this response");
    }

    if (body.payload.approved) {
      pending.resolve("APPROVED");
    } else {
      pending.resolve(`REJECTED: ${body.payload.reason ?? "No reason provided"}`);
    }
    pendingAskUser.delete(body.responseId);

    return c.json({ success: true });
  }

  throw badRequest(`Unknown response type: ${body.type}`);
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

    // If generation is still running, subscribe to live events
    if (generation.status === "running") {
      const emitter = activeEmitters.get(responseId);
      if (emitter) {
        await new Promise<void>((resolve) => {
          const onEvent = (sseEvent: SseEvent) => {
            // Skip events we already replayed
            if (afterId !== undefined && Number(sseEvent.id) <= afterId) return;
            send(sseEvent.id, sseEvent.event, sseEvent.data);
          };

          const onDone = () => {
            emitter.off("event", onEvent);
            resolve();
          };

          emitter.on("event", onEvent);
          emitter.once("done", onDone);
        });
      }
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
});
