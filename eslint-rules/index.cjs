'use strict'

const bootstrapIsolation = require('./bootstrap-isolation.cjs')

// No-op stub rule for upstream eslint-disable comments that reference
// custom rules from the original project config. Without these stubs,
// ESLint reports "Definition for rule 'custom-rules/X' was not found"
// for every disable comment in the codebase.
const noop = {
  meta: { type: 'suggestion', schema: [] },
  create() { return {} },
}

// Upstream custom-rules referenced in eslint-disable comments
const upstreamStubs = [
  'no-cross-platform-process-issues',
  'no-direct-json-operations',
  'no-direct-ps-commands',
  'no-lookbehind-regex',
  'no-process-cwd',
  'no-process-env-top-level',
  'no-process-exit',
  'no-sync-fs',
  'no-top-level-dynamic-import',
  'no-top-level-side-effects',
  'prefer-use-keybindings',
  'prefer-use-terminal-size',
  'prompt-spacing',
  'require-bun-typeof-guard',
  'require-tool-match-name',
  'safe-env-boolean-check',
]

const rules = {
  'bootstrap-isolation': bootstrapIsolation,
}

for (const name of upstreamStubs) {
  rules[name] = noop
}

module.exports = { rules }
