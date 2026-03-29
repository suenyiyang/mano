/**
 * Storage provider abstraction for file uploads (R2, OSS, TOS, local filesystem).
 * Consumers configure via STORAGE_PROVIDER env var.
 */

export interface StorageProvider {
  upload(key: string, data: Buffer, contentType: string): Promise<void>;
  download(key: string): Promise<{ data: Buffer; contentType: string }>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

/**
 * Local filesystem storage — default for development.
 * Stores files in a local directory.
 */
export const createLocalStorage = (baseDir: string): StorageProvider => {
  const { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } = require("node:fs");
  const { join } = require("node:path");

  mkdirSync(baseDir, { recursive: true });

  return {
    async upload(key, data, _contentType) {
      const filePath = join(baseDir, key);
      const dir = filePath.substring(0, filePath.lastIndexOf("/"));
      mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, data);
    },

    async download(key) {
      const filePath = join(baseDir, key);
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${key}`);
      }
      const data = readFileSync(filePath);
      // Infer content type from extension
      const ext = key.split(".").pop()?.toLowerCase() ?? "";
      const contentType = MIME_MAP[ext] ?? "application/octet-stream";
      return { data, contentType };
    },

    async getSignedUrl(key, _expiresInSeconds) {
      // For local dev, just return a relative path
      return `/api/attachments/${key}/download`;
    },

    async delete(key) {
      const filePath = join(baseDir, key);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    },
  };
};

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  json: "application/json",
  csv: "text/csv",
  md: "text/markdown",
};

let storageInstance: StorageProvider | undefined;

export const getStorage = (): StorageProvider => {
  if (!storageInstance) {
    // Default to local storage for dev. In production, swap for R2/OSS/TOS.
    const baseDir = process.env.STORAGE_DIR ?? "./.storage";
    storageInstance = createLocalStorage(baseDir);
  }
  return storageInstance;
};
