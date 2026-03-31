import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";


//react plugin use

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
} as any);
