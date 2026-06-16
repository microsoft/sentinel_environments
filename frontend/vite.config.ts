import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.SENTINEL_API_BASE ?? "http://localhost:8000";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: "../data/public",
  build: {
    chunkSizeWarningLimit: 3000, // 3MB limit
  },
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
