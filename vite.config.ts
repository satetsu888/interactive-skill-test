import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve, basename } from "node:path"
import { renameSync, globSync } from "node:fs"
import { build, type InlineConfig } from "vite"

function getAllSkills(): string[] {
  return globSync("*.html", { cwd: __dirname }).map((f) =>
    basename(f, ".html"),
  )
}

function makeConfig(name: string): InlineConfig {
  return {
    configFile: false,
    plugins: [
      react(),
      {
        name: "rename-to-index-html",
        closeBundle() {
          try {
            renameSync(
              resolve(__dirname, `skills/${name}/dist/${name}.html`),
              resolve(__dirname, `skills/${name}/dist/index.html`),
            )
          } catch {}
        },
      },
    ],
    root: __dirname,
    build: {
      outDir: `skills/${name}/dist`,
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, `${name}.html`),
      },
    },
  }
}

const skill = process.env.SKILL

export default defineConfig({
  plugins: [
    react(),
    ...(!skill
      ? [
          {
            name: "build-all-skills",
            async buildStart() {
              if (process.env.__VITE_BUILD_ALL_RUNNING__) return
              process.env.__VITE_BUILD_ALL_RUNNING__ = "1"
              const skills = getAllSkills()
              for (const name of skills) {
                await build(makeConfig(name))
              }
              process.exit(0)
            },
          },
        ]
      : [
          {
            name: "rename-to-index-html",
            closeBundle() {
              try {
                renameSync(
                  resolve(
                    __dirname,
                    `skills/${skill}/dist/${skill}.html`,
                  ),
                  resolve(__dirname, `skills/${skill}/dist/index.html`),
                )
              } catch {}
            },
          },
        ]),
  ],
  root: ".",
  build: skill
    ? {
        outDir: `skills/${skill}/dist`,
        emptyOutDir: true,
        rollupOptions: {
          input: resolve(__dirname, `${skill}.html`),
        },
      }
    : {},
  server: {
    proxy: {
      "/api": "http://localhost:5190",
    },
  },
})
