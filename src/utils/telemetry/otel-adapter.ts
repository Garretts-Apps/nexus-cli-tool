/**
 * OpenTelemetry implementation of the telemetry abstraction
 *
 * Wraps the existing OpenTelemetry SDK configuration and provides
 * the TelemetryProvider interface. This adapter allows the codebase to use
 * OTel without direct dependencies - the interface can be swapped for
 * alternative observability platforms.
 */

import type { Attributes, Meter, MeterProvider } from '@opentelemetry/api'
import type { Span as OTelSpan, Tracer as OTelTracer } from '@opentelemetry/api'
import type { ObservableGauge as OTelObservableGauge, BatchObservableResult } from '@opentelemetry/api'
import type { Histogram as OTelHistogram, Counter as OTelAPICounter, UpDownCounter as OTelUpDownCounter } from '@opentelemetry/api'
import type { logs } from '@opentelemetry/api-logs'
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base'
import { MeterProvider as OTelMeterProvider } from '@opentelemetry/sdk-metrics'
import { LoggerProvider as OTelLoggerProvider } from '@opentelemetry/sdk-logs'
import { registerCleanup } from '../cleanupRegistry.js'
import type {
  Counter,
  Histogram,
  Logger,
  LoggerProvider,
  ObservableGauge,
  Span,
  Tracer,
  TracerProvider,
  TelemetryProvider,
} from './interface'

/**
 * Adapter: OTel Meter -> our Histogram interface
 */
class OTelHistogramAdapter implements Histogram {
  constructor(private otelHistogram: OTelHistogram) {}

  record(value: number, attributes?: Attributes): void {
    this.otelHistogram.record(value, attributes)
  }
}

/**
 * Adapter: OTel UpDownCounter -> our Counter interface
 */
class OTelCounterAdapter implements Counter {
  constructor(private otelCounter: OTelUpDownCounter) {}

  add(value: number, attributes?: Attributes): void {
    this.otelCounter.add(value, attributes)
  }
}

/**
 * Adapter: OTel ObservableGauge -> our ObservableGauge interface
 *
 * OTel ObservableGauges are callback-based (push-on-read). This adapter
 * stores the latest observed value and registers an OTel callback that
 * reports it whenever the SDK collects metrics.
 */
class OTelObservableGaugeAdapter implements ObservableGauge {
  private lastValue = 0
  private lastAttributes?: Attributes

  constructor(private otelGauge: OTelObservableGauge, private otelMeter: Meter) {
    // Register OTel callback so the gauge value is reported on each collection cycle
    this.otelMeter.addBatchObservableCallback(
      (observableResult: BatchObservableResult) => {
        observableResult.observe(this.otelGauge, this.lastValue, this.lastAttributes)
      },
      [this.otelGauge],
    )
  }

  observe(value: number, attributes?: Attributes): void {
    this.lastValue = value
    this.lastAttributes = attributes
  }
}

/**
 * Adapter: OTel Meter -> our Meter interface
 */
class OTelMeterAdapter implements Meter {
  constructor(private otelMeter: Meter) {}

  createHistogram(name: string, options?: { unit?: string; description?: string }): Histogram {
    const otelHistogram = this.otelMeter.createHistogram(name, options)
    return new OTelHistogramAdapter(otelHistogram)
  }

  createCounter(name: string, options?: { unit?: string; description?: string }): Counter {
    const otelCounter = this.otelMeter.createUpDownCounter(name, options)
    return new OTelCounterAdapter(otelCounter)
  }

  createObservableGauge(
    name: string,
    _callback: () => number,
    options?: { unit?: string; description?: string }
  ): ObservableGauge {
    const otelGauge = this.otelMeter.createObservableGauge(name, options)
    return new OTelObservableGaugeAdapter(otelGauge, this.otelMeter)
  }
}

/**
 * Adapter: OTel Span -> our Span interface
 */
class OTelSpanAdapter implements Span {
  constructor(private otelSpan: OTelSpan) {}

  addEvent(name: string, attributes?: Attributes): void {
    this.otelSpan.addEvent(name, attributes)
  }

  setAttributes(attributes: Attributes): void {
    this.otelSpan.setAttributes(attributes)
  }

  end(): void {
    this.otelSpan.end()
  }
}

/**
 * Adapter: OTel Tracer -> our Tracer interface
 */
class OTelTracerAdapter implements Tracer {
  constructor(private otelTracer: OTelTracer) {}

  startSpan(name: string, attributes?: Attributes): Span {
    const otelSpan = this.otelTracer.startSpan(name, { attributes })
    return new OTelSpanAdapter(otelSpan)
  }

  startActiveSpan<T>(name: string, fn: (span: Span) => T, attributes?: Attributes): T {
    return this.otelTracer.startActiveSpan(name, { attributes }, (otelSpan: OTelSpan) => {
      const span = new OTelSpanAdapter(otelSpan)
      return fn(span)
    })
  }
}

