import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import {
  deleteAttachment,
  findAttachmentById,
  insertAttachment,
} from "../db/queries/attachments.js";
import { getStorage } from "../lib/storage.js";
import { authMiddleware } from "../middleware/auth.js";
import { forbidden, notFound } from "../middleware/error-handler.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const attachmentRoutes = new Hono<AppEnv>();

attachmentRoutes.use("/*", authMiddleware);

attachmentRoutes.post("/upload", async (c) => {
  const db = c.var.db;
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() ?? "bin";
  const storageKey = `${c.var.userId}/${randomUUID()}.${ext}`;

  const storage = getStorage();
  await storage.upload(storageKey, buffer, file.type || "application/octet-stream");

  const attachment = await insertAttachment(db, {
    userId: c.var.userId,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    storageKey,
  });

  return c.json({ attachment }, 201);
});

attachmentRoutes.get("/:id/download", async (c) => {
  const db = c.var.db;
  const attachment = await findAttachmentById(db, c.req.param("id"));
  if (!attachment) {
    throw notFound("Attachment not found");
  }
  if (attachment.userId !== c.var.userId) {
    throw forbidden();
  }

  const storage = getStorage();
  const { data, contentType } = await storage.download(attachment.storageKey);

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${attachment.filename}"`,
      "Content-Length": String(data.length),
    },
  });
});

attachmentRoutes.post("/:id/delete", async (c) => {
  const db = c.var.db;
  const attachment = await findAttachmentById(db, c.req.param("id"));
  if (!attachment) {
    throw notFound("Attachment not found");
  }
  if (attachment.userId !== c.var.userId) {
    throw forbidden();
  }

  const storage = getStorage();
  await storage.delete(attachment.storageKey);
  await deleteAttachment(db, attachment.id);

  return c.json({ success: true });
});
