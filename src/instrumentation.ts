/**
 * Calvary Connect — OpenTelemetry Instrumentation
 *
 * Next.js 15 native instrumentation hook.
 * Activates the existing @opentelemetry/exporter-jaeger package.
 *
 * Traces flow: Next.js App → OpenTelemetry SDK → Jaeger Collector → Grafana
 *
 * Set env vars:
 *   OTEL_EXPORTER_JAEGER_ENDPOINT=http://localhost:14268/api/traces
 *   OTEL_SERVICE_NAME=calvary-connect
 *   OTEL_ENVIRONMENT=production
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.DISABLE_OTEL === '1') {
      console.log('[OpenTelemetry] Disabled via DISABLE_OTEL');
      return;
    }
    const dynamicImport = (specifier: string) => import(specifier) as Promise<any>;
    try {
      const { NodeSDK } = await dynamicImport('@opentelemetry/sdk-node');
      const { Resource } = await dynamicImport('@opentelemetry/resources');
      const {
        SEMRESATTRS_SERVICE_NAME,
        SEMRESATTRS_SERVICE_VERSION,
        SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
      } = await dynamicImport('@opentelemetry/semantic-conventions');
      const { SimpleSpanProcessor } = await dynamicImport('@opentelemetry/sdk-trace-base');
      const { JaegerExporter } = await dynamicImport('@opentelemetry/exporter-jaeger');
      const {
        HttpInstrumentation,
      } = await dynamicImport('@opentelemetry/instrumentation-http').catch(() => ({ HttpInstrumentation: null }));

      const jaegerEndpoint =
        process.env.OTEL_EXPORTER_JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';

      const exporter = new JaegerExporter({ endpoint: jaegerEndpoint });

      const sdkConfig: any = {
        resource: new Resource({
          [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'calvary-connect',
          [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
          [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.OTEL_ENVIRONMENT || process.env.NODE_ENV,
        }),
        spanProcessor: new SimpleSpanProcessor(exporter as unknown as any),
      };

      // Add HTTP instrumentation if available
      if (HttpInstrumentation) {
        sdkConfig.instrumentations = [new HttpInstrumentation()];
      }

      const sdk = new NodeSDK(sdkConfig);
      sdk.start();

      console.log('[OpenTelemetry] Tracing initialized → Jaeger:', jaegerEndpoint);

      // Graceful shutdown
      process.on('SIGTERM', () => {
        sdk.shutdown().catch(console.error);
      });
    } catch (err) {
      // Telemetry must never crash the app
      console.warn('[OpenTelemetry] Failed to initialize tracing (non-fatal):', err);
    }
  }
}
