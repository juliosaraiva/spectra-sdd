import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/cli/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@spectra": new URL("./src", import.meta.url).pathname,
    },
  },
});
