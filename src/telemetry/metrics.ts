import { metrics, type Counter, type Histogram, type Attributes } from '@opentelemetry/api';

const meter = metrics.getMeter('bitbucket-mcp-server');

/**
 * Application metrics. These use the OpenTelemetry API only, which is a no-op
 * unless an SDK/exporter is registered (see telemetry/otel.ts). That keeps the
 * default footprint zero while remaining production-ready.
 */
class AppMetrics {
  private readonly requests: Counter;
  private readonly errors: Counter;
  private readonly latency: Histogram;
  private readonly bitbucketCalls: Counter;

  constructor() {
    this.requests = meter.createCounter('mcp.requests', {
      description: 'Total tool/request invocations',
    });
    this.errors = meter.createCounter('mcp.errors', {
      description: 'Total errors',
    });
    this.latency = meter.createHistogram('mcp.latency', {
      description: 'Operation latency in milliseconds',
      unit: 'ms',
    });
    this.bitbucketCalls = meter.createCounter('bitbucket.api.calls', {
      description: 'Total calls made to the Bitbucket API',
    });
  }

  recordRequest(attributes: Attributes = {}): void {
    this.requests.add(1, attributes);
  }

  recordError(attributes: Attributes = {}): void {
    this.errors.add(1, attributes);
  }

  recordLatency(milliseconds: number, attributes: Attributes = {}): void {
    this.latency.record(milliseconds, attributes);
  }

  recordBitbucketCall(attributes: Attributes = {}): void {
    this.bitbucketCalls.add(1, attributes);
  }
}

export const appMetrics = new AppMetrics();
