/**
 * ProviderErrorDisplay - friendly UX for unsupported / stub LLM providers.
 *
 * When a user selects Bedrock, Vertex, or Foundry — which are not yet
 * implemented — this component surfaces a clear, actionable message instead
 * of a raw JavaScript Error stack.
 *
 * Usage:
 *   <ProviderErrorDisplay provider="bedrock" />
 *   <ProviderErrorDisplay provider="vertex" fallbackProvider="anthropic" />
 *
 * Design: a prominent warning header line; an indented detail block with
 * consistent label/value rhythm; fallback callout using an arrow icon;
 * optional docs + contribution hints in muted text. The component never
 * crashes on unknown provider strings — it degrades gracefully.
 */

import figures from 'figures'
import * as React from 'react'
import { Box, Text } from '../ink.js'

// ─── types ───────────────────────────────────────────────────────────────────

export type UnsupportedProvider = 'bedrock' | 'vertex' | 'foundry'
export type SupportedProvider = 'anthropic'

type ProviderMeta = {
  displayName: string
  docsUrl: string
  eta: string
}

// ─── data ─────────────────────────────────────────────────────────────────────

/** Providers that are stubs / not-yet-implemented. */
const STUB_PROVIDERS = new Set<string>(['bedrock', 'vertex', 'foundry'])

const PROVIDER_META: Record<UnsupportedProvider, ProviderMeta> = {
  bedrock: {
    displayName: 'AWS Bedrock',
    docsUrl: 'https://github.com/nexus-cli/nexus/blob/main/PROVIDERS.md#bedrock',
    eta: 'in progress',
  },
  vertex: {
    displayName: 'Google Vertex AI',
    docsUrl: 'https://github.com/nexus-cli/nexus/blob/main/PROVIDERS.md#vertex',
    eta: 'planned',
  },
  foundry: {
    displayName: 'Azure AI Foundry',
    docsUrl: 'https://github.com/nexus-cli/nexus/blob/main/PROVIDERS.md#foundry',
    eta: 'planned',
  },
}

const FALLBACK_LABEL: Record<SupportedProvider, string> = {
  anthropic: 'Anthropic API',
}

// ─── guards ───────────────────────────────────────────────────────────────────

export function isUnsupportedProvider(provider: string): provider is UnsupportedProvider {
  return STUB_PROVIDERS.has(provider)
}

// ─── sub-components ───────────────────────────────────────────────────────────

/** The bold warning header line. */
function ErrorHeader(): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color="warning">{figures.warning}</Text>
      <Text bold>Provider not yet implemented</Text>
    </Box>
  )
}

/** A single label / value detail row. */
function DetailRow({
  label,
  children,
}: {
  label: string
  children?: React.ReactNode
}): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text dimColor>{label}</Text>
      {children}
    </Box>
  )
}

/** Fallback callout with an arrow icon. */
function FallbackRow({ label }: { label: string }): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color="success">{figures.arrowRight}</Text>
      <Text dimColor>using</Text>
      <Text bold>{label}</Text>
      <Text dimColor>instead</Text>
    </Box>
  )
}

/** Muted URL line. */
function DocsRow({ url }: { url: string }): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text dimColor>docs</Text>
      <Text dimColor underline>
        {url}
      </Text>
    </Box>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

type Props = {
  /** The provider that was selected but is not yet implemented. */
  provider: UnsupportedProvider | string
  /**
   * The provider Nexus will use as a fallback.
   * If not set, no fallback line is shown.
   * @default 'anthropic'
   */
  fallbackProvider?: SupportedProvider
  /** Whether to show the docs link hint. @default true */
  showDocsHint?: boolean
}

export function ProviderErrorDisplay({
  provider,
  fallbackProvider = 'anthropic',
  showDocsHint = true,
}: Props): React.ReactNode {
  const meta = isUnsupportedProvider(provider) ? PROVIDER_META[provider] : null
  const displayName = meta?.displayName ?? provider
  const docsUrl = meta?.docsUrl
  const eta = meta?.eta ?? 'unknown'
  const fallbackLabel = FALLBACK_LABEL[fallbackProvider]

  return (
    <Box flexDirection="column" gap={0}>
      {/* ── Warning header ── */}
      <ErrorHeader />

      {/* ── Detail block (indented 2 chars) ── */}
      <Box flexDirection="column" gap={0} paddingLeft={2}>
        {/* Selected provider + status */}
        <DetailRow label="selected">
          <Text color="warning" bold>{displayName}</Text>
          <Text dimColor>— status: {eta}</Text>
        </DetailRow>

        {/* Fallback provider */}
        <FallbackRow label={fallbackLabel} />

        {/* Docs URL */}
        {showDocsHint && docsUrl != null && (
          <DocsRow url={docsUrl} />
        )}

        {/* Contribute hint */}
        {showDocsHint && (
          <Box>
            <Text dimColor>
              see <Text bold dimColor={false}>PROVIDERS.md</Text> for adapter implementation guidance
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ─── utility ──────────────────────────────────────────────────────────────────

/**
 * Utility: given any provider string, return a ProviderErrorDisplay if the
 * provider is unsupported, otherwise return null.
 *
 * @example
 *   {maybeProviderError('bedrock')}
 */
export function maybeProviderError(
  provider: string,
  fallbackProvider: SupportedProvider = 'anthropic',
): React.ReactNode {
  if (!isUnsupportedProvider(provider)) return null
  return (
    <ProviderErrorDisplay
      provider={provider}
      fallbackProvider={fallbackProvider}
    />
  )
}
