import type { Command } from '../../commands.js'

const tag = {
  type: 'local-jsx',
  name: 'tag',
  description: 'Toggle a searchable tag on the current session',
  isEnabled: () => process.env.INTERNAL_BUILD === '1',
  argumentHint: '<tag-name>',
  load: () => import('./tag.js'),
} satisfies Command

export default tag
