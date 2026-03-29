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
  arguments: string;
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
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// ─── Active Generation ─────────────────────────────────────────────────────

export interface ActiveGeneration {
  active: boolean;
  responseId?: string;
}
