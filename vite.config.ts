import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serve o front em :5173 e faz proxy de /api → API Hono em :8787.
// Prod: `vite build` emite dist/ (servido pelo OpenLiteSpeed); /api é reverse-proxy no OLS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT || 8787}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
});
