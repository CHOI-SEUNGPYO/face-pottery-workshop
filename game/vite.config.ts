import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  publicDir: false,
  build: { assetsInlineLimit: 0, target: "es2022", chunkSizeWarningLimit: 800 },
  server: {
    host: "127.0.0.1", port: 4173, strictPort: true,
    // Downloaded QA images can briefly be locked on Windows; they are not source.
    watch: { ignored: ["**/asset/review/**"] },
  },
});
