// ─── User ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  tier: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Session ───────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  userId: string;
  title: string | null;
  systemPrompt: string;
  modelTier: string;
  forkedFromSessionId: string | null;
  forkedAtMessageId: string | null;
  compactSummary: string | null;
  compactAfterMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Message ───────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "tool";
  content: unknown;
  toolCalls: ToolCallData[] | null;
  toolCallId: string | null;
  toolName: string | null;
  ordinal: number;
  modelId: string | null;
  responseId: string | null;
  tokenUsage: TokenUsage | null;
  isCompacted: boolean;
  createdAt: string;
}

export interface ToolCallData {
  id: string;
  name: string;
  /** OpenAI format (JSON string) */
  arguments?: string;
  /** LangChain format (parsed object) — backend stores this */
  args?: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ─── Paginated ─────────────────────────────────────────────────────────────

export interface PaginatedSessions {
  sessions: Session[];
  nextCursor: string | null;
}

export interface PaginatedMessages {
  messages: Message[];
  nextCursor: string | null;
  feedbackMap?: Record<string, string>;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: User;
}

// ─── Active Generation ─────────────────────────────────────────────────────

export interface ActiveGeneration {
  active: boolean;
  responseId?: string;
}

// ─── Skills ───────────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  description: string;
  content: string;
  resources: SkillResource[];
  scripts: SkillScript[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillResource {
  type: string;
  label?: string;
  value: string;
  auth?: string;
}

export interface SkillScript {
  name: string;
  content: string;
  language: string;
}

export interface CreateSkillPayload {
  name: string;
  displayName: string;
  description?: string;
  content: string;
  resources?: SkillResource[];
  scripts?: SkillScript[];
}

export interface UpdateSkillPayload {
  name?: string;
  displayName?: string;
  description?: string;
  content?: string;
  resources?: SkillResource[];
  scripts?: SkillScript[];
  isEnabled?: boolean;
}

// ─── MCP Servers ──────────────────────────────────────────────────────────

export interface McpServer {
  id: string;
  userId: string;
  name: string;
  transport: "stdio" | "sse" | "streamable-http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMcpServerPayload {
  name: string;
  transport: "stdio" | "sse" | "streamable-http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface UpdateMcpServerPayload {
  name?: string;
  transport?: "stdio" | "sse" | "streamable-http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  isEnabled?: boolean;
}
