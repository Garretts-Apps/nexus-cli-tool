/**
 * Telemetry factory - selects between available implementations
 *
 * Exported TelemetryProvider can be swapped via environment variable:
 * - TELEMETRY_MODE=otel (default) - Full OpenTelemetry instrumentation
 * - TELEMETRY_MODE=noop - Zero-overhead no-op implementation (for performance testing)
 */

import type { TelemetryProvider } from './interface'
import { createNoOpTelemetryProvider } from './no-op-adapter'
import { createOTelTelemetryProvider } from './otel-adapter'

export type { TelemetryProvider } from './interface'
export type {
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
} from './interface'

/**
 * Create telemetry provider based on environment
 *
 * TELEMETRY_MODE environment variable:
 * - "noop" - No-op implementation (zero overhead)
 * - "otel" (default) - OpenTelemetry implementation
 *
 * Usage:
 *   const telemetry = createTelemetryProvider()
 *   telemetry.meter.createCounter('my_counter')
 *   await telemetry.shutdown()
 */
export async function createTelemetryProvider(): Promise<TelemetryProvider> {
  const mode = process.env.TELEMETRY_MODE || 'otel'

  if (mode === 'noop') {
    return createNoOpTelemetryProvider()
  }

  // Default to OpenTelemetry
  return createOTelTelemetryProvider()
}

/**
 * Helper to check if telemetry is enabled
 */
export function isTelemetryEnabled(): boolean {
  return process.env.TELEMETRY_MODE !== 'noop'
}

// Re-export for convenience
export { createNoOpTelemetryProvider } from './no-op-adapter'
export { createOTelTelemetryProvider } from './otel-adapter'
