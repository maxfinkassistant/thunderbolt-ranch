import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// GitHub Pages serves the project under /thunderbolt-ranch/; a custom
// domain later just sets VITE_BASE=/ in the workflow.
export default defineConfig(({ command }) => ({
  base: command === "build" ? (process.env.VITE_BASE ?? "/thunderbolt-ranch/") : "/",
  // singlefile inlines JS/CSS into one portable index.html
  plugins: [react(), viteSingleFile()],
  server: { port: 5176 },
}));
