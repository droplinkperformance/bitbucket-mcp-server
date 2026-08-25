import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createHttpServer,
  readJsonBody,
  requestPath,
  sendJson,
} from '../../infrastructure/http/server.js';
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
 * Streamable HTTP transport on Node's `http` server, in stateless mode: each
 * request gets a fresh server + transport that are torn down when the response
 * closes. This is robust for horizontally-scaled / serverless deployments where
 * no session state is shared between instances.
 */
export async function startHttpTransport(
  options: HttpTransportOptions,
): Promise<HttpTransportHandle> {
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

  const app = createHttpServer(async (req, res) => {
    const path = requestPath(req);
    const method = req.method ?? 'GET';

    if (method === 'GET' && path === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (path === MCP_PATH && (method === 'GET' || method === 'DELETE')) {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    if (method === 'POST' && path === MCP_PATH) {
      try {
        const body = await readJsonBody(req);
        await handle(req, res, body);
      } catch (error) {
        if (error instanceof Error && error.name === 'PayloadTooLargeError') {
          if (!res.headersSent) {
            sendJson(res, 413, { error: 'payload_too_large' });
          }
          return;
        }
        if (error instanceof SyntaxError) {
          if (!res.headersSent) {
            sendJson(res, 400, { error: 'invalid_json' });
          }
          return;
        }
        options.logger.error(
          { err: error instanceof Error ? error.message : error },
          'Streamable HTTP request failed',
        );
        if (!res.headersSent) {
          sendJson(res, 500, { error: 'internal_error' });
        }
      }
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  });

  await new Promise<void>((resolve, reject) => {
    app.once('error', reject);
    app.listen(options.port, options.host, () => {
      app.off('error', reject);
      resolve();
    });
  });
  options.logger.info(
    { host: options.host, port: options.port },
    `MCP server listening on Streamable HTTP at ${MCP_PATH}`,
  );

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        app.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
