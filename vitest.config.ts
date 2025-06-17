import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      enabled: true, // or overriden by "vitest --coverage"
      include: ['src/**'],
    },
  },
})