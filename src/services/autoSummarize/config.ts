// Leaf config module — intentionally minimal imports so UI components
// can read the auto-summarize enabled state without dragging in the forked
// agent / task registry / message builder chain that autoSummarize.ts pulls in.

import { getInitialSettings } from '../../utils/settings/settings.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'

/**
 * Whether background memory summarization should run. User setting
 * (autoSummarizeEnabled in settings.json) overrides the GrowthBook default
 * when explicitly set; otherwise falls through to tengu_onyx_plover.
 */
export function isAutoSummarizeEnabled(): boolean {
  const setting = getInitialSettings().autoSummarizeEnabled
  if (setting !== undefined) return setting
  const gb = getFeatureValue_CACHED_MAY_BE_STALE<{ enabled?: unknown } | null>(
    'tengu_onyx_plover',
    null,
  )
  return gb?.enabled === true
}
