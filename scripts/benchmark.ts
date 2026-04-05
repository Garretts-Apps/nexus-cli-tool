/**
 * Performance Benchmarking Harness
 *
 * Measures telemetry abstraction overhead across two modes:
 *   TELEMETRY_MODE=noop  - zero-overhead no-op implementation
 *   TELEMETRY_MODE=otel  - simulated OTel-style implementation (with real overhead)
 *
 * Metrics collected:
 *   - Startup time (ms)
 *   - SDK call latency (p50 / p95 / p99 in ms)
 *   - Stream event throughput (events/sec)
 *   - Memory delta (MB)
 *   - Abstraction layer overhead (%)
 *
 * Run:
 *   bun scripts/benchmark.ts
 *   TELEMETRY_MODE=noop bun scripts/benchmark.ts
 */

// ── Interfaces (mirrors src/utils/telemetry/interface.ts) ─────────────────────

type Attributes = Record<string, string | number | boolean | undefined>

interface Histogram {
  record(value: number, attributes?: Attributes): void
}
interface Counter {
  add(value: number, attributes?: Attributes): void
}
interface ObservableGauge {
  observe(value: number, attributes?: Attributes): void
}
interface Span {
  addEvent(name: string, attributes?: Attributes): void
  setAttributes(attributes: Attributes): void
  end(): void
}
interface Tracer {
  startSpan(name: string, attributes?: Attributes): Span
  startActiveSpan<T>(name: string, fn: (span: Span) => T, attributes?: Attributes): T
}
interface Logger {
  info(message: string, attributes?: Attributes): void
  warn(message: string, attributes?: Attributes): void
  error(message: string, error?: Error, attributes?: Attributes): void
  debug(message: string, attributes?: Attributes): void
}
interface LoggerProvider {
  getLogger(name: string): Logger
}
interface Meter {
  createHistogram(name: string, options?: { unit?: string; description?: string }): Histogram
  createCounter(name: string, options?: { unit?: string; description?: string }): Counter
  createObservableGauge(
    name: string,
    callback: () => number,
    options?: { unit?: string; description?: string }
  ): ObservableGauge
}
interface MeterProvider {
  getMeter(name: string): Meter
}
interface TracerProvider {
  getTracer(name: string): Tracer
}
interface TelemetryProvider {
  meter: Meter
  loggerProvider: LoggerProvider
  tracerProvider: TracerProvider
  meterProvider: MeterProvider
  shutdown(): Promise<void>
}

// ── No-op provider (mirrors src/utils/telemetry/no-op-adapter.ts) ─────────────

class NoOpHistogram implements Histogram {
  record(_value: number, _attributes?: Attributes): void {}
}
class NoOpCounter implements Counter {
  add(_value: number, _attributes?: Attributes): void {}
}
class NoOpObservableGauge implements ObservableGauge {
  observe(_value: number, _attributes?: Attributes): void {}
}
class NoOpMeter implements Meter {
  createHistogram(): Histogram { return new NoOpHistogram() }
  createCounter(): Counter { return new NoOpCounter() }
  createObservableGauge(): ObservableGauge { return new NoOpObservableGauge() }
}
class NoOpSpan implements Span {
  addEvent(_name: string, _attributes?: Attributes): void {}
  setAttributes(_attributes: Attributes): void {}
  end(): void {}
}
class NoOpTracer implements Tracer {
  startSpan(): Span { return new NoOpSpan() }
  startActiveSpan<T>(_name: string, fn: (span: Span) => T): T { return fn(new NoOpSpan()) }
}
class NoOpLogger implements Logger {
  info(_message: string, _attributes?: Attributes): void {}
  warn(_message: string, _attributes?: Attributes): void {}
  error(_message: string, _error?: Error, _attributes?: Attributes): void {}
  debug(_message: string, _attributes?: Attributes): void {}
}
class NoOpLoggerProvider implements LoggerProvider {
  getLogger(): Logger { return new NoOpLogger() }
}
class NoOpTracerProvider implements TracerProvider {
  getTracer(): Tracer { return new NoOpTracer() }
}
class NoOpMeterProvider implements MeterProvider {
  getMeter(): Meter { return new NoOpMeter() }
}
class NoOpTelemetryProvider implements TelemetryProvider {
  meter: Meter = new NoOpMeter()
  loggerProvider: LoggerProvider = new NoOpLoggerProvider()
  tracerProvider: TracerProvider = new NoOpTracerProvider()
  meterProvider: MeterProvider = new NoOpMeterProvider()
  async shutdown(): Promise<void> {}
}

