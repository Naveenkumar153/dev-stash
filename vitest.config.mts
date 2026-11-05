import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests for server actions and utilities only. Components and pages are
 * checked in the browser, so there is no jsdom, no React plugin and no `.tsx`
 * test pattern.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Every test starts from fresh mocks and the real environment.
    mockReset: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      include: ["src/actions/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
