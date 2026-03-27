---
name: pairwise-compare
description: A skill that ranks items through pairwise comparison. Presents two items at a time and builds a ranking from user choices.
---

## Overview

This skill launches a browser-based pairwise comparison tool. Items are presented in pairs and the user picks the preferred one. After all comparisons, a final ranking is produced.

## Usage

1. Prepare the data as JSON:
   ```json
   {
     "title": "Which features should we prioritize?",
     "description": "Compare each pair and pick the more important one.",
     "items": [
       { "id": "1", "title": "Dark mode", "description": "Add dark theme support" },
       { "id": "2", "title": "Export PDF", "description": "Export reports as PDF" },
       { "id": "3", "title": "SSO", "description": "Single sign-on integration" },
       { "id": "4", "title": "Mobile app", "description": "Native mobile client" }
     ]
   }
   ```
   Note: The number of comparisons is n*(n-1)/2. For 4 items = 6 comparisons, 5 items = 10, 6 items = 15.

2. Run the following command **in the background**:
   ```bash
   node skills/pairwise-skill/server.mjs --port 5190 --data '<JSON data>'
   ```

3. Open the URL in the user's browser:
   ```bash
   open http://localhost:5190
   ```

4. The output is a JSON object with the final ranking:
   ```json
   {
     "action": "submit",
     "payload": {
       "ranking": [
         { "id": "3", "title": "SSO", "score": 3, "rank": 1 },
         { "id": "1", "title": "Dark mode", "score": 2, "rank": 2 },
         { "id": "4", "title": "Mobile app", "score": 1, "rank": 3 },
         { "id": "2", "title": "Export PDF", "score": 0, "rank": 4 }
       ],
       "totalComparisons": 6
     }
   }
   ```
