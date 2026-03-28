import { createDeepAgent } from "deepagents";
import { tool } from "langchain";
import { z } from "zod";

export function createAgent(systemPrompt: string) {
  const echoTool = tool(
    async ({ query }) => {
      return `Echo: ${query}`;
    },
    {
      name: "echo",
      description: "Echoes the input back",
      schema: z.object({ query: z.string() }),
    },
  );

  return createDeepAgent({
    tools: [echoTool],
    systemPrompt,
  });
}
