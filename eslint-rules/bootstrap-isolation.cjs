/**
 * ESLint Rule: bootstrap-isolation
 *
 * Enforces the DAG-leaf property of src/bootstrap/state.ts.
 *
 * bootstrap/state.ts is the root state module — it must not import from
 * src/state/* (the extracted Tier 2–4 domain modules) because that would
 * create a circular dependency risk and violate the tiered architecture.
 *
 * Justified exceptions (reset helpers, sessionConfig delegates) carry
 * explicit eslint-disable-next-line comments so the intent is documented
 * inline.
 *
 * Files inside src/state/ are free to import siblings (Tier 4 modules are
 * independent). All other consumers import directly from src/state/*.
 */
'use strict'

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce bootstrap isolation — bootstrap/state.ts must not import from src/state/* (DAG leaf)',
      category: 'Architecture',
      recommended: true,
    },
    messages: {
      bootstrapImportsState:
        'bootstrap/state.ts must not import from "{{ source }}". ' +
        'bootstrap is a DAG leaf; add an eslint-disable-next-line comment if this import is justified.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename()

    // Normalize path separators for Windows compatibility
    const normalized = filename.replace(/\\/g, '/')

    // This rule only applies to bootstrap/state.ts itself
    if (!normalized.includes('bootstrap/state.ts')) {
      return {}
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (typeof source !== 'string') return

        // Flag imports from src/state/* inside bootstrap/state.ts
        if (source.includes('src/state/') || source.match(/^\.\.?\/.*state\//)) {
          context.report({
            node,
            messageId: 'bootstrapImportsState',
            data: { source },
          })
        }
      },
    }
  },
}
