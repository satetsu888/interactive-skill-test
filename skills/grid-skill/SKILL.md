---
name: grid-selector
description: A skill that lets users select cells on a grid by clicking and dragging. Useful for scheduling, availability, seat selection, etc.
---

## Overview

This skill launches a browser-based grid where users can click and drag to select cells. Supports row/column header clicks to toggle entire rows/columns.

## Usage

1. Prepare the data as JSON with the following structure:
   ```json
   {
     "title": "Select your available time slots",
     "description": "Optional description",
     "rows": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
     "columns": ["9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
     "preselected": ["Monday:9:00", "Monday:10:00"]
   }
   ```
   - `rows` and `columns`: Labels for the grid axes.
   - `preselected`: Optional array of pre-selected cells in "row:col" format.

2. Run the following command **in the background**:
   ```bash
   node skills/grid-skill/server.mjs --port 5190 --data '<JSON data>'
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
       "selected": ["Monday:9:00", "Monday:10:00", "Tuesday:14:00"],
       "byRow": {
         "Monday": ["9:00", "10:00"],
         "Tuesday": ["14:00"]
       },
       "totalSelected": 3
     }
   }
   ```

## Example use cases

- Scheduling: select available time slots across days
- Seat selection: choose seats on a grid layout
- Feature matrix: mark which features apply to which plans
- Availability survey: mark available dates/times
