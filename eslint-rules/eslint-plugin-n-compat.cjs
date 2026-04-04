'use strict'

// Compatibility shim: the upstream codebase uses "eslint-plugin-n/rule-name"
// as the prefix in some eslint-disable comments, but ESLint registers the
// plugin under the short name "n". This shim registers as "eslint-plugin-n"
// so those disable comments resolve without "Definition not found" errors.

const noop = {
  meta: { type: 'suggestion', schema: [] },
  create() { return {} },
}

module.exports = {
  rules: {
    'no-sync': noop,
    'no-unsupported-features/node-builtins': noop,
  },
}
