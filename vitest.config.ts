import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      src: resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__tests__/**',
        'src/**/*.d.ts',
      ],
    },
  },
})
