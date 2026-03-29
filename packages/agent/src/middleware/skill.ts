import { tool } from "@langchain/core/tools";
import { createMiddleware, SystemMessage } from "langchain";
import { z } from "zod";

export interface SkillDefinition {
  name: string;
  displayName: string;
  description: string;
  content: string;
}

/**
 * Callback to resolve a skill by name. Provided by the consumer (backend).
 */
export type SkillResolver = (name: string) => Promise<SkillDefinition | null>;

const SKILL_SYSTEM_PROMPT = `## Skills

You have access to a \`skill\` tool. Skills are predefined instructions and context for specific tasks. Invoke a skill by name when the user's request matches a known skill, or use \`tool_search\` to discover available skills.`;

export interface SkillMiddlewareOptions {
  resolver: SkillResolver;
}

/**
 * Creates a middleware that provides a skill invocation tool.
 * The resolver callback loads skill content from the consumer's data store.
 */
export const createSkillMiddleware = (options: SkillMiddlewareOptions) => {
  const { resolver } = options;

  const skillTool = tool(
    async ({ name }) => {
      const skill = await resolver(name);
      if (!skill) {
        return `Skill "${name}" not found. Use tool_search to find available skills.`;
      }
      return `[Skill: ${skill.displayName}]\n\n${skill.content}`;
    },
    {
      name: "skill",
      description:
        "Invoke a predefined skill by name. Skills provide specialized instructions and context for specific tasks.",
      schema: z.object({
        name: z.string().describe("The name of the skill to invoke"),
      }),
    },
  );

  return createMiddleware({
    name: "skillMiddleware",
    tools: [skillTool],
    wrapModelCall: async (request, handler) => {
      return handler({
        ...request,
        systemMessage: request.systemMessage.concat(
          new SystemMessage({ content: SKILL_SYSTEM_PROMPT }),
        ),
      });
    },
  });
};
