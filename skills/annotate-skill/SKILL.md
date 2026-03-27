---
name: image-annotate
description: A skill that lets users draw rectangles on an image and label them. Useful for UI review, bug reporting, and visual feedback.
---

## Overview

This skill launches a browser-based image annotation tool. Users can draw rectangles on an image and assign labels to each region.

## Usage

1. Prepare the data as JSON:
   ```json
   {
     "title": "Review this UI screenshot",
     "imageUrl": "data:image/png;base64,iVBOR...",
     "labels": ["Bug", "Improvement", "Question", "Note"]
   }
   ```
   - `imageUrl`: Online images can use the URL directly (e.g. `https://example.com/screenshot.png`).
     For local files, convert to a data URI with: `base64 -i image.png` and prepend `data:image/png;base64,`.
     **Important**: Do NOT use `file://` URLs — browsers block them for security reasons.
   - `labels`: Optional array of label choices (defaults to Bug/Improvement/Question/Note).

2. Run the following command **in the background**:
   ```bash
   node skills/annotate-skill/server.mjs --port 5190 --data '<JSON data>'
   ```

3. Open the URL in the user's browser:
   ```bash
   open http://localhost:5190
   ```

4. The output is a JSON object with all annotations:
   ```json
   {
     "action": "submit",
     "payload": {
       "annotations": [
         {
           "label": "Bug",
           "region": { "x": 10.5, "y": 20.3, "width": 15.2, "height": 8.1 }
         }
       ],
       "imageSize": { "width": 1920, "height": 1080 }
     }
   }
   ```
   Region coordinates are in percentage (0-100) relative to the image dimensions.
