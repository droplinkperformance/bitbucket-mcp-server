import type { Logger } from '../infrastructure/logger/pino.js';

export interface TelemetryOptions {
  enabled: boolean;
  otlpEndpoint?: string;
  serviceName?: string;
  logger?: Logger;
}

export interface TelemetryHandle {
  shutdown(): Promise<void>;
}

/**
 * Bootstraps OpenTelemetry. By default (OTEL_ENABLED=false) this is a no-op and
 * the metrics in metrics.ts run against the no-op API.
 *
 * When enabled, the heavy `@opentelemetry/sdk-node` is imported lazily so it is
 * not required unless telemetry is actually turned on.
 */
export async function initTelemetry(options: TelemetryOptions): Promise<TelemetryHandle> {
  if (!options.enabled) {
    return { shutdown: async () => {} };
  }

  try {
    const moduleName = '@opentelemetry/sdk-node';
    const mod = (await import(moduleName)) as unknown as {
      NodeSDK: new (config: Record<string, unknown>) => { start(): void; shutdown(): Promise<void> };
    };
    const sdk = new mod.NodeSDK({
      serviceName: options.serviceName ?? 'bitbucket-mcp-server',
    });
    sdk.start();
    options.logger?.info('OpenTelemetry SDK started');
    return { shutdown: () => sdk.shutdown() };
  } catch (error) {
    options.logger?.warn(
      { err: error instanceof Error ? error.message : error },
      'OTEL_ENABLED=true but @opentelemetry/sdk-node is not installed; telemetry disabled.',
    );
    return { shutdown: async () => {} };
  }
}
