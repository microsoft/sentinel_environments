import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: "../data/public",
  resolve: {
    alias: {
      "@data": path.resolve(__dirname, "../data"),
    },
  },
  build: {
    chunkSizeWarningLimit: 3000, // 3MB limit
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
