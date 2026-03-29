import build from "@hono/vite-build/node";
import devServer from "@hono/vite-dev-server";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    server: {
      port: 3000,
    },
    plugins: [build({ entry: "./src/index.ts" }), devServer({ entry: "./src/index.ts" })],
  };
});
