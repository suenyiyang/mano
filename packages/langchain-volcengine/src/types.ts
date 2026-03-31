import type {
  BaseChatModelCallOptions,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";

// ---------------------------------------------------------------------------
// Volcengine-specific parameter types
// ---------------------------------------------------------------------------

export interface VolcengineThinkingParam {
  type: "enabled" | "disabled" | "auto";
}

export type VolcengineReasoningEffort = "minimal" | "low" | "medium" | "high";

export type VolcengineServiceTier = "auto" | "default";

export interface VolcengineCachingParam {
  type: "enabled" | "disabled";
  /** Enable prefix caching (only for first request). */
  prefix?: boolean;
}

// ---------------------------------------------------------------------------
// Response format
// ---------------------------------------------------------------------------

export interface VolcengineResponseFormatText {
  type: "text";
}

export interface VolcengineResponseFormatJsonObject {
  type: "json_object";
}

export interface VolcengineResponseFormatJsonSchema {
  type: "json_schema";
  json_schema: {
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
}

export type VolcengineResponseFormat =
  | VolcengineResponseFormatText
  | VolcengineResponseFormatJsonObject
  | VolcengineResponseFormatJsonSchema;

// ---------------------------------------------------------------------------
// Tool types
// ---------------------------------------------------------------------------

export interface VolcengineFunctionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export type VolcengineToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } };

// ---------------------------------------------------------------------------
// Request message types (shared by both APIs)
// ---------------------------------------------------------------------------

export interface VolcengineSystemMessage {
  role: "system";
  content: string;
}

export interface VolcengineContentPartText {
  type: "text";
  text: string;
}

export interface VolcengineContentPartImageUrl {
  type: "image_url";
  image_url: { url: string; detail?: string };
}

export type VolcengineContentPart = VolcengineContentPartText | VolcengineContentPartImageUrl;

export interface VolcengineUserMessage {
  role: "user";
  content: string | VolcengineContentPart[];
}

export interface VolcengineToolCallFunction {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface VolcengineAssistantMessage {
  role: "assistant";
  content?: string | null;
  reasoning_content?: string;
  tool_calls?: VolcengineToolCallFunction[];
}

export interface VolcengineToolResultMessage {
  role: "tool";
  content: string;
  tool_call_id: string;
}

export type VolcengineMessage =
  | VolcengineSystemMessage
  | VolcengineUserMessage
  | VolcengineAssistantMessage
  | VolcengineToolResultMessage;

// ---------------------------------------------------------------------------
// Chat Completions API - Request body
// ---------------------------------------------------------------------------

export interface VolcengineChatCompletionRequest {
  model: string;
  messages: VolcengineMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stop?: string[];
  stream?: boolean;
  stream_options?: { include_usage?: boolean; chunk_include_usage?: boolean };
  tools?: VolcengineFunctionTool[];
  tool_choice?: VolcengineToolChoice;
  parallel_tool_calls?: boolean;
  response_format?: VolcengineResponseFormat;
  thinking?: VolcengineThinkingParam;
  reasoning_effort?: VolcengineReasoningEffort;
  service_tier?: VolcengineServiceTier;
  caching?: VolcengineCachingParam;
  frequency_penalty?: number;
  presence_penalty?: number;
  seed?: number;
  logprobs?: boolean;
  top_logprobs?: number;
}

// ---------------------------------------------------------------------------
// Chat Completions API - Response types (non-streaming)
// ---------------------------------------------------------------------------

export interface VolcengineUsage {
  prompt_tokens?: number;
  input_tokens?: number;
  completion_tokens?: number;
  output_tokens?: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  input_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
}

export interface VolcengineResponseMessage {
  role: "assistant";
  content: string | null;
  reasoning_content?: string;
  tool_calls?: VolcengineToolCallFunction[];
}

export interface VolcengineChoice {
  index: number;
  message: VolcengineResponseMessage;
  finish_reason: string;
  logprobs?: unknown;
}

export interface VolcengineChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: VolcengineChoice[];
  usage?: VolcengineUsage;
  service_tier?: string;
  moderation_hit_type?: string;
}

// ---------------------------------------------------------------------------
// Chat Completions API - Streaming response types
// ---------------------------------------------------------------------------

export interface VolcengineStreamToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface VolcengineStreamDelta {
  role?: string;
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: VolcengineStreamToolCallDelta[];
}

export interface VolcengineStreamChoice {
  index: number;
  delta: VolcengineStreamDelta;
  finish_reason: string | null;
  logprobs?: unknown;
}

export interface VolcengineChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: VolcengineStreamChoice[];
  usage?: VolcengineUsage | null;
  service_tier?: string;
}

// ---------------------------------------------------------------------------
// Responses API - Tool type (flat format, different from Chat Completions)
// ---------------------------------------------------------------------------

export interface VolcengineResponsesFunctionTool {
  type: "function";
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  strict?: boolean;
}

// ---------------------------------------------------------------------------
// Responses API - Input item types (different from Chat Completions messages)
// ---------------------------------------------------------------------------

export interface VolcengineResponsesInputFunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

export interface VolcengineResponsesInputFunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string;
}

