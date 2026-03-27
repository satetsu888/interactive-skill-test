---
name: kanban-sort
description: A skill that lets users visually organize items into categories using a drag-and-drop kanban board in the browser.
---

## Overview

This skill launches a browser-based kanban board where users can drag and drop items between columns to categorize or organize them.

## Usage

1. Prepare the data as JSON with the following structure:
   ```json
   {
     "title": "Board title / instruction for the user",
     "columns": ["Column A", "Column B", "Column C"],
     "items": [
       { "id": "1", "title": "Item title", "description": "Optional description" },
       ...
     ]
   }
   ```
   All items start in the first column. The user will drag them into the appropriate columns.

2. Run the following command **in the background**:
   ```bash
   node skills/kanban-skill/server.mjs --port 5190 --data '<JSON data>'
   ```
   If port 5190 is in use, try another port (5191, 5192, etc.).

3. Open the URL in the user's browser:
   ```bash
   open http://localhost:5190
   ```

4. The background command will complete when the user submits. The output is a JSON object:
   ```json
   {
     "action": "submit",
     "payload": {
       "board": {
         "Column A": [{"id": "1", "title": "..."}],
         "Column B": [{"id": "2", "title": "..."}],
         "Column C": []
       }
     }
   }
   ```

## Example use cases

- Categorize tasks by priority (High / Medium / Low)
- Sort items into phases (Now / Next / Later)
- Classify feedback (Bug / Feature / Enhancement)
- Organize migration items (Keep / Modify / Remove)
