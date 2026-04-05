/**
 * PrivacySettings - displays active privacy level and data flow status.
 *
 * Privacy levels (mapped from environment / settings):
 *   no-telemetry      — nothing leaves the process
 *   essential-traffic — only API calls; no analytics or telemetry
 *   default           — standard operation (analytics + telemetry enabled)
 *
 * Color coding:
 *   green  = no-telemetry (most private)
 *   yellow = essential-traffic
 *   default/dim = standard
 *
 * Design: header badge + description on one line; data-flow table with
 * consistent column alignment; env-var hint rendered as inline code tokens.
 */

import figures from 'figures'
import * as React from 'react'
import { Box, Text } from '../ink.js'
import { isTelemetryEnabled } from '../utils/telemetry/index.js'

// ─── types ───────────────────────────────────────────────────────────────────

export type PrivacyLevel = 'no-telemetry' | 'essential-traffic' | 'default'

type DataFlow = {
  label: string
  enabled: boolean
  note: string
}

// ─── detection ───────────────────────────────────────────────────────────────

function detectPrivacyLevel(): PrivacyLevel {
  if (!isTelemetryEnabled()) return 'no-telemetry'
  if (
    process.env.DISABLE_TELEMETRY === '1' ||
    process.env.ANTHROPIC_DISABLE_TELEMETRY === '1'
  ) {
    return 'no-telemetry'
  }
  if (process.env.DISABLE_ANALYTICS === '1') return 'essential-traffic'
  return 'default'
}

function buildDataFlows(level: PrivacyLevel): DataFlow[] {
  const isNoop = level === 'no-telemetry'
  const isEssential = level === 'essential-traffic'

  return [
    {
      label: 'API requests',
      enabled: true,
      note: 'LLM API calls (always required)',
    },
    {
      label: 'OTel metrics',
      enabled: !isNoop,
      note: 'OpenTelemetry counters and spans',
    },
    {
      label: 'Usage analytics',
      enabled: !isNoop && !isEssential,
      note: 'Session-level usage statistics',
    },
    {
      label: 'Error telemetry',
      enabled: !isNoop && !isEssential,
      note: 'Sentry / error event reporting',
    },
    {
      label: 'Feature flags',
      enabled: !isNoop,
      note: 'GrowthBook feature-flag polling',
    },
  ]
}

// ─── metadata maps ────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<PrivacyLevel, 'success' | 'warning' | undefined> = {
  'no-telemetry': 'success',
  'essential-traffic': 'warning',
  default: undefined,
}

const LEVEL_ICON: Record<PrivacyLevel, string> = {
  'no-telemetry': figures.tick,
  'essential-traffic': figures.warning,
  default: figures.info,
}

const LEVEL_DESCRIPTION: Record<PrivacyLevel, string> = {
  'no-telemetry': 'All telemetry and analytics disabled — maximum privacy',
  'essential-traffic': 'API calls only — analytics and error reporting disabled',
  default: 'Standard operation — analytics and telemetry enabled',
}

// ─── sub-components ───────────────────────────────────────────────────────────

/** Pill-style mode badge used in the header. */
function LevelBadge({
  level,
}: {
  level: PrivacyLevel
}): React.ReactNode {
  const color = LEVEL_COLOR[level]
  const icon = LEVEL_ICON[level]
  return (
    <Box flexDirection="row" gap={0}>
      <Text dimColor>[</Text>
      <Text color={color} bold>
        {' '}{icon} {level}{' '}
      </Text>
      <Text dimColor>]</Text>
    </Box>
  )
}

/** A single data-flow row: status icon · label · note. */
function FlowRow({ flow }: { flow: DataFlow; key?: React.Key }): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      {flow.enabled ? (
        <Text color="success">{figures.tick}</Text>
      ) : (
        <Text color="error">{figures.cross}</Text>
      )}
      <Text bold={flow.enabled} dimColor={!flow.enabled} wrap="truncate-end">
        {flow.label}
      </Text>
      <Text dimColor>— {flow.note}</Text>
    </Box>
  )
}

/** Inline env-var token rendered with bold contrast. */
function EnvVar({ name }: { name: string }): React.ReactNode {
  return <Text bold>{name}</Text>
}

// ─── component ────────────────────────────────────────────────────────────────

type Props = {
  /** Override detected privacy level for display purposes. */
  privacyLevel?: PrivacyLevel
  /** Show the per-flow breakdown table. @default true */
  showFlows?: boolean
}

export function PrivacySettings({
  privacyLevel,
  showFlows = true,
}: Props): React.ReactNode {
  const level = privacyLevel ?? detectPrivacyLevel()
  const flows = buildDataFlows(level)

  return (
    <Box flexDirection="column" gap={0}>
      {/* ── Header: label + badge + description ── */}
      <Box flexDirection="row" gap={1} alignItems="flex-start">
        <Text bold>Privacy</Text>
        <LevelBadge level={level} />
        <Text dimColor>{LEVEL_DESCRIPTION[level]}</Text>
      </Box>

      {/* ── Data-flow table ── */}
      {showFlows && (
        <Box flexDirection="column" paddingTop={1} paddingLeft={0}>
          {flows.map((flow, i) => (
            <FlowRow key={i} flow={flow} />
          ))}
        </Box>
      )}

      {/* ── Quick-toggle hint ── */}
      <Box paddingTop={1}>
        <Text dimColor>
          Set <EnvVar name="TELEMETRY_MODE=noop" /> for zero-overhead
          {' '}or <EnvVar name="DISABLE_ANALYTICS=1" /> for essential-traffic.
        </Text>
      </Box>
    </Box>
  )
}
