/**
 * CODE-001: useCostThreshold — extracted from REPL.tsx
 *
 * Tracks the $5 cost threshold and controls the cost dialog visibility.
 * Isolated so that the 200k+/session cost-check renders do not drag the
 * entire REPL tree along; only callers of this hook re-render on state change.
 *
 * PERF-008 note: the returned effect is gated on messagesLength (not the full
 * messages array reference) because getTotalCost() reads accumulated cost state
 * and does not inspect message content.
 */
import { useState, useEffect } from 'react'
import { hasConsoleBillingAccess } from '../utils/billing.js'
import { getGlobalConfig } from '../utils/config.js'
import { getTotalCost } from '../cost-tracker.js'
import { logEvent } from '../services/analytics/index.js'

const COST_THRESHOLD_USD = 5

export function useCostThreshold(messagesLength: number): {
  showCostDialog: boolean
  setShowCostDialog: (v: boolean) => void
  setHaveShownCostDialog: (v: boolean) => void
} {
  const [showCostDialog, setShowCostDialog] = useState(false)
  const [haveShownCostDialog, setHaveShownCostDialog] = useState(
    () => getGlobalConfig().hasAcknowledgedCostThreshold,
  )

  // PERF-008: Gate on messagesLength (not the full array reference).
  // getTotalCost() reads accumulated cost state; it doesn't inspect message
  // content. Using the full array caused this effect to fire on every streamed
  // token (content mutations create new array refs), generating 200k+ spurious
  // re-runs per session. Length-gating means we only recheck when a new message
  // is appended — the only time new cost could actually cross the threshold.
  useEffect(() => {
    const totalCost = getTotalCost()
    if (
      totalCost >= COST_THRESHOLD_USD &&
      !showCostDialog &&
      !haveShownCostDialog
    ) {
      logEvent('tengu_cost_threshold_reached', {})
      // Mark as shown even if the dialog won't render (no console billing
      // access). Otherwise this effect re-fires on every message change for
      // the rest of the session — 200k+ spurious events observed.
      setHaveShownCostDialog(true)
      if (hasConsoleBillingAccess()) {
        setShowCostDialog(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLength, showCostDialog, haveShownCostDialog])

  return { showCostDialog, setShowCostDialog, setHaveShownCostDialog }
}
