/**
 * Public repository mode — safety utilities for contributing to public/open-source repos.
 *
 * When active, adds safety instructions to commit/PR prompts and
 * strips all attribution to avoid leaking internal information and
 * maintaining appropriate anonymity for public contributions.
 *
 * Activation:
 *   - PUBLIC_REPO_MODE=1 — force ON (even in internal repos)
 *   - Otherwise AUTO: active UNLESS the repo remote matches the internal
 *     allowlist (INTERNAL_MODEL_REPOS in commitAttribution.ts). Safe default
 *     is ON — may push to public remotes from a CWD that isn't itself
 *     a git checkout (e.g. /tmp crash repro).
 *   - There is NO force-OFF. This guards against information leaks — if
 *     we're not confident we're in an internal repo, we stay in public mode.
 *
 * All code paths are gated on process.env.USER_TYPE === 'ant'. Since USER_TYPE is
 * a build-time --define, the bundler constant-folds these checks and dead-code-
 * eliminates the ant-only branches from external builds. In external builds every
 * function in this file reduces to a trivial return.
 */

import { getRepoClassCached } from './commitAttribution.js'
import { getGlobalConfig } from './config.js'
import { isEnvTruthy } from './envUtils.js'

export function isPublicRepoMode(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    if (isEnvTruthy(process.env.PUBLIC_REPO_MODE)) return true
    // Auto: active unless we've positively confirmed we're in an allowlisted
    // internal repo. 'external', 'none', and null (check not yet run) all
    // resolve to ON. The check is primed in setup.ts; only 'internal' → OFF.
    return getRepoClassCached() !== 'internal'
  }
  return false
}

export function getPublicRepoModeInstructions(): string {
  if (process.env.USER_TYPE === 'ant') {
    return `## PUBLIC REPOSITORY MODE — CRITICAL

You are operating in PUBLIC/OPEN-SOURCE repository mode. Your commit
messages, PR titles, and PR bodies MUST NOT contain any internal
information. Maintain appropriate boundaries.

NEVER include in commit messages or PR descriptions:
- Internal model or system names and codenames
- Unreleased version numbers
- Internal repo or project names
- Internal tooling, Slack channels, or short links
- Mentions of proprietary systems or technologies
- Any hint of internal infrastructure
- Co-Authored-By lines or other internal attribution

Write commit messages as a professional developer would — describe only what the code
change does.

GOOD:
- "Fix race condition in file watcher initialization"
- "Add support for custom key bindings"
- "Refactor parser for better error messages"

BAD (never write these):
- "Fix bug found while testing with internal systems"
- "Generated with proprietary tools"
- "Co-Authored-By lines with internal details"
`
  }
  return ''
}

/**
 * Check whether to show the one-time explainer dialog for public repo mode.
 * True when: public repo mode is active via auto-detection (not forced via env),
 * and the user hasn't seen the notice before. Pure — the component marks the
 * flag on mount.
 */
export function shouldShowPublicRepoModeNotice(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    // If forced via env, user already knows; don't nag.
    if (isEnvTruthy(process.env.PUBLIC_REPO_MODE)) return false
    if (!isPublicRepoMode()) return false
    if (getGlobalConfig().hasSeenPublicRepoModeNotice) return false
    return true
  }
  return false
}
