---
name: create-interactive-ui
description: Scaffolds a new interactive browser-based skill. Generates all boilerplate files (HTML, React components, server, SKILL.md) so you only need to customize the UI and documentation.
---

## Overview

This skill creates a new interactive browser-based skill by generating all boilerplate files. The generated skill follows the same architecture as all other skills in this project: a Node.js server that serves a React frontend, communicating via `/api/data` and `/api/respond` endpoints.

## Usage

### Step 1: Generate the scaffold

Run the generator script:
```bash
node skills/create-interactive-ui/create-skill.mjs --name <skill-name> --description "<one-line description>" --title "<display title>"
```

This creates the following files:

| File | Purpose |
|---|---|
| `{name}.html` | Vite entry point |
| `src/{name}/main.tsx` | React bootstrap (no changes needed) |
| `src/{name}/App.tsx` | Main UI component (customize this) |
| `skills/{name}/server.mjs` | HTTP server (no changes needed) |
| `skills/{name}/SKILL.md` | Skill documentation (customize this) |

### Step 2: Implement the UI

Edit `src/{name}/App.tsx`. The generated file already includes:
- `useAgentBridge<T>()` hook wired up (provides `data`, `loading`, `done`, `respond`)
- Loading / Done / Main screens
- A debug view showing the raw input JSON
- A Submit button calling `respond("submit", payload)`

Typical changes:
1. Define the input data type (the interface at the top)
2. Replace the debug `<pre>` block with your actual UI
3. Add state for user interactions
4. Set the submit payload to include the user's input

### Step 3: Write the SKILL.md

Edit `skills/{name}/SKILL.md` to document:
1. The input JSON structure (what fields the agent should provide)
2. The output JSON structure (what the agent receives after user interaction)
3. Any special behavior or UI features

Follow the same format as other skills: Overview, Usage (4-step: prepare JSON, run in background, open browser, read output), and input/output tables.

### Step 4: Build and test

```bash
SKILL={name} npx vite build
node skills/{name}/server.mjs --port 5190 --data '<test JSON>'
open http://localhost:5190
```

## Notes

- The `--name` argument becomes both the directory name and the `name:` field in SKILL.md. Use kebab-case (e.g. `my-viewer`).
- The generator refuses to overwrite existing files.
- `server.mjs` and `main.tsx` are identical across all skills and should not need modification.
- The generated App.tsx uses inline styles. You can switch to CSS or a CSS-in-JS approach as needed.
- The `useAgentBridge` hook is shared across all skills at `src/hooks/useAgentBridge.ts`.
