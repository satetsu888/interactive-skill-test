---
name: data-filter
description: A skill that lets users visually filter data points on a scatter plot by clicking individual points or drawing dividing lines. Useful for data exploration and subset selection.
---

## Overview

This skill launches a browser-based scatter plot with two interaction modes:

- **Pick Points**: Click individual data points to include/exclude them. Hover to see labels. Click rows in the table to toggle.
- **Draw Dividing Line**: Drag on the chart to draw a line that splits the data into two groups (colored blue and orange). Then choose which side to keep. Lines can be drawn repeatedly to refine the selection.

## Usage

1. Prepare the data as JSON:
   ```json
   {
     "title": "Filter high-value customers",
     "description": "Select the data points to keep.",
     "xAxis": "revenue",
     "yAxis": "satisfaction",
     "labelField": "name",
     "data": [
       { "id": "1", "name": "Customer A", "revenue": 50000, "satisfaction": 4.5 },
       { "id": "2", "name": "Customer B", "revenue": 30000, "satisfaction": 3.2 },
       ...
     ]
   }
   ```
   - `xAxis` / `yAxis`: Field names to use for each axis (must be numeric).
   - `labelField`: Optional field to display in the table and tooltips (defaults to "id").
   - `data`: Array of objects. Each must have `id` and the axis fields.

2. Run the following command **in the background**:
   ```bash
   node skills/datafilter-skill/server.mjs --port 5190 --data '<JSON data>'
   ```

3. Open the URL in the user's browser:
   ```bash
   open http://localhost:5190
   ```

4. The output is a JSON object with the selected and excluded items:
   ```json
   {
     "action": "submit",
     "payload": {
       "selectedIds": ["1", "5", "8"],
       "excludedIds": ["2", "3"],
       "totalSelected": 3,
       "totalItems": 5
     }
   }
   ```