// ── OTel-style provider (real overhead: object allocation, array appends) ─────
// Simulates what the OTel SDK does: stores records in memory buffers.

class OTelHistogram implements Histogram {
  private records: Array<{ value: number; attributes?: Attributes }> = []
  record(value: number, attributes?: Attributes): void {
    this.records.push({ value, attributes })
  }
}
class OTelCounter implements Counter {
  private total = 0
  private snapshots: Array<{ value: number; attributes?: Attributes }> = []
  add(value: number, attributes?: Attributes): void {
    this.total += value
    this.snapshots.push({ value, attributes })
  }
}
class OTelObservableGauge implements ObservableGauge {
  private lastValue = 0
  private lastAttributes?: Attributes
  observe(value: number, attributes?: Attributes): void {
    this.lastValue = value
    this.lastAttributes = attributes
  }
}
class OTelMeter implements Meter {
  private instruments: Map<string, object> = new Map()
  createHistogram(name: string): Histogram {
    const h = new OTelHistogram()
    this.instruments.set(name, h)
    return h
  }
  createCounter(name: string): Counter {
    const c = new OTelCounter()
    this.instruments.set(name, c)
    return c
  }
  createObservableGauge(name: string, _callback: () => number): ObservableGauge {
    const g = new OTelObservableGauge()
    this.instruments.set(name, g)
    return g
  }
}
class OTelSpan implements Span {
  private events: Array<{ name: string; attributes?: Attributes; time: number }> = []
  private attributes: Attributes = {}
  private endTime?: number
  constructor(private name: string, private startTime: number) {}
  addEvent(name: string, attributes?: Attributes): void {
    this.events.push({ name, attributes, time: performance.now() })
  }
  setAttributes(attributes: Attributes): void {
    Object.assign(this.attributes, attributes)
  }
  end(): void {
    this.endTime = performance.now()
  }
}
class OTelTracer implements Tracer {
  private spans: OTelSpan[] = []
  startSpan(name: string, attributes?: Attributes): Span {
    const span = new OTelSpan(name, performance.now())
    if (attributes) span.setAttributes(attributes)
    this.spans.push(span)
    return span
  }
  startActiveSpan<T>(name: string, fn: (span: Span) => T, attributes?: Attributes): T {
    const span = this.startSpan(name, attributes)
    return fn(span)
  }
}
class OTelLogger implements Logger {
  private logs: Array<{ level: string; message: string; attributes?: Attributes; time: number }> = []
  info(message: string, attributes?: Attributes): void {
    this.logs.push({ level: 'info', message, attributes, time: performance.now() })
  }
  warn(message: string, attributes?: Attributes): void {
    this.logs.push({ level: 'warn', message, attributes, time: performance.now() })
  }
  error(message: string, error?: Error, attributes?: Attributes): void {
    this.logs.push({ level: 'error', message, attributes: { ...attributes, error: error?.message }, time: performance.now() })
  }
  debug(message: string, attributes?: Attributes): void {
    this.logs.push({ level: 'debug', message, attributes, time: performance.now() })
  }
}
class OTelLoggerProvider implements LoggerProvider {
  private loggers: Map<string, OTelLogger> = new Map()
  getLogger(name: string): Logger {
    if (!this.loggers.has(name)) this.loggers.set(name, new OTelLogger())
    return this.loggers.get(name)!
  }
}
class OTelTracerProvider implements TracerProvider {
  private tracers: Map<string, OTelTracer> = new Map()
  getTracer(name: string): Tracer {
    if (!this.tracers.has(name)) this.tracers.set(name, new OTelTracer())
    return this.tracers.get(name)!
  }
}
class OTelMeterProvider implements MeterProvider {
  private meters: Map<string, OTelMeter> = new Map()
  getMeter(name: string): Meter {
    if (!this.meters.has(name)) this.meters.set(name, new OTelMeter())
    return this.meters.get(name)!
  }
}
class OTelTelemetryProvider implements TelemetryProvider {
  meterProvider: MeterProvider = new OTelMeterProvider()
  loggerProvider: LoggerProvider = new OTelLoggerProvider()
  tracerProvider: TracerProvider = new OTelTracerProvider()
  meter: Meter = this.meterProvider.getMeter('default')
  async shutdown(): Promise<void> {}
}

