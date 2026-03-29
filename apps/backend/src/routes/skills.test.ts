// @ts-nocheck — test file with mocked responses
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app.js";

// Mock auth — inject userId directly
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
      c.set("userId", "test-user-id");
      c.set("userTier", "pro");
      await next();
    },
  ),
}));

const mockSkills = [
  {
    id: "skill-1",
    userId: "test-user-id",
    name: "code-review",
    displayName: "Code Review",
    description: "Reviews code for quality",
    content: "You are a code reviewer...",
    resources: [],
    scripts: [],
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

vi.mock("../db/queries/skills.js", () => ({
  findSkillsByUser: vi.fn(async () => mockSkills),
  findSkillById: vi.fn(async (_db: unknown, id: string) => {
    if (id === "skill-1") return mockSkills[0];
    return null;
  }),
  findSkillByName: vi.fn(async () => null),
  findEnabledSkillsByUser: vi.fn(async () => mockSkills),
  insertSkill: vi.fn(async (_db: unknown, input: Record<string, unknown>) => ({
    id: "skill-new",
    ...input,
    resources: input.resources ?? [],
    scripts: input.scripts ?? [],
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  updateSkill: vi.fn(async (_db: unknown, _id: string, input: Record<string, unknown>) => ({
    ...mockSkills[0],
    ...input,
    updatedAt: new Date(),
  })),
  deleteSkill: vi.fn(async () => {}),
}));

const createTestApp = async () => {
  const { skillRoutes } = await import("./skills.js");

  const app = new Hono<AppEnv>();
  app.onError((error, c) => {
    if ("status" in error && typeof (error as { status: unknown }).status === "number") {
      const status = (error as { status: number }).status;
      return c.json({ error: error.message }, status as 400 | 404 | 409);
    }
    if (error.constructor.name === "ZodError") {
      return c.json({ error: "Validation failed" }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  });
  app.use("/*", async (c, next) => {
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/skills", skillRoutes);
  return app;
};

describe("Skills routes", () => {
  it("GET /list returns user's skills", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/list", {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0].name).toBe("code-review");
  });

  it("POST /create creates a skill", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/create", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "my-skill",
        displayName: "My Skill",
        description: "Does stuff",
        content: "You are a helpful assistant...",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.skill.name).toBe("my-skill");
    expect(body.skill.displayName).toBe("My Skill");
  });

  it("POST /create validates skill name format", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/create", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Invalid Name!",
        displayName: "Bad",
        content: "content",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("POST /create with resources and scripts", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/create", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "data-skill",
        displayName: "Data Skill",
        content: "Analyze data...",
        resources: [{ type: "url", value: "https://docs.example.com" }],
        scripts: [{ name: "setup.sh", content: "pip install pandas", language: "bash" }],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.skill.resources).toHaveLength(1);
    expect(body.skill.scripts).toHaveLength(1);
  });

  it("GET /:id/detail returns skill details", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/skill-1/detail", {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skill.name).toBe("code-review");
  });

  it("GET /:id/detail returns 404 for unknown skill", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/unknown/detail", {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(404);
  });

  it("POST /:id/update updates a skill", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/skill-1/update", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ displayName: "Updated Skill" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skill.displayName).toBe("Updated Skill");
  });

  it("POST /:id/update returns 404 for unknown skill", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/unknown/update", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ displayName: "x" }),
    });

    expect(res.status).toBe(404);
  });

  it("POST /:id/delete removes a skill", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/skill-1/delete", {
      method: "POST",
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("POST /:id/delete returns 404 for unknown skill", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/skills/unknown/delete", {
      method: "POST",
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(404);
  });
});
