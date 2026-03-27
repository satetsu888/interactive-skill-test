import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"

const skill = process.env.SKILL || "demo"

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: `skills/${skill}-skill/dist`,
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, `${skill}.html`),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:5190",
    },
  },
})