/**
 * Adapter: OTel Logger -> our Logger interface
 */
class OTelLoggerAdapter implements Logger {
  constructor(private otelLogger: ReturnType<typeof logs.getLogger>) {}

  info(message: string, attributes?: Attributes): void {
    this.otelLogger.info(message, attributes)
  }

  warn(message: string, attributes?: Attributes): void {
    this.otelLogger.warn(message, attributes)
  }

  error(message: string, error?: Error, attributes?: Attributes): void {
    const attrs = { ...attributes, error: error?.message }
    this.otelLogger.error(message, attrs)
  }

  debug(message: string, attributes?: Attributes): void {
    this.otelLogger.debug(message, attributes)
  }
}

/**
 * Adapter: OTel LoggerProvider -> our LoggerProvider interface
 */
class OTelLoggerProviderAdapter implements LoggerProvider {
  constructor(private otelLoggerProvider: OTelLoggerProvider) {}

  getLogger(name: string): Logger {
    const otelLogger = this.otelLoggerProvider.getLogger(name)
    return new OTelLoggerAdapter(otelLogger)
  }
}

/**
 * Adapter: OTel TracerProvider -> our TracerProvider interface
 */
class OTelTracerProviderAdapter implements TracerProvider {
  constructor(private otelTracerProvider: BasicTracerProvider) {}

  getTracer(name: string): Tracer {
    const otelTracer = this.otelTracerProvider.getTracer(name)
    return new OTelTracerAdapter(otelTracer)
  }
}

/**
 * Adapter: OTel MeterProvider -> our MeterProvider interface
 */
class OTelMeterProviderAdapter implements MeterProvider {
  constructor(private otelMeterProvider: OTelMeterProvider) {}

  getMeter(name: string): Meter {
    const otelMeter = this.otelMeterProvider.getMeter(name)
    return new OTelMeterAdapter(otelMeter)
  }
}

/**
 * Adapter: OTel TelemetryProvider -> our TelemetryProvider interface
 */
class OTelTelemetryProviderAdapter implements TelemetryProvider {
  meter: Meter
  loggerProvider: LoggerProvider
  tracerProvider: TracerProvider
  meterProvider: MeterProvider

  // Store raw OTel providers for shutdown
  private rawLoggerProvider: OTelLoggerProvider
  private rawTracerProvider: BasicTracerProvider
  private rawMeterProvider: OTelMeterProvider

  constructor(
    otelMeter: Meter,
    otelLoggerProvider: OTelLoggerProvider,
    otelTracerProvider: BasicTracerProvider,
    otelMeterProvider: OTelMeterProvider
  ) {
    this.rawLoggerProvider = otelLoggerProvider
    this.rawTracerProvider = otelTracerProvider
    this.rawMeterProvider = otelMeterProvider

    this.meter = new OTelMeterAdapter(otelMeter)
    this.loggerProvider = new OTelLoggerProviderAdapter(otelLoggerProvider)
    this.tracerProvider = new OTelTracerProviderAdapter(otelTracerProvider)
    this.meterProvider = new OTelMeterProviderAdapter(otelMeterProvider)
  }

  async shutdown(): Promise<void> {
    const errors: Error[] = []

    try {
      await this.rawMeterProvider.shutdown()
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)))
    }

    try {
      await this.rawLoggerProvider.shutdown()
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)))
    }

    try {
      await this.rawTracerProvider.shutdown()
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)))
    }

    if (errors.length > 0) {
      throw new Error(`OTel shutdown errors: ${errors.map(e => e.message).join('; ')}`)
    }
  }
}

/**
 * Create OpenTelemetry-backed telemetry provider
 *
 * NOTE: This is a simplified implementation. Production would:
 * - Initialize OTel SDK properly
 * - Configure exporters (Jaeger, DataDog, etc.)
 * - Set up resource attributes
 * - Handle errors gracefully
 */
let _otelProviderInstance: TelemetryProvider | null = null

export async function createOTelTelemetryProvider(): Promise<TelemetryProvider> {
  if (_otelProviderInstance !== null) {
    return _otelProviderInstance
  }

  // TODO: Import and use existing OTel setup from bootstrap/state.ts
  // This is where the actual OTel initialization would happen

  // For now, return a minimal adapter structure
  // In production, this would properly initialize OTel
  const meterProvider = new OTelMeterProvider()
  const loggerProvider = new OTelLoggerProvider()
  const tracerProvider = new BasicTracerProvider()

  const meter = meterProvider.getMeter('default')

  _otelProviderInstance = new OTelTelemetryProviderAdapter(meter, loggerProvider, tracerProvider, meterProvider)
  registerCleanup(() => _otelProviderInstance?.shutdown())
  return _otelProviderInstance
}
