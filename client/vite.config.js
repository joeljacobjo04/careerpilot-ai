import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:5000" },
    // lets an https tunnel (cloudflared / ngrok / localtunnel) reach the dev server, so phones can test push
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app", ".ngrok.io", ".loca.lt"],
  },
});
