// @ts-nocheck — createMiddleware mock returns raw config, not full middleware type
import { describe, expect, it, vi } from "vitest";
import type { AskUserResolver } from "./ask-user.js";

vi.mock("langchain", () => ({
  createMiddleware: vi.fn((config) => config),
  SystemMessage: class {
    content: string;
    constructor({ content }: { content: string }) {
      this.content = content;
    }
  },
}));

describe("createAskUserMiddleware", () => {
  it("creates middleware with ask_user tool", async () => {
    const { createAskUserMiddleware } = await import("./ask-user.js");
    const resolver: AskUserResolver = vi.fn(async () => "answer");

    const middleware = createAskUserMiddleware({ resolver });

    expect(middleware.name).toBe("askUserMiddleware");
    expect(middleware.tools).toHaveLength(1);
    expect(middleware.tools[0].name).toBe("ask_user");
  });

  it("ask_user tool calls resolver with question and returns answer", async () => {
    const { createAskUserMiddleware } = await import("./ask-user.js");
    const resolver: AskUserResolver = vi.fn(async () => "user said hello");

    const middleware = createAskUserMiddleware({ resolver });
    const result = await middleware.tools[0].invoke({
      question: "What is your name?",
    });

    expect(resolver).toHaveBeenCalledWith("What is your name?", undefined);
    expect(result).toBe("user said hello");
  });

  it("ask_user tool passes options to resolver", async () => {
    const { createAskUserMiddleware } = await import("./ask-user.js");
    const resolver: AskUserResolver = vi.fn(async () => "Python");

    const middleware = createAskUserMiddleware({ resolver });
    const result = await middleware.tools[0].invoke({
      question: "Which language?",
      options: ["Python", "JavaScript"],
    });

    expect(resolver).toHaveBeenCalledWith("Which language?", ["Python", "JavaScript"]);
    expect(result).toBe("Python");
  });

  it("ask_user tool blocks until resolver resolves", async () => {
    const { createAskUserMiddleware } = await import("./ask-user.js");

    let resolveAnswer!: (value: string) => void;
    const resolver: AskUserResolver = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveAnswer = resolve;
        }),
    );

    const middleware = createAskUserMiddleware({ resolver });
    const resultPromise = middleware.tools[0].invoke({ question: "Waiting?" });

    // Not yet resolved
    let resolved = false;
    resultPromise.then(() => {
      resolved = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    // Resolve the answer
    resolveAnswer("done!");
    const result = await resultPromise;
    expect(result).toBe("done!");
  });

  it("wrapModelCall appends ask_user system prompt", async () => {
    const { createAskUserMiddleware } = await import("./ask-user.js");
    const resolver: AskUserResolver = vi.fn(async () => "");

    const middleware = createAskUserMiddleware({ resolver });

    let capturedRequest: unknown;
    const handler = async (req: unknown) => {
      capturedRequest = req;
      return {};
    };

    await middleware.wrapModelCall({ systemMessage: { concat: (msg: unknown) => [msg] } }, handler);

    const modified = capturedRequest as { systemMessage: { content: string }[] };
    expect(modified.systemMessage[0].content).toContain("Ask User");
  });
});
