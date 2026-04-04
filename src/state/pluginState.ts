// Tier 4 auxiliary state: Plugin configuration session state.
// Extracted from src/bootstrap/state.ts (ARCH-002 Phase 1).

// NOTE: setUseCoworkPlugins() calls resetSettingsCache() as a callback
// side-effect. This is a DAG violation (state → settings) inherited from the
// original code. Documented here rather than removed to preserve behavior.
import { resetSettingsCache } from 'src/utils/settings/settingsCache.js'

// Session-only plugins from --plugin-dir flag
let inlinePlugins: Array<string> = []
// Explicit --chrome / --no-chrome flag value (undefined = not set on CLI)
let chromeFlagOverride: boolean | undefined = undefined
// Use cowork_plugins directory instead of plugins (--cowork flag or env var)
let useCoworkPlugins = false

export function setInlinePlugins(plugins: Array<string>): void {
  inlinePlugins = plugins
}

export function getInlinePlugins(): Array<string> {
  return inlinePlugins
}

export function setChromeFlagOverride(value: boolean | undefined): void {
  chromeFlagOverride = value
}

export function getChromeFlagOverride(): boolean | undefined {
  return chromeFlagOverride
}

export function setUseCoworkPlugins(value: boolean): void {
  useCoworkPlugins = value
  resetSettingsCache()
}

export function getUseCoworkPlugins(): boolean {
  return useCoworkPlugins
}

/** Reset to initial state (test helper). */
export function resetPluginState(): void {
  inlinePlugins = []
  chromeFlagOverride = undefined
  useCoworkPlugins = false
}
