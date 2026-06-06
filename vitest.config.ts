import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Use jsdom DOM environment so IndexedDB APIs are polyfillable
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Wipe all fake-IndexedDB databases between each test
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
