import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  publicDir: false,
  build: { assetsInlineLimit: 0, target: "es2022", chunkSizeWarningLimit: 800 },
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
});
