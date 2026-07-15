import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolRegistry } from './tool-registry.js';
import type { AppDependencies } from '../app-dependencies.js';

export const SERVER_INFO = {
  name: 'bitbucket-mcp-server',
  version: '0.1.0',
} as const;

/**
 * Builds an McpServer and registers all tools via the ToolRegistry
 * (auto-discovery). No tool is registered manually here.
 */
export async function createMcpServer(deps: AppDependencies): Promise<McpServer> {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
  const registry = new ToolRegistry(deps);
  await registry.registerAll(server);
  return server;
}
