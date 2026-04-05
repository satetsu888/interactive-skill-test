import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { join, extname, resolve } from "node:path"
import { parseArgs } from "node:util"

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    title: { type: "string", default: "Plan Review" },
    port: { type: "string", default: "5190" },
  },
})

if (!values.file) {
  console.error("Error: --file <path> is required")
  process.exit(1)
}

const PORT = Number(values.port)
const DIST = new URL("./dist", import.meta.url).pathname

const filePath = resolve(values.file)
const body = await readFile(filePath, "utf-8")
const initialData = { title: values.title, body }

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
  console.error(`Skill app ready: http://localhost:${PORT}`)
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
