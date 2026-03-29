// @ts-nocheck — createMiddleware mock returns raw config, not full middleware type
import { describe, expect, it, vi } from "vitest";
import type { SkillDefinition, SkillResolver } from "./skill.js";

vi.mock("langchain", () => ({
  createMiddleware: vi.fn((config) => config),
  SystemMessage: class {
    content: string;
    constructor({ content }: { content: string }) {
      this.content = content;
    }
  },
}));

describe("createSkillMiddleware", () => {
  const mockSkill: SkillDefinition = {
    name: "test-skill",
    displayName: "Test Skill",
    description: "A test skill",
    content: "Do the test thing step by step.",
  };

  it("creates middleware with skill tool", async () => {
    const { createSkillMiddleware } = await import("./skill.js");
    const resolver: SkillResolver = vi.fn(async () => null);

    const middleware = createSkillMiddleware({ resolver });

    expect(middleware.name).toBe("skillMiddleware");
    expect(middleware.tools).toHaveLength(1);
    expect(middleware.tools[0].name).toBe("skill");
  });

  it("skill tool returns content when skill is found", async () => {
    const { createSkillMiddleware } = await import("./skill.js");
    const resolver: SkillResolver = vi.fn(async () => mockSkill);

    const middleware = createSkillMiddleware({ resolver });
    const result = await middleware.tools[0].invoke({ name: "test-skill" });

    expect(resolver).toHaveBeenCalledWith("test-skill");
    expect(result).toContain("[Skill: Test Skill]");
    expect(result).toContain("Do the test thing step by step.");
  });

  it("skill tool returns not-found message for unknown skill", async () => {
    const { createSkillMiddleware } = await import("./skill.js");
    const resolver: SkillResolver = vi.fn(async () => null);

    const middleware = createSkillMiddleware({ resolver });
    const result = await middleware.tools[0].invoke({ name: "nonexistent" });

    expect(resolver).toHaveBeenCalledWith("nonexistent");
    expect(result).toContain('Skill "nonexistent" not found');
  });

  it("wrapModelCall appends skill system prompt", async () => {
    const { createSkillMiddleware } = await import("./skill.js");
    const resolver: SkillResolver = vi.fn(async () => null);

    const middleware = createSkillMiddleware({ resolver });

    let capturedRequest: unknown;
    const handler = async (req: unknown) => {
      capturedRequest = req;
      return {};
    };

    await middleware.wrapModelCall({ systemMessage: { concat: (msg: unknown) => [msg] } }, handler);

    const modified = capturedRequest as { systemMessage: { content: string }[] };
    expect(modified.systemMessage[0].content).toContain("Skills");
  });
});
