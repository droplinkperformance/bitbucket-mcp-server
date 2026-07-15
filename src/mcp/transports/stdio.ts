import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../../infrastructure/logger/pino.js';

/**
 * Connects the MCP server over stdio (for Cursor / Claude Desktop). All logging
 * goes to stderr (see logger) so stdout stays a clean JSON-RPC channel.
 */
export async function startStdioTransport(server: McpServer, logger: Logger): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server connected over stdio');
}
