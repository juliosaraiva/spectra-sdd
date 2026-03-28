import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30000,
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/index.ts", "src/cli/commands/**"],
      reporter: ["text", "lcov", "json"],
      thresholds: {
        lines: 90,
        branches: 80,
        functions: 90,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@spectra": new URL("./src", import.meta.url).pathname,
    },
  },
});
