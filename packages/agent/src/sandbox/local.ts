import type { ChildProcess } from "node:child_process";
import { spawn as nodeSpawn } from "node:child_process";
import { LocalShellBackend } from "deepagents";
import type { Sandbox, SandboxConfig, SandboxProcess, SandboxProvider } from "./types.js";

/**
 * Convert a Node.js Readable stream to a Web ReadableStream.
 */
const toWebReadable = (nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> => {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      nodeStream.on("end", () => {
        controller.close();
      });
      nodeStream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      if ("destroy" in nodeStream && typeof nodeStream.destroy === "function") {
        nodeStream.destroy();
      }
    },
  });
};

/**
 * Convert a Node.js Writable stream to a Web WritableStream.
 */
const toWebWritable = (nodeStream: NodeJS.WritableStream): WritableStream<Uint8Array> => {
  return new WritableStream<Uint8Array>({
    write(chunk) {
      return new Promise((resolve, reject) => {
        const ok = nodeStream.write(chunk, (err) => {
          if (err) reject(err);
        });
        if (ok) {
          resolve();
        } else {
          nodeStream.once("drain", resolve);
        }
      });
    },
    close() {
      return new Promise((resolve) => {
        nodeStream.end(resolve);
      });
    },
    abort() {
      if ("destroy" in nodeStream && typeof nodeStream.destroy === "function") {
        (nodeStream as NodeJS.WritableStream & { destroy(): void }).destroy();
      }
    },
  });
};

/**
 * Wraps a Node.js ChildProcess as a SandboxProcess with Web Streams.
 */
const wrapChildProcess = (child: ChildProcess): SandboxProcess => {
  if (!child.stdin || !child.stdout || !child.stderr) {
    throw new Error("Child process must have stdio pipes");
  }

  return {
    stdin: toWebWritable(child.stdin),
    stdout: toWebReadable(child.stdout),
    stderr: toWebReadable(child.stderr),
    async kill() {
      child.kill("SIGTERM");
      // Give it a moment to terminate gracefully, then force-kill
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
          resolve();
        }, 5000);
        child.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    },
  };
};

export interface LocalSandboxOptions {
  /** Root directory for the sandbox. Defaults to cwd. */
  rootDir?: string;
  /** Whether to inherit the parent process's environment variables. Defaults to true. */
  inheritEnv?: boolean;
  /** Additional environment variables. */
  env?: Record<string, string>;
  /** Command execution timeout in seconds. Defaults to 120. */
  timeout?: number;
}

/**
 * Local sandbox provider for development and CLI usage.
 *
 * Uses DeepAgents' LocalShellBackend for filesystem and shell operations,
 * and Node.js child_process.spawn for long-running processes (MCP servers).
 *
 * NOT suitable for production/multi-tenant — commands run on the host system.
 */
export class LocalSandboxProvider implements SandboxProvider {
  private options: LocalSandboxOptions;

  constructor(options: LocalSandboxOptions = {}) {
    this.options = options;
  }

  async create(config: SandboxConfig): Promise<Sandbox> {
    const rootDir = this.options.rootDir ?? process.cwd();
    const inheritEnv = this.options.inheritEnv ?? true;
    const envOverrides = this.options.env;
    const timeoutSec =
      this.options.timeout ?? (config.timeout ? Math.floor(config.timeout / 1000) : 120);

    const backend = await LocalShellBackend.create({
      rootDir,
      inheritEnv,
      env: envOverrides,
      timeout: timeoutSec,
    });

    const spawnedProcesses: ChildProcess[] = [];

    const spawnInSandbox = async (command: string, args: string[]): Promise<SandboxProcess> => {
      const child = nodeSpawn(command, args, {
        cwd: rootDir,
        stdio: "pipe",
        env: {
          ...(inheritEnv ? process.env : {}),
          ...envOverrides,
        },
      });

      spawnedProcesses.push(child);

      child.on("exit", () => {
        const idx = spawnedProcesses.indexOf(child);
        if (idx >= 0) spawnedProcesses.splice(idx, 1);
      });

      return wrapChildProcess(child);
    };

    const destroy = async (): Promise<void> => {
      // Kill all spawned processes
      for (const child of [...spawnedProcesses]) {
        child.kill("SIGTERM");
      }

      // Wait briefly for graceful shutdown
      if (spawnedProcesses.length > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }

      // Force kill any remaining
      for (const child of [...spawnedProcesses]) {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }

      spawnedProcesses.length = 0;
      await backend.close();
    };

    return {
      id: backend.id,
      backend,
      spawn: spawnInSandbox,
      destroy,
    };
  }
}
