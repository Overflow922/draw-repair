import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/draw-repair/',
  test: {
    exclude: [...configDefaults.exclude, '.claude/**'],
    // Property-style invariant suites take ~6 s alone and more under full-suite load.
    testTimeout: 30_000,
  },
})
