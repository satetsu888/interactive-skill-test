---
name: demo-skill
description: A demo skill that shows items for user approval via a browser UI.
---

## Overview

This skill launches a browser-based UI for the user to approve or reject items.

## Usage

1. Prepare the data as JSON with the following structure:
   ```json
   {
     "message": "Please review the following items",
     "items": [
       { "id": "1", "title": "Item title", "description": "Item description" },
       ...
     ]
   }
   ```

2. Run the following command **in the background**:
   ```bash
   node skills/demo-skill/server.mjs --port 5190 --data '<JSON data>'
   ```
   If port 5190 is in use, try another port (5191, 5192, etc.).

3. Open the URL in the user's browser:
   ```bash
   open http://localhost:5190
   ```

4. The background command will complete when the user submits their decisions. The output is a JSON object:
   ```json
   {
     "action": "submit",
     "payload": {
       "results": [
         {"id": "1", "title": "Item A", "decision": "approve"},
         {"id": "2", "title": "Item B", "decision": "reject"}
       ]
     }
   }
   ```
