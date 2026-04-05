---
name: color-palette
description: A skill that lets users visually pick colors using a browser-based color palette builder with live preview.
---

## Overview

This skill launches a browser-based color picker where users can select colors for a palette. Includes a live preview showing how the colors look together.

## Usage

1. Prepare the data as JSON with the following structure:
   ```json
   {
     "title": "Pick colors for the dashboard theme",
     "description": "Optional description of what the colors will be used for",
     "slots": [
       { "label": "Primary", "defaultValue": "#6366f1" },
       { "label": "Secondary", "defaultValue": "#22c55e" },
       { "label": "Accent", "defaultValue": "#f59e0b" }
     ]
   }
   ```
   - `slots`: Each slot represents a color to pick. `defaultValue` is optional (defaults to #6366f1).

2. Run the following command **in the background**:
   ```bash
   node skills/color-palette/server.mjs --port 5190 --data '<JSON data>'
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
       "colors": {
         "Primary": "#6366f1",
         "Secondary": "#22c55e",
         "Accent": "#f59e0b"
       }
     }
   }
   ```

## Example use cases

- Choosing brand colors
- Designing a UI color theme
- Selecting chart/graph colors
- Picking colors for a presentation