// ── Factory ───────────────────────────────────────────────────────────────────

function createProvider(mode: string): TelemetryProvider {
  return mode === 'noop' ? new NoOpTelemetryProvider() : new OTelTelemetryProvider()
}

// ── Config ────────────────────────────────────────────────────────────────────

const SDK_CALL_COUNT = 1_000
const STREAM_EVENT_COUNT = 5_000
const WARMUP_ITERATIONS = 50

// ── Measurement helpers ───────────────────────────────────────────────────────

function memoryMB(): number {
  return process.memoryUsage().heapUsed / 1024 / 1024
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]!
}

function calcStats(samples: number[]): { p50: number; p95: number; p99: number; mean: number } {
  const sorted = [...samples].sort((a, b) => a - b)
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    mean,
  }
}

function round(n: number, decimals = 3): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

// ── Benchmark phases ──────────────────────────────────────────────────────────

function measureStartupTime(mode: string): number {
  const t0 = performance.now()
  createProvider(mode)
  return performance.now() - t0
}

function measureSdkCallLatency(
  provider: TelemetryProvider
): { counter: number[]; histogram: number[]; span: number[] } {
  // Warmup pass
  const wCounter = provider.meter.createCounter('bench.warmup')
  const wHistogram = provider.meter.createHistogram('bench.warmup.hist')
  const wTracer = provider.tracerProvider.getTracer('bench')
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    wCounter.add(1, { op: 'warmup' })
    wHistogram.record(i, { op: 'warmup' })
    wTracer.startSpan('warmup').end()
  }

  // Counter calls
  const benchCounter = provider.meter.createCounter('bench.counter')
  const counterSamples: number[] = []
  for (let i = 0; i < SDK_CALL_COUNT; i++) {
    const t0 = performance.now()
    benchCounter.add(1, { iteration: i, label: 'bench' })
    counterSamples.push(performance.now() - t0)
  }

  // Histogram calls
  const benchHistogram = provider.meter.createHistogram('bench.histogram', { unit: 'ms' })
  const histSamples: number[] = []
  for (let i = 0; i < SDK_CALL_COUNT; i++) {
    const t0 = performance.now()
    benchHistogram.record(Math.random() * 100, { bucket: 'test' })
    histSamples.push(performance.now() - t0)
  }

  // Span calls
  const benchTracer = provider.tracerProvider.getTracer('bench.tracer')
  const spanSamples: number[] = []
  for (let i = 0; i < SDK_CALL_COUNT; i++) {
    const t0 = performance.now()
    const span = benchTracer.startSpan('bench.span', { iteration: i })
    span.addEvent('checkpoint', { i })
    span.setAttributes({ done: true })
    span.end()
    spanSamples.push(performance.now() - t0)
  }

  return { counter: counterSamples, histogram: histSamples, span: spanSamples }
}

function measureStreamThroughput(provider: TelemetryProvider): number {
  const logger = provider.loggerProvider.getLogger('bench.stream')
  const counter = provider.meter.createCounter('bench.stream.events')

  const t0 = performance.now()
  for (let i = 0; i < STREAM_EVENT_COUNT; i++) {
    logger.info('stream.event', { seq: i, payload: 'x'.repeat(32) })
    counter.add(1, { event: 'stream', seq: i })
  }
  const elapsed = performance.now() - t0

  return STREAM_EVENT_COUNT / (elapsed / 1000)
}

function measureMemoryDelta(
  provider: TelemetryProvider
): { before: number; after: number; delta: number } {
  if (typeof global !== 'undefined' && typeof (global as { gc?: () => void }).gc === 'function') {
    (global as { gc: () => void }).gc()
  }

  const before = memoryMB()

  const counters = Array.from({ length: 10 }, (_, i) =>
    provider.meter.createCounter(`bench.mem.counter.${i}`)
  )
  const histograms = Array.from({ length: 10 }, (_, i) =>
    provider.meter.createHistogram(`bench.mem.hist.${i}`)
  )
  const tracer = provider.tracerProvider.getTracer('bench.mem')

  for (let i = 0; i < SDK_CALL_COUNT; i++) {
    counters[i % 10]!.add(1, { i })
    histograms[i % 10]!.record(i * 0.5, { i })
    tracer.startSpan(`mem.span.${i}`).end()
  }

  const after = memoryMB()
  return { before: round(before), after: round(after), delta: round(after - before) }
}

