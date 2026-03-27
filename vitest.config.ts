import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30000,
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/index.ts"],
      reporter: ["text", "lcov", "json"],
      thresholds: {
        lines: 20,
        branches: 55,
        functions: 25,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@spectra": new URL("./src", import.meta.url).pathname,
    },
  },
});
