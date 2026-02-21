import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.PTK_VITE_BASE ?? "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ["maplibre-gl"]
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"]
  }
});
