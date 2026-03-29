import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const modelConfigSchema = z.object({
  provider: z.string().min(1),
  apiModelId: z.string().min(1),
  displayName: z.string().min(1),
});

export type ModelConfig = z.infer<typeof modelConfigSchema>;

let cached: ModelConfig | undefined;

export const getModelConfig = (): ModelConfig => {
  if (!cached) {
    const configPath = resolve(import.meta.dirname, "../../config/models.json");
    const raw = readFileSync(configPath, "utf-8");
    cached = modelConfigSchema.parse(JSON.parse(raw));
  }
  return cached;
};
