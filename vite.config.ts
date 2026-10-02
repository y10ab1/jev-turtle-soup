import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 18730, strictPort: true },
  base: command === "build" && process.env.GITHUB_ACTIONS ? "/jev-turtle-soup/" : "/",
  build: { target: "es2022" },
}));
