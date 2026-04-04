// Tier 3 volatile runtime state: OpenTelemetry providers and counters.
// Extracted from src/bootstrap/state.ts (ARCH-002 Phase 2).

import type { Attributes, Meter, MetricOptions } from '@opentelemetry/api'
import type { logs } from '@opentelemetry/api-logs'
import type { LoggerProvider } from '@opentelemetry/sdk-logs'
import type { MeterProvider } from '@opentelemetry/sdk-metrics'
import type { BasicTracerProvider } from '@opentelemetry/sdk-trace-base'

export type AttributedCounter = {
  add(value: number, additionalAttributes?: Attributes): void
}

// ── Telemetry state ──

let meter: Meter | null = null
let sessionCounter: AttributedCounter | null = null
let locCounter: AttributedCounter | null = null
let prCounter: AttributedCounter | null = null
let commitCounter: AttributedCounter | null = null
let costCounter: AttributedCounter | null = null
let tokenCounter: AttributedCounter | null = null
let codeEditToolDecisionCounter: AttributedCounter | null = null
let activeTimeCounter: AttributedCounter | null = null
let statsStore: { observe(name: string, value: number): void } | null = null

// ── Logger / provider state ──

let loggerProvider: LoggerProvider | null = null
let eventLogger: ReturnType<typeof logs.getLogger> | null = null
let meterProvider: MeterProvider | null = null
let tracerProvider: BasicTracerProvider | null = null

// ── Getters / setters ──

export function setMeter(
  m: Meter,
  createCounter: (name: string, options: MetricOptions) => AttributedCounter,
): void {
  meter = m

  // Initialize all counters using the provided factory
  sessionCounter = createCounter('claude_code.session.count', {
    description: 'Count of CLI sessions started',
  })
  locCounter = createCounter('claude_code.lines_of_code.count', {
    description:
      "Count of lines of code modified, with the 'type' attribute indicating whether lines were added or removed",
  })
  prCounter = createCounter('claude_code.pull_request.count', {
    description: 'Number of pull requests created',
  })
  commitCounter = createCounter('claude_code.commit.count', {
    description: 'Number of git commits created',
  })
  costCounter = createCounter('claude_code.cost.usage', {
    description: 'Cost of the Nexus session',
    unit: 'USD',
  })
  tokenCounter = createCounter('claude_code.token.usage', {
    description: 'Number of tokens used',
    unit: 'tokens',
  })
  codeEditToolDecisionCounter = createCounter(
    'claude_code.code_edit_tool.decision',
    {
      description:
        'Count of code editing tool permission decisions (accept/reject) for Edit, Write, and NotebookEdit tools',
    },
  )
  activeTimeCounter = createCounter('claude_code.active_time.total', {
    description: 'Total active time in seconds',
    unit: 's',
  })
}

export function getMeter(): Meter | null {
  return meter
}

export function getSessionCounter(): AttributedCounter | null {
  return sessionCounter
}

export function getLocCounter(): AttributedCounter | null {
  return locCounter
}

export function getPrCounter(): AttributedCounter | null {
  return prCounter
}

export function getCommitCounter(): AttributedCounter | null {
  return commitCounter
}

export function getCostCounter(): AttributedCounter | null {
  return costCounter
}

export function getTokenCounter(): AttributedCounter | null {
  return tokenCounter
}

export function getCodeEditToolDecisionCounter(): AttributedCounter | null {
  return codeEditToolDecisionCounter
}

export function getActiveTimeCounter(): AttributedCounter | null {
  return activeTimeCounter
}

export function getStatsStore(): {
  observe(name: string, value: number): void
} | null {
  return statsStore
}

export function setStatsStore(
  store: { observe(name: string, value: number): void } | null,
): void {
  statsStore = store
}

export function getLoggerProvider(): LoggerProvider | null {
  return loggerProvider
}

export function setLoggerProvider(provider: LoggerProvider | null): void {
  loggerProvider = provider
}

export function getEventLogger(): ReturnType<typeof logs.getLogger> | null {
  return eventLogger
}

export function setEventLogger(
  logger: ReturnType<typeof logs.getLogger> | null,
): void {
  eventLogger = logger
}

export function getMeterProvider(): MeterProvider | null {
  return meterProvider
}

export function setMeterProvider(provider: MeterProvider | null): void {
  meterProvider = provider
}

export function getTracerProvider(): BasicTracerProvider | null {
  return tracerProvider
}

export function setTracerProvider(provider: BasicTracerProvider | null): void {
  tracerProvider = provider
}

/** Reset to initial state (test helper). */
export function resetTelemetryState(): void {
  meter = null
  sessionCounter = null
  locCounter = null
  prCounter = null
  commitCounter = null
  costCounter = null
  tokenCounter = null
  codeEditToolDecisionCounter = null
  activeTimeCounter = null
  statsStore = null
  loggerProvider = null
  eventLogger = null
  meterProvider = null
  tracerProvider = null
}
