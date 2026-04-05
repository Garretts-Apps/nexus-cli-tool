/**
 * Vendor-neutral telemetry abstraction layer
 *
 * This interface provides a clean abstraction for telemetry operations,
 * allowing swappable implementations (OpenTelemetry, no-op, custom, etc.)
 *
 * Design rationale:
 * - Decouples codebase from OpenTelemetry (vendor-neutral)
 * - Enables zero-overhead no-op implementation for performance testing
 * - Allows future migration to alternative observability platforms
 */

export interface Attributes {
  [key: string]: string | number | boolean | undefined
}

export interface Histogram {
  record(value: number, attributes?: Attributes): void
}

export interface Counter {
  add(value: number, attributes?: Attributes): void
}

export interface ObservableGauge {
  observe(value: number, attributes?: Attributes): void
}

export interface Meter {
  createHistogram(name: string, options?: { unit?: string; description?: string }): Histogram
  createCounter(name: string, options?: { unit?: string; description?: string }): Counter
  createObservableGauge(
    name: string,
    callback: () => number,
    options?: { unit?: string; description?: string }
  ): ObservableGauge
}

export interface Span {
  addEvent(name: string, attributes?: Attributes): void
  setAttributes(attributes: Attributes): void
  end(): void
}

export interface Tracer {
  startSpan(name: string, attributes?: Attributes): Span
  startActiveSpan<T>(
    name: string,
    fn: (span: Span) => T,
    attributes?: Attributes
  ): T
}

export interface Logger {
  info(message: string, attributes?: Attributes): void
  warn(message: string, attributes?: Attributes): void
  error(message: string, error?: Error, attributes?: Attributes): void
  debug(message: string, attributes?: Attributes): void
}

export interface LoggerProvider {
  getLogger(name: string): Logger
}

export interface TracerProvider {
  getTracer(name: string): Tracer
}

export interface MeterProvider {
  getMeter(name: string): Meter
}

/**
 * Root telemetry provider
 * Provides access to all telemetry primitives (meter, logger, tracer)
 */
export interface TelemetryProvider {
  meter: Meter
  loggerProvider: LoggerProvider
  tracerProvider: TracerProvider
  meterProvider: MeterProvider

  /**
   * Gracefully shutdown telemetry (flush pending data, close connections)
   */
  shutdown(): Promise<void>
}

/**
 * Factory for creating telemetry providers
 */
export interface TelemetryProviderFactory {
  createProvider(mode: 'otel' | 'noop' | string): Promise<TelemetryProvider>
}