export type VolcengineResponsesInputItem =
  | VolcengineSystemMessage
  | VolcengineUserMessage
  | Omit<VolcengineAssistantMessage, "tool_calls" | "reasoning_content">
  | VolcengineResponsesInputFunctionCall
  | VolcengineResponsesInputFunctionCallOutput;

// ---------------------------------------------------------------------------
// Responses API - Request body
// ---------------------------------------------------------------------------

export interface VolcengineResponsesRequest {
  model: string;
  input: VolcengineResponsesInputItem[] | string;
  previous_response_id?: string;
  store?: boolean;
  caching?: VolcengineCachingParam;
  thinking?: VolcengineThinkingParam;
  reasoning_effort?: VolcengineReasoningEffort;
  instructions?: string;
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  tools?: VolcengineResponsesFunctionTool[];
  tool_choice?: VolcengineToolChoice;
  parallel_tool_calls?: boolean;
  text?: { format?: VolcengineResponseFormat };
  service_tier?: VolcengineServiceTier;
  expire_at?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  seed?: number;
}

// ---------------------------------------------------------------------------
// Responses API - Response types
// ---------------------------------------------------------------------------

export interface VolcengineResponsesOutputText {
  type: "output_text";
  text: string;
}

export interface VolcengineResponsesOutputMessage {
  type: "message";
  id: string;
  role: "assistant";
  status: string;
  content: VolcengineResponsesOutputText[];
}

export interface VolcengineResponsesSummaryText {
  type: "summary_text";
  text: string;
}

export interface VolcengineResponsesReasoning {
  type: "reasoning";
  id: string;
  status: string;
  summary: VolcengineResponsesSummaryText[];
}

export interface VolcengineResponsesFunctionCall {
  type: "function_call";
  id: string;
  call_id: string;
  name: string;
  arguments: string;
  status: string;
}

export type VolcengineResponsesOutputItem =
  | VolcengineResponsesOutputMessage
  | VolcengineResponsesReasoning
  | VolcengineResponsesFunctionCall;

export interface VolcengineResponsesObject {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  status: string;
  output: VolcengineResponsesOutputItem[];
  usage?: VolcengineUsage;
  thinking?: VolcengineThinkingParam;
  caching?: VolcengineCachingParam;
  store?: boolean;
  expire_at?: number | null;
  previous_response_id?: string | null;
  service_tier?: string;
  incomplete_details?: { reason: string } | null;
  error?: { code: string; message: string } | null;
}

// ---------------------------------------------------------------------------
// Responses API - Streaming types
// ---------------------------------------------------------------------------

export interface VolcengineResponsesStreamEvent {
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// ChatVolcengine constructor & call option types
// ---------------------------------------------------------------------------

export interface ChatVolcengineFields extends BaseChatModelParams {
  /** Model ID or Endpoint ID. */
  model: string;
  /** Volcengine ARK API key. */
  apiKey: string;
  /** Base URL for the ARK API. Defaults to `https://ark.cn-beijing.volces.com/api/v3`. */
  baseUrl?: string;
  /** Whether to use the Responses API instead of Chat Completions. */
  useResponsesApi?: boolean;
  /** Sampling temperature. */
  temperature?: number;
  /** Nucleus sampling probability threshold. */
  topP?: number;
  /** Maximum tokens for model response (excludes reasoning). */
  maxTokens?: number;
  /** Maximum total output tokens including reasoning. */
  maxCompletionTokens?: number;
  /** Stop sequences. */
  stop?: string[];
  /** Whether to stream responses by default. */
  streaming?: boolean;
  /** Whether to include usage in streaming responses. */
  streamUsage?: boolean;
  /** Deep thinking mode configuration. */
  thinking?: VolcengineThinkingParam;
  /** Reasoning effort level. */
  reasoningEffort?: VolcengineReasoningEffort;
  /** Service tier configuration. */
  serviceTier?: VolcengineServiceTier;
  /** Caching configuration. */
  caching?: VolcengineCachingParam;
  /** Frequency penalty. */
  frequencyPenalty?: number;
  /** Presence penalty. */
  presencePenalty?: number;
  /** Request timeout in milliseconds. */
  timeout?: number;
  /** Whether to store responses (Responses API). Defaults to true. */
  store?: boolean;
}

export interface ChatVolcengineCallOptions extends BaseChatModelCallOptions {
  tools?: VolcengineFunctionTool[];
  tool_choice?: VolcengineToolChoice;
  parallel_tool_calls?: boolean;
  response_format?: VolcengineResponseFormat;
  thinking?: VolcengineThinkingParam;
  reasoning_effort?: VolcengineReasoningEffort;
  seed?: number;
  stream_options?: { include_usage?: boolean; chunk_include_usage?: boolean };
  /** Caching configuration (can override constructor). */
  caching?: VolcengineCachingParam;
  /** Previous response ID for session caching (Responses API). */
  previous_response_id?: string;
  /** Whether to store the response (Responses API). */
  store?: boolean;
  /** Unix timestamp for cache/store expiry (Responses API). */
  expire_at?: number;
  /** System instructions inserted into model context (Responses API). */
  instructions?: string;
}
