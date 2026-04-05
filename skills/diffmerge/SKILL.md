---
name: diffmerge
description: A skill that displays two versions of text side-by-side and lets the user choose which side to keep for each chunk, producing a merged result.
---

## Overview

This skill launches a browser-based diff merge UI. Two versions of text are shown side-by-side, split into chunks. The user selects version A or B for each changed chunk, previews the merged result, and submits.

## Usage

1. Prepare the data as JSON. You can provide either pre-split chunks or raw text (which will be diffed line-by-line):

   **Option A: Raw text**
   ```json
   {
     "title": "Merge config changes",
     "description": "Choose which version to keep for each line",
     "labelA": "Current",
     "labelB": "Proposed",
     "textA": "line1\nline2\nline3",
     "textB": "line1\nmodified2\nline3\nnewline4",
     "defaultSelection": "a"
   }
   ```

   **Option B: Pre-split chunks**
   ```json
   {
     "title": "Merge config changes",
     "labelA": "Current",
     "labelB": "Proposed",
     "chunks": [
       { "id": "0", "a": "unchanged line", "b": "unchanged line", "type": "unchanged" },
       { "id": "1", "a": "old version", "b": "new version", "type": "modified" },
       { "id": "2", "a": "", "b": "added line", "type": "added" },
       { "id": "3", "a": "removed line", "b": "", "type": "removed" }
     ]
   }
   ```

2. Run the following command **in the background**:
   ```bash
   node skills/diffmerge/server.mjs --port 5190 --data '<JSON data>'
   ```
   If port 5190 is in use, try another port (5191, 5192, etc.).

3. Open the URL in the user's browser:
   ```bash
   open http://localhost:5190
   ```

4. The background command will complete when the user clicks Submit Merge. The output is a JSON object:
   ```json
   {
     "action": "submit",
     "payload": {
       "mergedText": "line1\nmodified2\nline3\nnewline4",
       "selections": [
         { "chunkId": "0", "selected": "a", "type": "unchanged" },
         { "chunkId": "1", "selected": "b", "type": "modified" },
         { "chunkId": "2", "selected": "b", "type": "added" },
         { "chunkId": "3", "selected": "a", "type": "removed" }
       ],
       "stats": {
         "totalChunks": 4,
         "selectedA": 1,
         "selectedB": 1,
         "unchanged": 2
       }
     }
   }
   ```

### Input fields

| Field | Required | Description |
|---|---|---|
| `title` | yes | Title displayed at the top |
| `description` | no | Description text below the title |
| `labelA` | no | Label for version A (default: "Version A") |
| `labelB` | no | Label for version B (default: "Version B") |
| `textA` / `textB` | no | Raw text to diff line-by-line |
| `chunks` | no | Pre-split chunks (use instead of textA/textB) |
| `defaultSelection` | no | Default selection for modified chunks: `"a"` or `"b"` (default: `"a"`) |

### Chunk types

| Type | Description |
|---|---|
| `unchanged` | Both sides are identical |
| `modified` | Both sides exist but differ |
| `added` | Only version B has content |
| `removed` | Only version A has content |
