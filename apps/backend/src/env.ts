import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // LLM providers (optional, enable as needed)
  VOLCENGINE_API_KEY: z.string().optional(),
  VOLCENGINE_BASE_URL: z.string().default("https://ark.cn-beijing.volces.com/api/v3"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Web search providers (optional, enable as needed)
  TAVILY_API_KEY: z.string().optional(),
  VOLCENGINE_SEARCH_BOT_ID: z.string().optional(),

  // OAuth (optional)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Frontend URL for OAuth redirects
  FRONTEND_URL: z.string().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export const getEnv = (): Env => {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
};
