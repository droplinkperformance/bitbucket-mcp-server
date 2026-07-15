import type { ZodRawShape } from 'zod';
import type { AppDependencies } from '../app-dependencies.js';

export interface ToolResult {
  /** Structured payload returned as MCP `structuredContent` (always `{ data }`). */
  structuredContent?: unknown;
  /** Human-readable text rendering. */
  text: string;
  isError?: boolean;
}

/**
 * Uniform descriptor every tool module produces. `inputSchema` is a Zod raw
 * shape (the form `McpServer.registerTool` expects).
 */
export interface ToolModule {
  name: string;
  title?: string;
  description: string;
  inputSchema: ZodRawShape;
  handler(args: Record<string, unknown>): Promise<ToolResult>;
}

/**
 * Tool modules export a factory (as the default export). The ToolRegistry calls
 * it with the shared dependencies during auto-discovery.
 */
export type ToolFactory = (deps: AppDependencies) => ToolModule;
