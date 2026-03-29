import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import {
  BaseChatModel,
  type BindToolsInput,
  type LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import type { Runnable } from "@langchain/core/runnables";
import { convertVolcengineDeltaToAIMessageChunk } from "./converters/delta-to-chunk.js";
import { convertMessagesToVolcengineParams } from "./converters/messages-to-params.js";
import { convertVolcengineResponseToAIMessage } from "./converters/response-to-message.js";
import { convertResponsesOutputToAIMessage } from "./converters/responses-output-to-message.js";
import type {
  ChatVolcengineCallOptions,
  ChatVolcengineFields,
  VolcengineCachingParam,
  VolcengineChatCompletion,
  VolcengineChatCompletionRequest,
  VolcengineReasoningEffort,
  VolcengineResponsesObject,
  VolcengineResponsesRequest,
  VolcengineResponsesStreamEvent,
  VolcengineServiceTier,
  VolcengineThinkingParam,
} from "./types.js";
import { parseRawSSEEvents, parseSSEStream } from "./utils/sse-stream.js";
import { convertToResponsesTool, convertToVolcengineTool } from "./utils/tools.js";

const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export class ChatVolcengine extends BaseChatModel<ChatVolcengineCallOptions> {
  static lc_name() {
    return "ChatVolcengine";
  }

  lc_serializable = false;

  model: string;
  apiKey: string;
  baseUrl: string;
  useResponsesApi: boolean;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  maxCompletionTokens?: number;
  stop?: string[];
  streaming: boolean;
  streamUsage: boolean;
  thinking?: VolcengineThinkingParam;
  reasoningEffort?: VolcengineReasoningEffort;
  serviceTier?: VolcengineServiceTier;
  caching?: VolcengineCachingParam;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
  store?: boolean;

  constructor(fields: ChatVolcengineFields) {
    super(fields);
    this.model = fields.model;
    this.apiKey = fields.apiKey;
    this.baseUrl = fields.baseUrl ?? DEFAULT_BASE_URL;
    this.useResponsesApi = fields.useResponsesApi ?? false;
    this.temperature = fields.temperature;
    this.topP = fields.topP;
    this.maxTokens = fields.maxTokens;
    this.maxCompletionTokens = fields.maxCompletionTokens;
    this.stop = fields.stop;
    this.streaming = fields.streaming ?? false;
    this.streamUsage = fields.streamUsage ?? true;
    this.thinking = fields.thinking;
    this.reasoningEffort = fields.reasoningEffort;
    this.serviceTier = fields.serviceTier;
    this.caching = fields.caching;
    this.frequencyPenalty = fields.frequencyPenalty;
    this.presencePenalty = fields.presencePenalty;
    this.timeout = fields.timeout;
    this.store = fields.store;
  }

  _llmType(): string {
    return "volcengine";
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return {
      ls_provider: "volcengine",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: this.temperature,
      ls_max_tokens: this.maxCompletionTokens ?? this.maxTokens,
      ls_stop: options.stop ?? this.stop,
    };
  }

  bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<ChatVolcengineCallOptions>,
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatVolcengineCallOptions> {
    const volcengineTools = tools.map(convertToVolcengineTool);
    return this.withConfig({
      tools: volcengineTools,
      ...kwargs,
    } as Partial<ChatVolcengineCallOptions>);
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    if (this.useResponsesApi) {
      return this._generateResponses(messages, options, runManager);
    }

    // If streaming is enabled, accumulate from stream
    if (this.streaming) {
      return this._generateFromStream(messages, options, runManager);
    }

    const body = this._buildCompletionRequestBody(messages, options, false);
    const response = await this._fetch(`${this.baseUrl}/chat/completions`, body, options.signal);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Volcengine API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as VolcengineChatCompletion;
    const choice = data.choices[0];
    if (!choice) {
      throw new Error("Volcengine API returned no choices");
    }

    const aiMessage = convertVolcengineResponseToAIMessage(
      choice.message,
      data,
      choice.finish_reason,
    );

    return {
      generations: [
        {
          text: typeof aiMessage.content === "string" ? aiMessage.content : "",
          message: aiMessage,
          generationInfo: {
            finish_reason: choice.finish_reason,
          },
        },
      ],
      llmOutput: {
        tokenUsage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      },
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    if (this.useResponsesApi) {
      yield* this._streamResponsesChunks(messages, options, runManager);
      return;
    }

    const body = this._buildCompletionRequestBody(messages, options, true);
    const response = await this._fetch(`${this.baseUrl}/chat/completions`, body, options.signal);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Volcengine API error (${response.status}): ${errorBody}`);
    }

    for await (const chunk of parseSSEStream(response)) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const messageChunk = convertVolcengineDeltaToAIMessageChunk(
        choice.delta,
        chunk,
        choice.finish_reason,
      );

      const generationChunk = new ChatGenerationChunk({
        message: messageChunk,
        text: typeof messageChunk.content === "string" ? messageChunk.content : "",
        generationInfo: choice.finish_reason ? { finish_reason: choice.finish_reason } : undefined,
      });

      yield generationChunk;

      const tokenText = typeof messageChunk.content === "string" ? messageChunk.content : "";
      if (tokenText) {
        await runManager?.handleLLMNewToken(tokenText);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Responses API implementation
  // ---------------------------------------------------------------------------

  private async _generateResponses(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    // If streaming is enabled, accumulate from stream
    if (this.streaming) {
      return this._generateFromStream(messages, options, runManager);
    }

    const body = this._buildResponsesRequestBody(messages, options, false);
    const response = await this._fetch(`${this.baseUrl}/responses`, body, options.signal);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Volcengine API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as VolcengineResponsesObject;

    if (data.error) {
      throw new Error(`Volcengine API error: ${data.error.code} - ${data.error.message}`);
    }

    const aiMessage = convertResponsesOutputToAIMessage(data);

    return {
      generations: [
        {
          text: typeof aiMessage.content === "string" ? aiMessage.content : "",
          message: aiMessage,
          generationInfo: {
            status: data.status,
            response_id: data.id,
          },
        },
      ],
      llmOutput: {
        tokenUsage: data.usage
          ? {
              promptTokens: data.usage.input_tokens ?? data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.output_tokens ?? data.usage.completion_tokens ?? 0,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      },
    };
  }

  private async *_streamResponsesChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const body = this._buildResponsesRequestBody(messages, options, true);
    const response = await this._fetch(`${this.baseUrl}/responses`, body, options.signal);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Volcengine API error (${response.status}): ${errorBody}`);
    }

    // Responses API streaming uses event types like:
    // response.output_text.delta, response.function_call_arguments.delta,
    // response.reasoning_summary_text.delta, response.completed, etc.
    let responseId: string | undefined;

    for await (const { event, data } of parseRawSSEEvents(response)) {
      if (data === "[DONE]") break;

      let parsed: VolcengineResponsesStreamEvent;
      try {
        parsed = JSON.parse(data) as VolcengineResponsesStreamEvent;
      } catch {
        continue;
      }

      const eventType = event ?? parsed.type;

      if (eventType === "response.created" || eventType === "response.completed") {
        responseId = parsed.id as string | undefined;
        // On completed, extract usage if present
        if (eventType === "response.completed" && parsed.usage) {
          const usage = parsed.usage as {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
            input_tokens_details?: { cached_tokens?: number };
            output_tokens_details?: { reasoning_tokens?: number };
          };
          const usageChunk = new AIMessageChunk({
            content: "",
            usage_metadata: {
              input_tokens: usage.input_tokens ?? 0,
              output_tokens: usage.output_tokens ?? 0,
              total_tokens: usage.total_tokens ?? 0,
              input_token_details:
                usage.input_tokens_details?.cached_tokens != null
                  ? { cache_read: usage.input_tokens_details.cached_tokens }
                  : undefined,
              output_token_details:
                usage.output_tokens_details?.reasoning_tokens != null
                  ? { reasoning: usage.output_tokens_details.reasoning_tokens }
                  : undefined,
            },
            response_metadata: { response_id: responseId, status: "completed" },
            id: responseId,
          });
          yield new ChatGenerationChunk({
            message: usageChunk,
            text: "",
            generationInfo: { status: "completed", response_id: responseId },
          });
        }
        continue;
      }

      if (eventType === "response.output_text.delta") {
        const delta = (parsed.delta as string) ?? "";
        const chunk = new AIMessageChunk({
          content: delta,
          id: responseId,
        });
        yield new ChatGenerationChunk({ message: chunk, text: delta });
        if (delta) {
          await runManager?.handleLLMNewToken(delta);
        }
        continue;
      }

      if (eventType === "response.reasoning_summary_text.delta") {
        const delta = (parsed.delta as string) ?? "";
        const chunk = new AIMessageChunk({
          content: [{ type: "reasoning", reasoning: delta }],
          additional_kwargs: { reasoning_content: delta },
          id: responseId,
        });
        yield new ChatGenerationChunk({ message: chunk, text: "" });
        continue;
      }

      if (eventType === "response.function_call_arguments.delta") {
        const argsDelta = (parsed.delta as string) ?? "";
        const chunk = new AIMessageChunk({
          content: "",
          tool_call_chunks: [
            {
              index: (parsed.output_index as number) ?? 0,
              id: parsed.call_id as string | undefined,
              name: parsed.name as string | undefined,
              args: argsDelta,
              type: "tool_call_chunk",
            },
          ],
          id: responseId,
        });
        yield new ChatGenerationChunk({ message: chunk, text: "" });
        continue;
      }

      // For function_call_arguments.done, emit the final tool call info
      if (eventType === "response.function_call_arguments.done") {
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Request body builders
  // ---------------------------------------------------------------------------

  private _buildCompletionRequestBody(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    streaming: boolean,
  ): VolcengineChatCompletionRequest {
    const volcengineMessages = convertMessagesToVolcengineParams(messages);

    const body: VolcengineChatCompletionRequest = {
      model: this.model,
      messages: volcengineMessages,
      stream: streaming,
    };

    // Sampling parameters
    if (this.temperature !== undefined) body.temperature = this.temperature;
    if (this.topP !== undefined) body.top_p = this.topP;

    // Token limits (max_completion_tokens takes precedence)
    if (this.maxCompletionTokens !== undefined) {
      body.max_completion_tokens = this.maxCompletionTokens;
    } else if (this.maxTokens !== undefined) {
      body.max_tokens = this.maxTokens;
    }

    // Stop sequences
    const stop = options.stop ?? this.stop;
    if (stop?.length) body.stop = stop;

    // Volcengine-specific parameters
    const thinking = options.thinking ?? this.thinking;
    if (thinking) body.thinking = thinking;

    const reasoningEffort = options.reasoning_effort ?? this.reasoningEffort;
    if (reasoningEffort) body.reasoning_effort = reasoningEffort;

    if (this.serviceTier) body.service_tier = this.serviceTier;

    const caching = options.caching ?? this.caching;
    if (caching) body.caching = caching;

    if (this.frequencyPenalty !== undefined) body.frequency_penalty = this.frequencyPenalty;
    if (this.presencePenalty !== undefined) body.presence_penalty = this.presencePenalty;

    // Call-option-only parameters
    if (options.tools?.length) body.tools = options.tools;
    if (options.tool_choice) body.tool_choice = options.tool_choice;
    if (options.parallel_tool_calls !== undefined)
      body.parallel_tool_calls = options.parallel_tool_calls;
    if (options.response_format) body.response_format = options.response_format;
    if (options.seed !== undefined) body.seed = options.seed;

    // Stream options
    if (streaming) {
      body.stream_options =
        options.stream_options ?? (this.streamUsage ? { include_usage: true } : undefined);
    }

    return body;
  }

  private _buildResponsesRequestBody(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    streaming: boolean,
  ): VolcengineResponsesRequest {
    const volcengineMessages = convertMessagesToVolcengineParams(messages);

    const body: VolcengineResponsesRequest = {
      model: this.model,
      input: volcengineMessages,
      stream: streaming,
    };

    // Sampling parameters
    if (this.temperature !== undefined) body.temperature = this.temperature;
    if (this.topP !== undefined) body.top_p = this.topP;

    // Token limits
    if (this.maxCompletionTokens !== undefined) {
      body.max_output_tokens = this.maxCompletionTokens;
    } else if (this.maxTokens !== undefined) {
      body.max_output_tokens = this.maxTokens;
    }

    // Stop sequences
    const stop = options.stop ?? this.stop;
    if (stop?.length) body.stop = stop;

    // Thinking/Reasoning
    const thinking = options.thinking ?? this.thinking;
    if (thinking) body.thinking = thinking;

    const reasoningEffort = options.reasoning_effort ?? this.reasoningEffort;
    if (reasoningEffort) body.reasoning_effort = reasoningEffort;

    // Service tier
    if (this.serviceTier) body.service_tier = this.serviceTier;

    // Caching
    const caching = options.caching ?? this.caching;
    if (caching) body.caching = caching;

    // Penalties
    if (this.frequencyPenalty !== undefined) body.frequency_penalty = this.frequencyPenalty;
    if (this.presencePenalty !== undefined) body.presence_penalty = this.presencePenalty;

    // Tools - convert from Chat Completions nested format to Responses API flat format
    if (options.tools?.length) body.tools = options.tools.map(convertToResponsesTool);
    if (options.tool_choice) body.tool_choice = options.tool_choice;
    if (options.parallel_tool_calls !== undefined)
      body.parallel_tool_calls = options.parallel_tool_calls;

    // Response format (Responses API uses text.format)
    if (options.response_format) {
      body.text = { format: options.response_format };
    }

    if (options.seed !== undefined) body.seed = options.seed;

    // Responses API-specific fields
    if (options.previous_response_id) body.previous_response_id = options.previous_response_id;

    const store = options.store ?? this.store;
    if (store !== undefined) body.store = store;

    if (options.expire_at !== undefined) body.expire_at = options.expire_at;
    if (options.instructions) body.instructions = options.instructions;

    return body;
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  private async _generateFromStream(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    let accumulated: AIMessageChunk | undefined;
    let finishReason: string | undefined;
    let responseId: string | undefined;

    for await (const chunk of this._streamResponseChunks(messages, options, runManager)) {
      if (!accumulated) {
        accumulated = chunk.message as AIMessageChunk;
      } else {
        accumulated = accumulated.concat(chunk.message as AIMessageChunk);
      }
      if (chunk.generationInfo?.finish_reason) {
        finishReason = chunk.generationInfo.finish_reason as string;
      }
      if (chunk.generationInfo?.response_id) {
        responseId = chunk.generationInfo.response_id as string;
      }
    }

    if (!accumulated) {
      throw new Error("Volcengine API returned empty stream");
    }

    const generationInfo: Record<string, unknown> = {};
    if (finishReason) generationInfo.finish_reason = finishReason;
    if (responseId) generationInfo.response_id = responseId;

    return {
      generations: [
        {
          text: typeof accumulated.content === "string" ? accumulated.content : "",
          message: accumulated,
          generationInfo: Object.keys(generationInfo).length > 0 ? generationInfo : undefined,
        },
      ],
    };
  }

  private async _fetch(
    url: string,
    body: VolcengineChatCompletionRequest | VolcengineResponsesRequest,
    signal?: AbortSignal,
  ): Promise<Response> {
    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    };

    if (signal) {
      fetchOptions.signal = signal;
    } else if (this.timeout) {
      fetchOptions.signal = AbortSignal.timeout(this.timeout);
    }

    return fetch(url, fetchOptions);
  }
}
