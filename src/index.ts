#!/usr/bin/env node
import { buildContainer } from './container.js';
import { startStdioTransport } from './mcp/transports/stdio.js';
import { startHttpTransport, type HttpTransportHandle } from './mcp/transports/http.js';
import { initTelemetry } from './telemetry/otel.js';

async function main(): Promise<void> {
  const container = await buildContainer();
  const { config, logger } = container;

  const telemetry = await initTelemetry({
    enabled: config.OTEL_ENABLED,
    otlpEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    logger,
  });

  let httpHandle: HttpTransportHandle | undefined;

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down');
    try {
      if (httpHandle) {
        await httpHandle.close();
      }
      await telemetry.shutdown();
      await container.shutdown();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  if (config.MCP_TRANSPORT === 'http') {
    httpHandle = await startHttpTransport({
      host: config.HTTP_HOST,
      port: config.HTTP_PORT,
      logger,
      createServer: container.createServer,
    });
  } else {
    const server = await container.createServer();
    await startStdioTransport(server, logger);
  }
}

main().catch((error) => {
  process.stderr.write(
    `Fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exit(1);
});