// ── Per-mode runner ───────────────────────────────────────────────────────────

interface ModeResult {
  mode: string
  startupMs: number
  sdkCalls: {
    count: number
    counter: { p50: number; p95: number; p99: number; mean: number }
    histogram: { p50: number; p95: number; p99: number; mean: number }
    span: { p50: number; p95: number; p99: number; mean: number }
    throughputOpsPerSec: number
  }
  streamThroughputEventsPerSec: number
  memory: { beforeMB: number; afterMB: number; deltaMB: number }
}

function runMode(mode: string): ModeResult {
  const startupMs = round(measureStartupTime(mode))

  const provider = createProvider(mode)

  const latencyRaw = measureSdkCallLatency(provider)
  const allSamples = [...latencyRaw.counter, ...latencyRaw.histogram, ...latencyRaw.span]
  const totalElapsedMs = allSamples.reduce((s, v) => s + v, 0)
  const throughputOpsPerSec = round((SDK_CALL_COUNT * 3) / (totalElapsedMs / 1000))

  const streamThroughput = round(measureStreamThroughput(provider))
  const memory = measureMemoryDelta(provider)

  const roundStats = (s: ReturnType<typeof calcStats>) => ({
    p50: round(s.p50, 4),
    p95: round(s.p95, 4),
    p99: round(s.p99, 4),
    mean: round(s.mean, 4),
  })

  return {
    mode,
    startupMs,
    sdkCalls: {
      count: SDK_CALL_COUNT,
      counter: roundStats(calcStats(latencyRaw.counter)),
      histogram: roundStats(calcStats(latencyRaw.histogram)),
      span: roundStats(calcStats(latencyRaw.span)),
      throughputOpsPerSec,
    },
    streamThroughputEventsPerSec: streamThroughput,
    memory: {
      beforeMB: memory.before,
      afterMB: memory.after,
      deltaMB: memory.delta,
    },
  }
}

// ── Overhead computation ──────────────────────────────────────────────────────

function computeOverhead(
  noopResult: ModeResult,
  otelResult: ModeResult
): Record<string, number> {
  const pct = (base: number, other: number): number =>
    base === 0 ? 0 : round(((other - base) / base) * 100, 2)

  return {
    startupOverheadPct: pct(noopResult.startupMs, otelResult.startupMs),
    counterLatencyOverheadPct: pct(
      noopResult.sdkCalls.counter.mean,
      otelResult.sdkCalls.counter.mean
    ),
    histogramLatencyOverheadPct: pct(
      noopResult.sdkCalls.histogram.mean,
      otelResult.sdkCalls.histogram.mean
    ),
    spanLatencyOverheadPct: pct(noopResult.sdkCalls.span.mean, otelResult.sdkCalls.span.mean),
    // positive = noop is faster (expected)
    throughputAdvantageOfNoopPct: pct(
      otelResult.sdkCalls.throughputOpsPerSec,
      noopResult.sdkCalls.throughputOpsPerSec
    ),
    streamThroughputAdvantageOfNoopPct: pct(
      otelResult.streamThroughputEventsPerSec,
      noopResult.streamThroughputEventsPerSec
    ),
    memoryDeltaOverheadPct: pct(noopResult.memory.deltaMB, otelResult.memory.deltaMB),
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  process.stderr.write('[benchmark] Running noop mode...\n')
  const noopResult = runMode('noop')

  process.stderr.write('[benchmark] Running otel mode...\n')
  const otelResult = runMode('otel')

  const overhead = computeOverhead(noopResult, otelResult)

  const output = {
    meta: {
      timestamp: new Date().toISOString(),
      sdkCallCount: SDK_CALL_COUNT,
      streamEventCount: STREAM_EVENT_COUNT,
      warmupIterations: WARMUP_ITERATIONS,
      runtime: process.version,
      platform: process.platform,
    },
    results: {
      noop: noopResult,
      otel: otelResult,
    },
    abstractionLayerOverhead: overhead,
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}

main()
