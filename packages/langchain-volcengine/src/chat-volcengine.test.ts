import {
  type AIMessage,
  type AIMessageChunk,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatVolcengine } from "./chat-volcengine.js";
import type {
  VolcengineChatCompletion,
  VolcengineChatCompletionChunk,
  VolcengineResponsesObject,
} from "./types.js";

const createMockResponse = (data: VolcengineChatCompletion): Response => {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const createMockSSEResponse = (chunks: VolcengineChatCompletionChunk[]): Response => {
  const sseData = chunks
    .map((c) => `data: ${JSON.stringify(c)}`)
    .concat(["data: [DONE]"])
    .join("\n\n");

  return new Response(sseData, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
};

const BASIC_RESPONSE: VolcengineChatCompletion = {
  id: "resp-001",
  object: "chat.completion",
  created: 1700000000,
  model: "doubao-seed-2-0-pro-260215",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hello!" },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 5,
    completion_tokens: 3,
    total_tokens: 8,
  },
};

const REASONING_RESPONSE: VolcengineChatCompletion = {
  id: "resp-002",
  object: "chat.completion",
  created: 1700000000,
  model: "doubao-seed-2-0-pro-260215",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "42",
        reasoning_content: "The answer to everything is 42.",
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 50,
    total_tokens: 60,
    completion_tokens_details: { reasoning_tokens: 40 },
  },
};

const TOOL_CALL_RESPONSE: VolcengineChatCompletion = {
  id: "resp-003",
  object: "chat.completion",
  created: 1700000000,
  model: "doubao-seed-2-0-pro-260215",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"city":"Beijing"}',
            },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
  usage: {
    prompt_tokens: 15,
    completion_tokens: 10,
    total_tokens: 25,
  },
};

