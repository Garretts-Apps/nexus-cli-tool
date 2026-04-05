/**
 * No-op telemetry adapter - zero-overhead implementation for testing
 *
 * All methods are no-ops (do nothing), allowing performance measurement
 * without telemetry overhead. Useful for:
 * - Startup time benchmarking
 * - Memory usage analysis
 * - Performance testing
 */

import type {
  Attributes,
  Counter,
  Histogram,
  Logger,
  LoggerProvider,
  Meter,
  MeterProvider,
  ObservableGauge,
  Span,
  Tracer,
  TracerProvider,
  TelemetryProvider,
} from './interface'

class NoOpHistogram implements Histogram {
  record(_value: number, _attributes?: Attributes): void {
    // no-op
  }
}

class NoOpCounter implements Counter {
  add(_value: number, _attributes?: Attributes): void {
    // no-op
  }
}

class NoOpObservableGauge implements ObservableGauge {
  observe(_value: number, _attributes?: Attributes): void {
    // no-op
  }
}

class NoOpMeter implements Meter {
  createHistogram(): Histogram {
    return new NoOpHistogram()
  }

  createCounter(): Counter {
    return new NoOpCounter()
  }

  createObservableGauge(): ObservableGauge {
    return new NoOpObservableGauge()
  }
}

class NoOpSpan implements Span {
  addEvent(_name: string, _attributes?: Attributes): void {
    // no-op
  }

  setAttributes(_attributes: Attributes): void {
    // no-op
  }

  end(): void {
    // no-op
  }
}

class NoOpTracer implements Tracer {
  startSpan(_name: string, _attributes?: Attributes): Span {
    return new NoOpSpan()
  }

  startActiveSpan<T>(_name: string, fn: (span: Span) => T): T {
    return fn(new NoOpSpan())
  }
}

class NoOpLogger implements Logger {
  info(_message: string, _attributes?: Attributes): void {
    // no-op
  }

  warn(_message: string, _attributes?: Attributes): void {
    // no-op
  }

  error(_message: string, _error?: Error, _attributes?: Attributes): void {
    // no-op
  }

  debug(_message: string, _attributes?: Attributes): void {
    // no-op
  }
}

class NoOpLoggerProvider implements LoggerProvider {
  getLogger(): Logger {
    return new NoOpLogger()
  }
}

class NoOpTracerProvider implements TracerProvider {
  getTracer(): Tracer {
    return new NoOpTracer()
  }
}

class NoOpMeterProvider implements MeterProvider {
  getMeter(): Meter {
    return new NoOpMeter()
  }
}

class NoOpTelemetryProvider implements TelemetryProvider {
  meter: Meter
  loggerProvider: LoggerProvider
  tracerProvider: TracerProvider
  meterProvider: MeterProvider

  constructor() {
    this.meter = new NoOpMeter()
    this.loggerProvider = new NoOpLoggerProvider()
    this.tracerProvider = new NoOpTracerProvider()
    this.meterProvider = new NoOpMeterProvider()
  }

  async shutdown(): Promise<void> {
    // no-op
  }
}

export function createNoOpTelemetryProvider(): TelemetryProvider {
  return new NoOpTelemetryProvider()
}
