#!/usr/bin/env node

import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    description: { type: "string", default: "" },
    title: { type: "string", default: "" },
  },
})

const name = values.name
if (!name) {
  console.error("Usage: node skills/create-interactive-ui/create-skill.mjs --name <skill-name> [--description <desc>] [--title <title>]")
  console.error("  --name         Skill identifier (e.g. my-viewer)")
  console.error("  --description  One-line description for SKILL.md")
  console.error("  --title        Display title (defaults to name)")
  process.exit(1)
}

const root = resolve(import.meta.dirname, "../..")
const title = values.title || name
const description = values.description || `A skill that ${name} does.`

const htmlPath = join(root, `${name}.html`)
const srcDir = join(root, "src", name)
const skillDir = join(root, "skills", name)

// Guard against overwriting
for (const p of [htmlPath, srcDir, skillDir]) {
  if (existsSync(p)) {
    console.error(`Already exists: ${p}`)
    process.exit(1)
  }
}

// --- Generate files ---

// 1. HTML entry point
writeFileSync(htmlPath, `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/${name}/main.tsx"></script>
  </body>
</html>
`)

// 2. src/{name}/main.tsx
mkdirSync(srcDir, { recursive: true })
writeFileSync(join(srcDir, "main.tsx"), `import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
`)

// 3. src/{name}/App.tsx — minimal working template
writeFileSync(join(srcDir, "App.tsx"), `import { useAgentBridge } from "../hooks/useAgentBridge"

// TODO: Define your input data type
interface ${toPascalCase(name)}Data {
  title?: string
  // Add fields here
}

export function App() {
  const { data, loading, done, respond } = useAgentBridge<${toPascalCase(name)}Data>()

  if (loading || !data) {
    return (
      <div style={styles.center}>
        <p>Loading...</p>
      </div>
    )
  }

  if (done) {
    return (
      <div style={styles.center}>
        <p style={{ fontSize: 24, color: "#4CAF50" }}>\u2713 Submitted</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h1>{data.title ?? "${title}"}</h1>

      {/* TODO: Build your UI here */}
      <pre style={styles.debug}>{JSON.stringify(data, null, 2)}</pre>

      <button
        style={styles.submitBtn}
        onClick={() => respond("submit", { /* TODO: payload */ })}
      >
        Submit
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 800,
    margin: "0 auto",
    padding: 24,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#888",
  },
  debug: {
    background: "#f5f5f5",
    padding: 16,
    borderRadius: 8,
    fontSize: 13,
    overflow: "auto",
  },
  submitBtn: {
    marginTop: 16,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
}
`)

// 4. skills/{name}/server.mjs
mkdirSync(skillDir, { recursive: true })
writeFileSync(join(skillDir, "server.mjs"), `import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { join, extname } from "node:path"
import { parseArgs } from "node:util"

const { values } = parseArgs({
  options: {
    data: { type: "string" },
    port: { type: "string", default: "5190" },
  },
})

const PORT = Number(values.port)
const DIST = new URL("./dist", import.meta.url).pathname
const initialData = JSON.parse(values.data || "{}")

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
}

let resolveResult

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    res.writeHead(204).end()
    return
  }

  if (req.method === "GET" && req.url === "/api/data") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(initialData))
    return
  }

  if (req.method === "POST" && req.url === "/api/respond") {
    const body = JSON.parse(await readBody(req))
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
    resolveResult(body)
    return
  }

  // Static file serving
  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0]
  try {
    const filePath = join(DIST, urlPath)
    const data = await readFile(filePath)
    const ext = extname(filePath)
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    })
    res.end(data)
  } catch {
    // SPA fallback
    try {
      const data = await readFile(join(DIST, "index.html"))
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(data)
    } catch {
      res.writeHead(404).end("Not Found")
    }
  }
})

server.listen(PORT, () => {
  console.error(\`Skill app ready: http://localhost:\${PORT}\`)
})

const result = await new Promise((r) => {
  resolveResult = r
})
console.log(JSON.stringify(result))
server.close()
process.exit(0)

function readBody(req) {
  return new Promise((resolve) => {
    let data = ""
    req.on("data", (chunk) => (data += chunk))
    req.on("end", () => resolve(data))
  })
}
`)

// 5. skills/{name}/SKILL.md
writeFileSync(join(skillDir, "SKILL.md"), `---
name: ${name}
description: ${description}
---

## Overview

TODO: Describe what this skill does.

## Usage

1. Prepare the data as JSON:
   \`\`\`json
   {
     "title": "Example"
   }
   \`\`\`

2. Run the following command **in the background**:
   \`\`\`bash
   node skills/${name}/server.mjs --port 5190 --data '<JSON data>'
   \`\`\`
   If port 5190 is in use, try another port (5191, 5192, etc.).

3. Open the URL in the user's browser:
   \`\`\`bash
   open http://localhost:5190
   \`\`\`

4. The background command will complete when the user clicks Submit. The output is a JSON object:
   \`\`\`json
   {
     "action": "submit",
     "payload": {}
   }
   \`\`\`
`)

console.log(`Created skill "${name}":`)
console.log(`  ${htmlPath}`)
console.log(`  ${srcDir}/main.tsx`)
console.log(`  ${srcDir}/App.tsx`)
console.log(`  ${skillDir}/server.mjs`)
console.log(`  ${skillDir}/SKILL.md`)
console.log()
console.log(`Next steps:`)
console.log(`  1. Edit src/${name}/App.tsx to build your UI`)
console.log(`  2. Edit skills/${name}/SKILL.md to document input/output`)
console.log(`  3. Build: SKILL=${name} npx vite build`)
console.log(`  4. Test:  node skills/${name}/server.mjs --port 5190 --data '{"title":"test"}'`)

function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("")
}
