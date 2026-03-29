import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import {
  deleteSkill,
  findSkillById,
  findSkillsByUser,
  insertSkill,
  updateSkill,
} from "../db/queries/skills.js";
import { authMiddleware } from "../middleware/auth.js";
import { forbidden, notFound } from "../middleware/error-handler.js";

const resourceSchema = z.object({
  type: z.string(),
  label: z.string().optional(),
  value: z.string(),
  auth: z.string().optional(),
});

const scriptSchema = z.object({
  name: z.string(),
  content: z.string(),
  language: z.string(),
});

const createSkillSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  content: z.string().min(1),
  resources: z.array(resourceSchema).optional(),
  scripts: z.array(scriptSchema).optional(),
});

const updateSkillSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  content: z.string().min(1).optional(),
  resources: z.array(resourceSchema).optional(),
  scripts: z.array(scriptSchema).optional(),
  isEnabled: z.boolean().optional(),
});

export const skillRoutes = new Hono<AppEnv>();

skillRoutes.use("/*", authMiddleware);

skillRoutes.get("/list", async (c) => {
  const db = c.var.db;
  const skills = await findSkillsByUser(db, c.var.userId);
  return c.json({ skills });
});

skillRoutes.post("/create", async (c) => {
  const db = c.var.db;
  const body = createSkillSchema.parse(await c.req.json());

  const skill = await insertSkill(db, {
    userId: c.var.userId,
    ...body,
  });

  return c.json({ skill }, 201);
});

skillRoutes.get("/:id/detail", async (c) => {
  const db = c.var.db;
  const skill = await findSkillById(db, c.req.param("id"));
  if (!skill) {
    throw notFound("Skill not found");
  }
  if (skill.userId !== c.var.userId) {
    throw forbidden();
  }

  return c.json({ skill });
});

skillRoutes.post("/:id/update", async (c) => {
  const db = c.var.db;
  const existing = await findSkillById(db, c.req.param("id"));
  if (!existing) {
    throw notFound("Skill not found");
  }
  if (existing.userId !== c.var.userId) {
    throw forbidden();
  }

  const body = updateSkillSchema.parse(await c.req.json());
  const skill = await updateSkill(db, existing.id, body);

  return c.json({ skill });
});

skillRoutes.post("/:id/delete", async (c) => {
  const db = c.var.db;
  const existing = await findSkillById(db, c.req.param("id"));
  if (!existing) {
    throw notFound("Skill not found");
  }
  if (existing.userId !== c.var.userId) {
    throw forbidden();
  }

  await deleteSkill(db, existing.id);
  return c.json({ success: true });
});
