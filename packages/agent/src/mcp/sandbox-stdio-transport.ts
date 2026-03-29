import type {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { SandboxProcess } from "../sandbox/types.js";

/**
 * Options for creating a sandbox stdio transport.
 */
export interface SandboxStdioTransportOptions {
  /** Command to run inside the sandbox */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Function that spawns a process inside a sandbox */
  spawn: (command: string, args: string[]) => Promise<SandboxProcess>;
}

/**
 * MCP Transport that runs stdio servers inside a sandbox.
 *
 * Instead of spawning a local child process (like StdioClientTransport),
 * this delegates to a Sandbox's `spawn` method, allowing MCP servers
 * to run in isolated environments (Docker, E2B, etc.).
 */
export class SandboxStdioTransport implements Transport {
  private process?: SandboxProcess;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private readBuffer = "";
  private options: SandboxStdioTransportOptions;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: SandboxStdioTransportOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    this.process = await this.options.spawn(this.options.command, this.options.args ?? []);

    // Read stdout for JSONRPC messages
    this.reader = this.process.stdout.getReader();
    this.readLoop();
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    if (!this.process) {
      throw new Error("Transport not started");
    }

    const json = JSON.stringify(message);
    const data = new TextEncoder().encode(`${json}\n`);

    const writer = this.process.stdin.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  async close(): Promise<void> {
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // Ignore cancel errors
      }
    }

    if (this.process) {
      await this.process.kill();
      this.process = undefined;
    }

    this.onclose?.();
  }

  private async readLoop(): Promise<void> {
    if (!this.reader) return;

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await this.reader.read();
        if (done) break;

        this.readBuffer += decoder.decode(value, { stream: true });
        this.processReadBuffer();
      }
    } catch (error) {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.onclose?.();
    }
  }

  private processReadBuffer(): void {
    while (true) {
      const newlineIdx = this.readBuffer.indexOf("\n");
      if (newlineIdx < 0) break;

      const line = this.readBuffer.slice(0, newlineIdx).trim();
      this.readBuffer = this.readBuffer.slice(newlineIdx + 1);

      if (line.length === 0) continue;

      try {
        const message = JSON.parse(line) as JSONRPCMessage;
        this.onmessage?.(message);
      } catch {
        this.onerror?.(new Error(`Failed to parse MCP message: ${line}`));
      }
    }
  }
}