describe("ChatVolcengine", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createModel = (overrides?: Record<string, unknown>) =>
    new ChatVolcengine({
      model: "doubao-seed-2-0-pro-260215",
      apiKey: "test-api-key",
      ...overrides,
    });

  describe("_llmType", () => {
    it("returns 'volcengine'", () => {
      const model = createModel();
      expect(model._llmType()).toBe("volcengine");
    });
  });

  describe("constructor defaults", () => {
    it("sets default baseUrl", () => {
      const model = createModel();
      expect(model.baseUrl).toBe("https://ark.cn-beijing.volces.com/api/v3");
    });

    it("uses custom baseUrl", () => {
      const model = createModel({
        baseUrl: "https://custom.example.com/v3",
      });
      expect(model.baseUrl).toBe("https://custom.example.com/v3");
    });

    it("defaults streaming to false", () => {
      const model = createModel();
      expect(model.streaming).toBe(false);
    });

    it("defaults streamUsage to true", () => {
      const model = createModel();
      expect(model.streamUsage).toBe(true);
    });
  });

  describe("_generate (non-streaming)", () => {
    it("sends correct request and parses basic response", async () => {
      fetchSpy.mockResolvedValue(createMockResponse(BASIC_RESPONSE));

      const model = createModel();
      const result = await model._generate([new HumanMessage("Hi")], {});

      // Verify fetch was called correctly
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://ark.cn-beijing.volces.com/api/v3/chat/completions");
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Bearer test-api-key");

      const body = JSON.parse(options.body);
      expect(body.model).toBe("doubao-seed-2-0-pro-260215");
      expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
      expect(body.stream).toBe(false);

      // Verify response parsing
      expect(result.generations).toHaveLength(1);
      expect(result.generations[0].text).toBe("Hello!");
      expect(result.generations[0].message.content).toBe("Hello!");
      expect(result.generations[0].generationInfo?.finish_reason).toBe("stop");
    });

    it("includes Volcengine-specific parameters", async () => {
      fetchSpy.mockResolvedValue(createMockResponse(BASIC_RESPONSE));

      const model = createModel({
        temperature: 0.5,
        topP: 0.9,
        maxCompletionTokens: 1024,
        thinking: { type: "enabled" },
        reasoningEffort: "high",
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
      });

      await model._generate([new HumanMessage("Test")], {});

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.5);
      expect(body.top_p).toBe(0.9);
      expect(body.max_completion_tokens).toBe(1024);
      expect(body.thinking).toEqual({ type: "enabled" });
      expect(body.reasoning_effort).toBe("high");
      expect(body.frequency_penalty).toBe(0.5);
      expect(body.presence_penalty).toBe(0.3);
      // max_tokens should not be set when max_completion_tokens is set
      expect(body.max_tokens).toBeUndefined();
    });

    it("call options override constructor fields", async () => {
      fetchSpy.mockResolvedValue(createMockResponse(BASIC_RESPONSE));

      const model = createModel({
        thinking: { type: "disabled" },
        reasoningEffort: "low",
      });

      await model._generate([new HumanMessage("Test")], {
        thinking: { type: "enabled" },
        reasoning_effort: "high",
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.thinking).toEqual({ type: "enabled" });
      expect(body.reasoning_effort).toBe("high");
    });

    it("parses reasoning_content in response", async () => {
      fetchSpy.mockResolvedValue(createMockResponse(REASONING_RESPONSE));

      const model = createModel();
      const result = await model._generate([new HumanMessage("What is the meaning of life?")], {});

      const msg = result.generations[0].message as AIMessage;
      expect(msg.content).toEqual([
        {
          type: "reasoning",
          reasoning: "The answer to everything is 42.",
        },
        { type: "text", text: "42" },
      ]);
      expect(msg.additional_kwargs.reasoning_content).toBe("The answer to everything is 42.");
      expect(msg.usage_metadata?.output_token_details).toEqual({
        reasoning: 40,
      });
    });

    it("parses tool_calls in response", async () => {
      fetchSpy.mockResolvedValue(createMockResponse(TOOL_CALL_RESPONSE));

      const model = createModel();
      const result = await model._generate([new HumanMessage("What's the weather?")], {
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              parameters: {
                type: "object",
                properties: { city: { type: "string" } },
              },
            },
          },
        ],
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.tools).toHaveLength(1);

      const msg = result.generations[0].message as AIMessage;
      expect(msg.tool_calls).toEqual([
        {
          id: "call_1",
          name: "get_weather",
          args: { city: "Beijing" },
          type: "tool_call",
        },
      ]);
    });

    it("throws on HTTP error", async () => {
      fetchSpy.mockResolvedValue(new Response("Rate limit exceeded", { status: 429 }));

      const model = createModel();
      await expect(model._generate([new HumanMessage("Hi")], {})).rejects.toThrow(
        "Volcengine API error (429)",
      );
    });

    it("includes system message", async () => {
      fetchSpy.mockResolvedValue(createMockResponse(BASIC_RESPONSE));

      const model = createModel();
      await model._generate(
        [new SystemMessage("You are a poet."), new HumanMessage("Write a haiku")],
        {},
      );

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.messages).toEqual([
        { role: "system", content: "You are a poet." },
        { role: "user", content: "Write a haiku" },
      ]);
    });

    it("includes stop sequences from constructor", async () => {
      fetchSpy.mockResolvedValue(createMockResponse(BASIC_RESPONSE));

      const model = createModel({ stop: ["END", "STOP"] });
      await model._generate([new HumanMessage("Hi")], {});

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.stop).toEqual(["END", "STOP"]);
    });
  });

  describe("_streamResponseChunks", () => {
    it("parses SSE streaming response", async () => {
      const streamChunks: VolcengineChatCompletionChunk[] = [
        {
          id: "chunk-1",
          object: "chat.completion.chunk",
          created: 1700000000,
          model: "doubao-seed-2-0-pro-260215",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Hello" },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chunk-1",
          object: "chat.completion.chunk",
          created: 1700000000,
          model: "doubao-seed-2-0-pro-260215",
          choices: [
            {
              index: 0,
              delta: { content: " world!" },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 3,
            total_tokens: 8,
          },
        },
      ];

      fetchSpy.mockResolvedValue(createMockSSEResponse(streamChunks));

      const model = createModel();
      const chunks: string[] = [];

      for await (const chunk of model._streamResponseChunks([new HumanMessage("Hi")], {})) {
        if (typeof chunk.message.content === "string" && chunk.message.content) {
          chunks.push(chunk.message.content);
        }
      }

      expect(chunks).toEqual(["Hello", " world!"]);

      // Verify stream=true was sent
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.stream).toBe(true);
      expect(body.stream_options).toEqual({ include_usage: true });
    });

    it("streams reasoning_content", async () => {
      const streamChunks: VolcengineChatCompletionChunk[] = [
        {
          id: "chunk-2",
          object: "chat.completion.chunk",
          created: 1700000000,
          model: "doubao-seed-2-0-pro-260215",
          choices: [
            {
              index: 0,
              delta: { reasoning_content: "Let me think..." },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chunk-2",
          object: "chat.completion.chunk",
          created: 1700000000,
          model: "doubao-seed-2-0-pro-260215",
          choices: [
            {
              index: 0,
              delta: { content: "The answer is 42." },
              finish_reason: "stop",
            },
          ],
        },
      ];

      fetchSpy.mockResolvedValue(createMockSSEResponse(streamChunks));

      const model = createModel();
      const contents: unknown[] = [];

      for await (const chunk of model._streamResponseChunks([new HumanMessage("What?")], {})) {
        contents.push(chunk.message.content);
      }

      expect(contents[0]).toEqual([{ type: "reasoning", reasoning: "Let me think..." }]);
      expect(contents[1]).toBe("The answer is 42.");
    });

    it("streams tool calls", async () => {
      const streamChunks: VolcengineChatCompletionChunk[] = [
        {
          id: "chunk-3",
          object: "chat.completion.chunk",
          created: 1700000000,
          model: "doubao-seed-2-0-pro-260215",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_1",
                    type: "function",
                    function: { name: "search", arguments: '{"q":' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chunk-3",
          object: "chat.completion.chunk",
          created: 1700000000,
          model: "doubao-seed-2-0-pro-260215",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: '"test"}' },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        },
      ];

      fetchSpy.mockResolvedValue(createMockSSEResponse(streamChunks));

      const model = createModel();
      const toolChunks: unknown[] = [];

      for await (const chunk of model._streamResponseChunks([new HumanMessage("Search")], {})) {
        const msgChunk = chunk.message as AIMessageChunk;
        if (msgChunk.tool_call_chunks?.length) {
          toolChunks.push(msgChunk.tool_call_chunks);
        }
      }

      expect(toolChunks).toHaveLength(2);
      expect(toolChunks[0]).toEqual([
        {
          index: 0,
          id: "call_1",
          name: "search",
          args: '{"q":',
          type: "tool_call_chunk",
        },
      ]);
    });

    it("throws on HTTP error in stream", async () => {
      fetchSpy.mockResolvedValue(new Response("Internal Server Error", { status: 500 }));

      const model = createModel();
      const gen = model._streamResponseChunks([new HumanMessage("Hi")], {});

      await expect(gen.next()).rejects.toThrow("Volcengine API error (500)");
    });
  });

  describe("_generate with streaming=true", () => {
    it("accumulates stream chunks into a single ChatResult", async () => {
      const streamChunks: VolcengineChatCompletionChunk[] = [
        {
          id: "chunk-4",
          object: "chat.completion.chunk",
          created: 1700000000,
          model: "doubao-seed-2-0-pro-260215",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Hello" },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chunk-4",
          object: "chat.completion.chunk",
          created: 1700000000,
          model: "doubao-seed-2-0-pro-260215",
          choices: [
            {
              index: 0,
              delta: { content: " world!" },
              finish_reason: "stop",
            },
          ],
        },
      ];

      fetchSpy.mockResolvedValue(createMockSSEResponse(streamChunks));

      const model = createModel({ streaming: true });
      const result = await model._generate([new HumanMessage("Hi")], {});

      expect(result.generations).toHaveLength(1);
      // Accumulated text content
      expect(result.generations[0].message.content).toBe("Hello world!");
    });
  });

  // ---------------------------------------------------------------------------
  // Responses API tests
  // ---------------------------------------------------------------------------

  describe("Responses API (_generate)", () => {
    const RESPONSES_BASIC: VolcengineResponsesObject = {
      id: "resp-r001",
      object: "response",
      created_at: 1700000000,
      model: "doubao-seed-2-0-pro-260215",
      status: "completed",
      output: [
        {
          type: "message",
          id: "msg-1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Hello from Responses API!" }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      },
    };

    const RESPONSES_WITH_CACHE: VolcengineResponsesObject = {
      id: "resp-r002",
      object: "response",
      created_at: 1700000000,
      model: "doubao-seed-2-0-pro-260215",
      status: "completed",
      output: [
        {
          type: "message",
          id: "msg-2",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Cached response" }],
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 10,
        total_tokens: 110,
        input_tokens_details: { cached_tokens: 80 },
      },
    };

    it("uses /responses endpoint when useResponsesApi=true", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(RESPONSES_BASIC), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true });
      const result = await model._generate([new HumanMessage("Hi")], {});

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://ark.cn-beijing.volces.com/api/v3/responses");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body);
      expect(body.model).toBe("doubao-seed-2-0-pro-260215");
      expect(body.input).toEqual([{ role: "user", content: "Hi" }]);
      // Should not have `messages` field
      expect(body.messages).toBeUndefined();

      expect(result.generations[0].text).toBe("Hello from Responses API!");
      expect(result.generations[0].generationInfo?.response_id).toBe("resp-r001");
    });

    it("defaults useResponsesApi to false", () => {
      const model = createModel();
      expect(model.useResponsesApi).toBe(false);
    });

    it("sends previous_response_id from call options", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(RESPONSES_WITH_CACHE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true });
      await model._generate([new HumanMessage("Follow up question")], {
        previous_response_id: "resp-prev-123",
        caching: { type: "enabled" },
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.previous_response_id).toBe("resp-prev-123");
      expect(body.caching).toEqual({ type: "enabled" });
    });

    it("returns response_id in response_metadata for caching chain", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(RESPONSES_BASIC), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true });
      const result = await model._generate([new HumanMessage("First message")], {
        caching: { type: "enabled" },
      });

      const msg = result.generations[0].message as AIMessage;
      expect(msg.response_metadata?.response_id).toBe("resp-r001");
    });

    it("sends caching with prefix for prefix caching", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(RESPONSES_BASIC), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true });
      await model._generate([new SystemMessage("Long system prompt...")], {
        caching: { type: "enabled", prefix: true },
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.caching).toEqual({ type: "enabled", prefix: true });
    });

    it("sends store and expire_at from call options", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(RESPONSES_BASIC), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true });
      await model._generate([new HumanMessage("Hi")], {
        store: true,
        expire_at: 1700003600,
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.store).toBe(true);
      expect(body.expire_at).toBe(1700003600);
    });

    it("sends instructions from call options", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(RESPONSES_BASIC), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true });
      await model._generate([new HumanMessage("Hi")], {
        instructions: "You are a helpful assistant.",
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.instructions).toBe("You are a helpful assistant.");
    });

    it("includes cached_tokens in usage metadata", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(RESPONSES_WITH_CACHE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true });
      const result = await model._generate([new HumanMessage("Cached")], {});

      const msg = result.generations[0].message as AIMessage;
      expect(msg.usage_metadata?.input_tokens).toBe(100);
      expect(msg.usage_metadata?.input_token_details).toEqual({ cache_read: 80 });
    });

    it("uses max_output_tokens instead of max_tokens for Responses API", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(RESPONSES_BASIC), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true, maxTokens: 1000 });
      await model._generate([new HumanMessage("Hi")], {});

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.max_output_tokens).toBe(1000);
      expect(body.max_tokens).toBeUndefined();
      expect(body.max_completion_tokens).toBeUndefined();
    });

    it("sends response_format as text.format for Responses API", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(RESPONSES_BASIC), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true });
      await model._generate([new HumanMessage("JSON please")], {
        response_format: { type: "json_object" },
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.text).toEqual({ format: { type: "json_object" } });
      expect(body.response_format).toBeUndefined();
    });

    it("throws on HTTP error", async () => {
      fetchSpy.mockResolvedValue(new Response("Rate limit exceeded", { status: 429 }));

      const model = createModel({ useResponsesApi: true });
      await expect(model._generate([new HumanMessage("Hi")], {})).rejects.toThrow(
        "Volcengine API error (429)",
      );
    });

    it("throws on API error in response body", async () => {
      const errorResponse: VolcengineResponsesObject = {
        id: "resp-err",
        object: "response",
        created_at: 1700000000,
        model: "doubao-seed-2-0-pro-260215",
        status: "failed",
        output: [],
        error: { code: "invalid_request", message: "Input too short for prefix caching" },
      };

      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(errorResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const model = createModel({ useResponsesApi: true });
      await expect(model._generate([new HumanMessage("Hi")], {})).rejects.toThrow(
        "invalid_request",
      );
    });
  });

  describe("Responses API (streaming)", () => {
    const createResponsesSSE = (events: Array<{ event: string; data: unknown }>): Response => {
      const sseData = events
        .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}`)
        .concat(["data: [DONE]"])
        .join("\n\n");

      return new Response(sseData, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    };

    it("streams text content from Responses API", async () => {
      const events = [
        {
          event: "response.created",
          data: { type: "response.created", id: "resp-s001" },
        },
        {
          event: "response.output_text.delta",
          data: { type: "response.output_text.delta", delta: "Hello" },
        },
        {
          event: "response.output_text.delta",
          data: { type: "response.output_text.delta", delta: " world!" },
        },
        {
          event: "response.completed",
          data: {
            type: "response.completed",
            id: "resp-s001",
            usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
          },
        },
      ];

      fetchSpy.mockResolvedValue(createResponsesSSE(events));

      const model = createModel({ useResponsesApi: true });
      const chunks: string[] = [];

      for await (const chunk of model._streamResponseChunks([new HumanMessage("Hi")], {})) {
        if (typeof chunk.message.content === "string" && chunk.message.content) {
          chunks.push(chunk.message.content);
        }
      }

      expect(chunks).toEqual(["Hello", " world!"]);

      // Verify uses /responses endpoint
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://ark.cn-beijing.volces.com/api/v3/responses");
    });

    it("streams reasoning content from Responses API", async () => {
      const events = [
        {
          event: "response.created",
          data: { type: "response.created", id: "resp-s002" },
        },
        {
          event: "response.reasoning_summary_text.delta",
          data: { type: "response.reasoning_summary_text.delta", delta: "Thinking..." },
        },
        {
          event: "response.output_text.delta",
          data: { type: "response.output_text.delta", delta: "42" },
        },
        {
          event: "response.completed",
          data: {
            type: "response.completed",
            id: "resp-s002",
            usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
          },
        },
      ];

      fetchSpy.mockResolvedValue(createResponsesSSE(events));

      const model = createModel({ useResponsesApi: true });
      const contents: unknown[] = [];

      for await (const chunk of model._streamResponseChunks([new HumanMessage("What?")], {})) {
        if (
          chunk.message.content !== "" &&
          !(Array.isArray(chunk.message.content) && chunk.message.content.length === 0)
        ) {
          contents.push(chunk.message.content);
        }
      }

      expect(contents[0]).toEqual([{ type: "reasoning", reasoning: "Thinking..." }]);
      expect(contents[1]).toBe("42");
    });

    it("includes response_id and usage in completed event", async () => {
      const events = [
        {
          event: "response.created",
          data: { type: "response.created", id: "resp-s003" },
        },
        {
          event: "response.output_text.delta",
          data: { type: "response.output_text.delta", delta: "Hi" },
        },
        {
          event: "response.completed",
          data: {
            type: "response.completed",
            id: "resp-s003",
            usage: {
              input_tokens: 100,
              output_tokens: 10,
              total_tokens: 110,
              input_tokens_details: { cached_tokens: 80 },
            },
          },
        },
      ];

      fetchSpy.mockResolvedValue(createResponsesSSE(events));

      const model = createModel({ useResponsesApi: true });
      const allChunks: Array<{ info?: Record<string, unknown>; usage?: unknown }> = [];

      for await (const chunk of model._streamResponseChunks([new HumanMessage("Hi")], {})) {
        allChunks.push({
          info: chunk.generationInfo as Record<string, unknown> | undefined,
          usage: (chunk.message as AIMessageChunk).usage_metadata,
        });
      }

      // Last chunk should have usage and response_id
      const lastChunk = allChunks[allChunks.length - 1];
      expect(lastChunk.info?.response_id).toBe("resp-s003");
      expect(lastChunk.usage).toMatchObject({
        input_tokens: 100,
        output_tokens: 10,
        total_tokens: 110,
        input_token_details: { cache_read: 80 },
      });
    });
  });

  describe("getLsParams", () => {
    it("returns correct LangSmith parameters", () => {
      const model = createModel({
        temperature: 0.7,
        maxTokens: 1000,
        stop: ["END"],
      });

      const params = model.getLsParams({});
      expect(params).toEqual({
        ls_provider: "volcengine",
        ls_model_name: "doubao-seed-2-0-pro-260215",
        ls_model_type: "chat",
        ls_temperature: 0.7,
        ls_max_tokens: 1000,
        ls_stop: ["END"],
      });
    });

    it("prefers maxCompletionTokens for ls_max_tokens", () => {
      const model = createModel({
        maxTokens: 500,
        maxCompletionTokens: 2000,
      });

      const params = model.getLsParams({});
      expect(params.ls_max_tokens).toBe(2000);
    });
  });
});
