import Fastify, { type FastifyInstance } from 'fastify';

/**
 * Creates the Fastify instance used by the Streamable HTTP transport. We keep
 * Fastify's own logger off and rely on the application's pino logger so log
 * formatting/redaction is consistent.
 */
export function createHttpServer(): FastifyInstance {
  return Fastify({ logger: false, bodyLimit: 25 * 1024 * 1024 });
}
