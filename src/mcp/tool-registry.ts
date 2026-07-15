import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDependencies } from '../app-dependencies.js';
import type { ToolFactory, ToolModule } from './types.js';
import { toAppError } from '../shared/errors.js';
import { appMetrics } from '../telemetry/metrics.js';
import { maskingService } from '../services/masking/Service.js';

const TOOL_SUFFIXES = ['.tool.js', '.tool.ts', '.tool.mjs', '.tool.cjs'];

function isToolFile(filename: string): boolean {
  return TOOL_SUFFIXES.some((suffix) => filename.endsWith(suffix)) && !filename.endsWith('.d.ts');
}

/**
 * Discovers tool modules from the filesystem and registers them dynamically on
 * the MCP server. This removes the need to maintain dozens of manual
 * `server.registerTool(...)` calls in server.ts.
 *
 * Each tool module default-exports a `ToolFactory`; the registry calls it with
 * the shared, provider-agnostic dependencies.
 */
export class ToolRegistry {
  constructor(private readonly deps: AppDependencies) {}

  private get defaultToolsDir(): string {
    return join(dirname(fileURLToPath(import.meta.url)), '..', 'tools');
  }

  /** Recursively collect tool module file paths. */
  private async collectFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.collectFiles(full)));
      } else if (entry.isFile() && isToolFile(entry.name)) {
        files.push(full);
      }
    }
    return files.sort();
  }

  async discover(toolsDir: string = this.defaultToolsDir): Promise<ToolModule[]> {
    const files = await this.collectFiles(toolsDir);
    const modules: ToolModule[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      const imported = (await import(pathToFileURL(file).href)) as { default?: ToolFactory };
      const factory = imported.default;
      if (typeof factory !== 'function') {
        this.deps.logger.warn({ file }, 'Skipping tool module without a default factory export.');
        continue;
      }
      const module = factory(this.deps);
      if (seen.has(module.name)) {
        throw new Error(`Duplicate tool name discovered: ${module.name}`);
      }
      seen.add(module.name);
      modules.push(module);
    }
    return modules;
  }

  async registerAll(server: McpServer, toolsDir?: string): Promise<ToolModule[]> {
    const modules = await this.discover(toolsDir);
    for (const module of modules) {
      this.register(server, module);
    }
    this.deps.logger.info({ count: modules.length, tools: modules.map((m) => m.name) }, 'Registered MCP tools');
    return modules;
  }

  private register(server: McpServer, module: ToolModule): void {
    const register = server.registerTool.bind(server) as (
      name: string,
      config: { title?: string; description?: string; inputSchema?: unknown },
      handler: (args: Record<string, unknown>) => Promise<{
        content: Array<{ type: 'text'; text: string }>;
        structuredContent?: Record<string, unknown>;
        isError?: boolean;
      }>,
    ) => void;

    register(
      module.name,
      {
        title: module.title,
        description: module.description,
        inputSchema: module.inputSchema,
      },
      async (args: Record<string, unknown>) => {
        const startedAt = Date.now();
        appMetrics.recordRequest({ tool: module.name });
        try {
          const result = await module.handler(args ?? {});
          appMetrics.recordLatency(Date.now() - startedAt, { tool: module.name });
          return {
            content: [{ type: 'text' as const, text: result.text }],
            structuredContent: result.structuredContent as Record<string, unknown> | undefined,
            isError: result.isError,
          };
        } catch (error) {
          appMetrics.recordError({ tool: module.name });
          const appError = toAppError(error);
          this.deps.logger.error(
            maskingService.mask({ msg: 'tool.error', tool: module.name, code: appError.code, message: appError.message }),
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  { error: { code: appError.code, message: appError.message } },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }
}
