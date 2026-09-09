import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // singlefile inlines JS/CSS into one portable index.html for sharing
  plugins: [react(), viteSingleFile()],
  server: { port: 5176 },
});
