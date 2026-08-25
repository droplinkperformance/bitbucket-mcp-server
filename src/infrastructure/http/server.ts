import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

const MAX_BODY_BYTES = 25 * 1024 * 1024;

export interface NodeHttpServerHandler {
  (req: IncomingMessage, res: ServerResponse): Promise<void> | void;
}

/**
 * Creates a Node HTTP server with a 25MB request body cap (same as the previous
 * Fastify transport). Routing lives in the MCP HTTP transport.
 */
export function createHttpServer(handler: NodeHttpServerHandler): Server {
  return createServer((req, res) => {
    void Promise.resolve(handler(req, res)).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal_error' }));
      }
    });
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export async function readJsonBody(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      const error = new Error('payload_too_large');
      error.name = 'PayloadTooLargeError';
      throw error;
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks);
  if (raw.length === 0) {
    return undefined;
  }
  return JSON.parse(raw.toString('utf8')) as unknown;
}

export function requestPath(req: IncomingMessage): string {
  const host = req.headers.host ?? 'localhost';
  return new URL(req.url ?? '/', `http://${host}`).pathname;
}
