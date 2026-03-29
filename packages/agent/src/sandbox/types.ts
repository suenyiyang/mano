import type { SandboxBackendProtocol } from "deepagents";

/**
 * Configuration for creating a sandbox instance.
 */
export interface SandboxConfig {
  /** Session ID this sandbox belongs to */
  sessionId: string;
  /** User who owns the session */
  userId: string;
  /** Sandbox idle timeout in milliseconds */
  timeout?: number;
}

/**
 * A long-running process spawned inside the sandbox.
 * Used for MCP stdio servers that communicate over stdin/stdout.
 */
export interface SandboxProcess {
  readonly stdin: WritableStream<Uint8Array>;
  readonly stdout: ReadableStream<Uint8Array>;
  readonly stderr: ReadableStream<Uint8Array>;
  kill(): Promise<void>;
}

/**
 * A running sandbox instance that provides both a DeepAgents filesystem
 * backend and process management capabilities.
 *
 * - `backend` is wired into DeepAgents as the `backend` parameter
 * - `spawn` is used for long-running processes like MCP stdio servers
 * - `destroy` tears down the sandbox when the session ends
 */
export interface Sandbox {
  /** Unique identifier for this sandbox instance */
  readonly id: string;

  /**
   * DeepAgents-compatible filesystem backend.
   * This is passed directly to `createDeepAgent({ backend })`.
   * For sandboxes with shell execution, this implements SandboxBackendProtocol.
   */
  readonly backend: SandboxBackendProtocol;

  /**
   * Spawn a long-running process inside the sandbox.
   * Returns streams for bidirectional communication (stdin/stdout/stderr).
   *
   * Primary use case: MCP stdio servers that need persistent stdin/stdout pipes.
   */
  spawn(command: string, args: string[]): Promise<SandboxProcess>;

  /**
   * Tear down the sandbox and release all resources.
   * Kills any spawned processes, removes temporary files/containers.
   */
  destroy(): Promise<void>;
}

/**
 * Factory interface for creating sandboxes.
 * Each provider implementation (local, Docker, E2B, etc.) implements this.
 */
export interface SandboxProvider {
  /** Create a new sandbox for the given config */
  create(config: SandboxConfig): Promise<Sandbox>;
}

/**
 * Type guard: check if a backend is a full Sandbox (not just a BackendProtocol).
 */
export const isSandbox = (value: unknown): value is Sandbox => {
  return (
    typeof value === "object" &&
    value !== null &&
    "backend" in value &&
    "spawn" in value &&
    "destroy" in value &&
    "id" in value
  );
};
