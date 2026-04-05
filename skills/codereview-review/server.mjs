import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { join, extname, resolve } from "node:path"
import { parseArgs } from "node:util"
import { execSync } from "node:child_process"

const { values } = parseArgs({
  options: {
    data: { type: "string" },
    port: { type: "string", default: "5190" },
  },
})

if (!values.data) {
  console.error("Error: --data <json> is required")
  console.error('JSON format: { title, commit, repo?, comments: [{ id, file, line, body }] }')
  process.exit(1)
}

const PORT = Number(values.port)
const DIST = new URL("./dist", import.meta.url).pathname

const input = JSON.parse(values.data)

// input: { title, description?, commit, repo?, comments: [{ id, file, line, body }] }
const repoDir = input.repo ? resolve(input.repo) : process.cwd()
const commit = input.commit

// Run git diff and parse
const diffOutput = execSync(`git diff ${commit}`, { cwd: repoDir, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 })
const files = parseDiff(diffOutput)

// Attach comments to files
const commentsByFile = new Map()
for (const c of input.comments || []) {
  if (!commentsByFile.has(c.file)) commentsByFile.set(c.file, [])
  commentsByFile.get(c.file).push(c)
}

for (const file of files) {
  file.comments = commentsByFile.get(file.path) || []
}

// Filter to only files that have comments
const reviewFiles = files.filter((f) => f.comments.length > 0)

const initialData = {
  title: input.title || "Code Review",
  description: input.description || "",
  files: reviewFiles,
}

// --- Unified diff parser ---
function parseDiff(raw) {
  const files = []
  const fileChunks = raw.split(/^diff --git /m).filter(Boolean)

  for (const chunk of fileChunks) {
    const lines = chunk.split("\n")

    // Parse file path from "a/path b/path"
    const headerMatch = lines[0].match(/a\/(.+?) b\/(.+)/)
    if (!headerMatch) continue
    const filePath = headerMatch[2]

    // Find hunks
    const hunks = []
    let i = 0
    // Skip to first hunk
    while (i < lines.length && !lines[i].startsWith("@@")) i++

    while (i < lines.length) {
      if (!lines[i].startsWith("@@")) { i++; continue }

      const hunkHeader = lines[i]
      const hunkMatch = hunkHeader.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/)
      if (!hunkMatch) { i++; continue }

      let oldNum = parseInt(hunkMatch[1])
      let newNum = parseInt(hunkMatch[2])
      const hunkLines = []
      i++

      while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("diff --git")) {
        const line = lines[i]
        if (line.startsWith("+")) {
          hunkLines.push({ type: "add", content: line.slice(1), newNum })
          newNum++
        } else if (line.startsWith("-")) {
          hunkLines.push({ type: "delete", content: line.slice(1), oldNum })
          oldNum++
        } else if (line.startsWith("\\")) {
          // "\ No newline at end of file" — skip
        } else {
          // Context line (starts with space or is empty)
          hunkLines.push({ type: "context", content: line.slice(1), oldNum, newNum })
          oldNum++
          newNum++
        }
        i++
      }

      hunks.push({ header: hunkHeader, lines: hunkLines })
    }

    files.push({ path: filePath, hunks, comments: [] })
  }

  return files
}

// --- HTTP server ---
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

  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0]
  try {
    const fp = join(DIST, urlPath)
    const data = await readFile(fp)
    const ext = extname(fp)
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" })
    res.end(data)
  } catch {
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

const result = await new Promise((r) => { resolveResult = r })
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
