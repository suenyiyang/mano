import { tool } from "@langchain/core/tools";
import { createMiddleware, SystemMessage } from "langchain";
import { z } from "zod";

/**
 * Callback that pauses execution and waits for user input.
 * The backend implements this by emitting an SSE event and blocking
 * on a Promise until the /respond endpoint resolves it.
 */
export type AskUserResolver = (question: string, options?: string[]) => Promise<string>;

const ASK_USER_SYSTEM_PROMPT = `## Ask User

You have access to an \`ask_user\` tool. Use it when you need clarification, confirmation, or additional input from the user before proceeding. This tool pauses your execution and waits for the user's response. Only use it when the information is genuinely needed and cannot be inferred.`;

export interface AskUserMiddlewareOptions {
  resolver: AskUserResolver;
}

/**
 * Creates a middleware that provides an ask_user tool.
 * The resolver callback blocks until the user provides an answer,
 * implemented via the backend's SSE + /respond endpoint flow.
 */
export const createAskUserMiddleware = (options: AskUserMiddlewareOptions) => {
  const { resolver } = options;

  const askUserTool = tool(
    async ({ question, options }) => {
      const answer = await resolver(question, options);
      return answer;
    },
    {
      name: "ask_user",
      description:
        "Ask the user a question and wait for their response. Use this when you need clarification, confirmation, or additional input before proceeding.",
      schema: z.object({
        question: z.string().describe("The question to ask the user"),
        options: z
          .array(z.string())
          .optional()
          .describe("Optional list of suggested answers for the user to choose from"),
      }),
    },
  );

  return createMiddleware({
    name: "askUserMiddleware",
    tools: [askUserTool],
    wrapModelCall: async (request, handler) => {
      return handler({
        ...request,
        systemMessage: request.systemMessage.concat(
          new SystemMessage({ content: ASK_USER_SYSTEM_PROMPT }),
        ),
      });
    },
  });
};
