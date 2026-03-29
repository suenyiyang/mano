import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/backend/src/**/*.test.ts",
      "apps/frontend/src/**/*.test.ts",
      "packages/agent/src/**/*.test.ts",
    ],
    globals: true,
  },
});
