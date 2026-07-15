import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHttpServer } from '../../infrastructure/http/fastify.js';
import type { Logger } from '../../infrastructure/logger/pino.js';

export interface HttpTransportOptions {
  host: string;
  port: number;
  logger: Logger;
  /** Builds a fresh MCP server instance (stateless: one per request). */
  createServer: () => Promise<McpServer>;
}

export interface HttpTransportHandle {
  close(): Promise<void>;
}

const MCP_PATH = '/mcp';

/**
 * Streamable HTTP transport on Fastify, in stateless mode: each request gets a
 * fresh server + transport that are torn down when the response closes. This is
 * robust for horizontally-scaled / serverless deployments where no session
 * state is shared between instances.
 */
export async function startHttpTransport(
  options: HttpTransportOptions,
): Promise<HttpTransportHandle> {
  const app = createHttpServer();

  app.get('/health', async () => ({ status: 'ok' }));

  const handle = async (req: IncomingMessage, res: ServerResponse, body?: unknown) => {
    const server = await options.createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  };

  app.post(MCP_PATH, async (request, reply) => {
    reply.hijack();
    try {
      await handle(request.raw, reply.raw, request.body);
    } catch (error) {
      options.logger.error(
        { err: error instanceof Error ? error.message : error },
        'Streamable HTTP request failed',
      );
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
        reply.raw.end(JSON.stringify({ error: 'internal_error' }));
      }
    }
  });

  // Stateless mode does not support server-initiated streams (GET) or session
  // teardown (DELETE); respond with 405 so clients fall back to POST.
  const methodNotAllowed = async (_req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) =>
    reply.code(405).send({ error: 'method_not_allowed' });
  app.get(MCP_PATH, methodNotAllowed);
  app.delete(MCP_PATH, methodNotAllowed);

  await app.listen({ host: options.host, port: options.port });
  options.logger.info({ host: options.host, port: options.port }, `MCP server listening on Streamable HTTP at ${MCP_PATH}`);

  return {
    close: async () => {
      await app.close();
    },
  };
}
