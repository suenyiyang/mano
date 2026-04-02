import { EventEmitter } from "node:events";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import type { Db } from "../db/index.js";
import {
  acquireGenerationLock,
  findActiveGeneration,
  findGenerationByResponseId,
  updateGenerationStatus,
} from "../db/queries/active-generations.js";
import { calculateCreditCost, deductCredits } from "../db/queries/credits.js";
import {
  deleteNonUserMessagesByResponseId,
  findAllMessagesBySession,
  getNextOrdinal,
  insertMessage,
} from "../db/queries/messages.js";
import { selectModelForTier } from "../db/queries/model-tiers.js";
import { addTokensToDailyUsage } from "../db/queries/rate-limits.js";
import { findSessionById, updateSession } from "../db/queries/sessions.js";
import {
  deleteSseEventsByResponseId,
  findEventsAfter,
  insertSseEvent,
} from "../db/queries/sse-events.js";
import { createAgentForSession, createModelInstance, dbMessagesToLangChain } from "../lib/agent.js";
import { generateResponseId } from "../lib/id.js";
import type { ModelConfig } from "../lib/model-config.js";
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

const chatRetrySchema = z.object({
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

// Track pending ask_user questions: responseId -> { resolve, promise }
// The entry is created early (on_chat_model_end) so it's ready before the SSE event
// reaches the frontend. The resolver (inside the tool function) returns the same promise.
const pendingAskUser = new Map<
  string,
  { resolve: (answer: string) => void; promise: Promise<string> }
>();

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

/**
 * Generate a session title from the first user message and emit a session_update event.
 * Runs concurrently with the agent stream — does not block the response.
 */
const generateAndEmitTitle = async (
  db: Db,
  sessionId: string,
  userContent: string,
  modelConfig: ModelConfig,
  emit: (event: string, data: unknown) => Promise<void>,
) => {
  let title: string;

  if (userContent.length <= 10) {
    title = userContent;
  } else {
    const model = createModelInstance(modelConfig);
    const response = await model.invoke([
      new SystemMessage(
        "Generate a concise title (max 20 characters) for a conversation. Return ONLY the title text, no quotes, no explanation.",
      ),
      new HumanMessage(userContent),
    ]);
    title = (typeof response.content === "string" ? response.content : "").trim().slice(0, 30);
    if (!title) {
      title = userContent.slice(0, 20);
    }
  }

  const updated = await updateSession(db, sessionId, { title });
  if (updated) {
    await emit("session_update", { session: updated });
  }
};

/**
 * Shared agent streaming logic used by both /send and /retry.
 * Handles: response_start, agent creation, event streaming, message persistence,
 * error handling, and cleanup.
 */
const runAgentStream = async (opts: {
  db: Db;
  session: { id: string; systemPrompt: string | null; title: string | null };
  userId: string;
  responseId: string;
  controller: AbortController;
  emitter: EventEmitter;
  emit: (event: string, data: unknown) => Promise<void>;
  modelConfig: ModelConfig;
  model: ReturnType<typeof createModelInstance>;
  generateTitleContent?: string;
  creditConfig?: { creditsPerMillionInputTokens?: number; creditsPerMillionOutputTokens?: number };
}) => {
  const { db, session, userId, responseId, controller, emitter, emit, modelConfig, model } = opts;

  let mcpManager: Awaited<ReturnType<typeof createAgentForSession>>["mcpManager"] | undefined;

  try {
    await emit("response_start", { responseId });

    // Generate title for untitled sessions (fire-and-forget)
    if (opts.generateTitleContent && !session.title) {
      generateAndEmitTitle(db, session.id, opts.generateTitleContent, modelConfig, emit).catch(
        () => {},
      );
    }

    // Create ask_user resolver that blocks until user responds via /respond.
    const askUserResolver = (_question: string, _options?: string[]): Promise<string> => {
      const existing = pendingAskUser.get(responseId);
      if (existing) {
        return existing.promise;
      }
      let resolveRef!: (answer: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolveRef = resolve;
      });
      pendingAskUser.set(responseId, { resolve: resolveRef, promise });
      return promise;
    };

    // Create agent with all tools
    const result = await createAgentForSession({
      model,
      systemPrompt: session.systemPrompt ?? "",
      db,
      userId,
      askUserResolver,
    });
    mcpManager = result.mcpManager;
    const agent = result.agent;

    // Build conversation history
    const dbMessages = await findAllMessagesBySession(db, session.id);
    const langchainMessages = dbMessagesToLangChain(dbMessages);

    // Stream agent events
    let nextOrdinal = await getNextOrdinal(db, session.id);
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

        // Emit tool_call lifecycle events for each tool call
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            // Synthesize start+delta for models that don't stream tool_call_chunks
            if (!toolCallNames.has(tc.id)) {
              toolCallNames.set(tc.id, tc.name);
              await emit("tool_call_start", { toolCallId: tc.id, name: tc.name });
              if (tc.args) {
                await emit("tool_call_delta", {
                  toolCallId: tc.id,
                  argumentsDelta: JSON.stringify(tc.args),
                });
              }
            }
            await emit("tool_call_end", { toolCallId: tc.id });

            // Emit ask_user SSE event when agent calls ask_user.
            if (tc.name === "ask_user") {
              if (!pendingAskUser.has(responseId)) {
                let resolveRef!: (answer: string) => void;
                const promise = new Promise<string>((resolve) => {
                  resolveRef = resolve;
                });
                pendingAskUser.set(responseId, { resolve: resolveRef, promise });
              }
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
            modelId: modelConfig.apiModelId,
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

    // Track token usage and deduct credits
    if (totalUsage.totalTokens > 0) {
      await addTokensToDailyUsage(db, userId, totalUsage.totalTokens);

      if (opts.creditConfig) {
        const cost = calculateCreditCost(
          totalUsage.promptTokens,
          totalUsage.completionTokens,
          opts.creditConfig,
        );
        if (cost > 0) {
          await deductCredits(db, {
            userId,
            amount: cost,
            sessionId: session.id,
            modelId: modelConfig.apiModelId,
            description: `${modelConfig.displayName ?? modelConfig.apiModelId}: ${totalUsage.promptTokens} input + ${totalUsage.completionTokens} output tokens`,
          });
        }
      }
    }

    await emit("done", { usage: totalUsage });
    await updateGenerationStatus(db, responseId, "completed");
  } catch (error) {
    if (controller.signal.aborted) {
      await updateGenerationStatus(db, responseId, "cancelled");
    } else {
      // Unwrap nested MiddlewareError chain to find the true root cause
      let rootCause: unknown = error;
      while (rootCause instanceof Error && rootCause.cause instanceof Error) {
        rootCause = rootCause.cause;
      }
      const message = rootCause instanceof Error ? rootCause.message : "Unknown error";
      const stack = rootCause instanceof Error ? rootCause.stack : undefined;
      console.error("[AGENT_ERROR] Root cause:", rootCause);
      await emit("error", { error: message, code: "AGENT_ERROR", stack });
      await updateGenerationStatus(db, responseId, "failed");
    }
  } finally {
    activeControllers.delete(responseId);
    pendingAskUser.delete(responseId);
    emitter.emit("done");
    activeEmitters.delete(responseId);
    if (mcpManager) {
      mcpManager.disconnectAll().catch(() => {});
    }
  }
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

  const body = chatSendSchema.parse(await c.req.json());
  const responseId = generateResponseId();

  // Atomically acquire session lock and insert active generation.
  // Uses pg_advisory_xact_lock to prevent race conditions between tabs.
  const generation = await acquireGenerationLock(db, { responseId, sessionId: session.id });
  if (!generation) {
    throw conflict("A generation is already in progress for this session");
  }

  // Insert user message
  const ordinal = await getNextOrdinal(db, session.id);
  await insertMessage(db, {
    sessionId: session.id,
    role: "user",
    content: body.content,
    ordinal,
    responseId,
  });

  // Select model based on user tier
  const userTier = c.var.userTier;
  const selectedModel = await selectModelForTier(db, userTier);
  if (!selectedModel) {
    throw badRequest("No models available for your plan");
  }
  const modelConfig: ModelConfig = {
    provider: selectedModel.provider,
    apiModelId: selectedModel.apiModelId,
    displayName: selectedModel.displayName,
  };
  const creditConfig = selectedModel.config as {
    creditsPerMillionInputTokens?: number;
    creditsPerMillionOutputTokens?: number;
  };
  const model = createModelInstance(modelConfig);

  // Set up abort controller and emitter for resume
  const controller = new AbortController();
  activeControllers.set(responseId, controller);
  const emitter = new EventEmitter();
  activeEmitters.set(responseId, emitter);

  const stream = createSseStream(async (send) => {
    const emit = createEventSender(db, responseId, session.id, send, emitter);
    await runAgentStream({
      db,
      session,
      userId: c.var.userId,
      responseId,
      controller,
      emitter,
      emit,
      modelConfig,
      model,
      generateTitleContent: body.content,
      creditConfig,
    });
  });

  return new Response(stream, { headers: SSE_HEADERS });
});

// Retry a failed generation
chatRoutes.post("/:id/chat/retry", rateLimitMiddleware, async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  const body = chatRetrySchema.parse(await c.req.json());

  // Verify the generation exists, belongs to this session, and failed
  const generation = await findGenerationByResponseId(db, body.responseId);
  if (!generation || generation.sessionId !== session.id) {
    throw notFound("Generation not found for this session");
  }
  if (generation.status !== "failed") {
    throw badRequest("Can only retry a failed generation");
  }

  // Clean up the failed generation's partial messages (keep user message)
  await deleteNonUserMessagesByResponseId(db, body.responseId);
  await deleteSseEventsByResponseId(db, body.responseId);

  // Start a new generation with a fresh responseId
  const responseId = generateResponseId();
  const newGeneration = await acquireGenerationLock(db, { responseId, sessionId: session.id });
  if (!newGeneration) {
    throw conflict("A generation is already in progress for this session");
  }

  // Select model based on user tier
  const userTier = c.var.userTier;
  const selectedModel = await selectModelForTier(db, userTier);
  if (!selectedModel) {
    throw badRequest("No models available for your plan");
  }
  const modelConfig: ModelConfig = {
    provider: selectedModel.provider,
    apiModelId: selectedModel.apiModelId,
    displayName: selectedModel.displayName,
  };
  const creditConfig = selectedModel.config as {
    creditsPerMillionInputTokens?: number;
    creditsPerMillionOutputTokens?: number;
  };
  const model = createModelInstance(modelConfig);

  const controller = new AbortController();
  activeControllers.set(responseId, controller);
  const emitter = new EventEmitter();
  activeEmitters.set(responseId, emitter);

  const stream = createSseStream(async (send) => {
    const emit = createEventSender(db, responseId, session.id, send, emitter);
    await runAgentStream({
      db,
      session,
      userId: c.var.userId,
      responseId,
      controller,
      emitter,
      emit,
      modelConfig,
      model,
      creditConfig,
    });
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
      // Generation already ended — the pending entry was cleaned up in the finally block.
      // This is a harmless race condition, not an error.
      return c.json({ success: true });
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
      return c.json({ success: true });
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
