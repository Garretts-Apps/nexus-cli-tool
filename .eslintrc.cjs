/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  // Plugins are registered so ESLint recognises their rule names in
  // eslint-disable comments carried over from the upstream codebase.
  // Only custom-rules/bootstrap-isolation is actively enforced.
  plugins: [
    'custom-rules',
    '@typescript-eslint',
    'react-hooks',
    'n',
  ],
  rules: {
    'custom-rules/bootstrap-isolation': 'error',
  },
}
