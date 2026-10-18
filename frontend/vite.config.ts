import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// API_URL points at the backend container in docker compose.
const apiUrl = process.env.API_URL ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow ngrok (and any tunnel) hostnames to reach the dev server.
    allowedHosts: true,
    proxy: {
      "/api": apiUrl,
    },
  },
});
