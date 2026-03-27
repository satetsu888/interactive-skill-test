---
name: plan-review
description: After creating or updating a plan document, use this skill to let the user review it in the browser with inline comments. Always use this skill when you finish writing a plan before proceeding with implementation.
---

## Overview

This skill launches a browser-based plan review interface. The plan document is rendered as formatted markdown. Users can select text to add inline comments. Comments are highlighted in the document and listed in a sidebar. When the user submits, all comments with their target text are returned.

## When to use

**You MUST use this skill whenever you create or update a plan document** so the user can review it with inline comments before you proceed with implementation.

## Usage

1. Save the plan content to a markdown file (or use an existing one).

2. Launch the review UI in the background, passing the file path:
   ```bash
   node skills/planreview-skill/server.mjs --port 5190 --file /path/to/plan.md --title "Plan Review"
   ```
   If port 5190 is in use, try another port (5191, 5192, etc.).

3. Open the browser for the user:
   ```bash
   open http://localhost:5190
   ```

4. Wait for the background command to complete. The output contains the user's inline comments:
   ```json
   {
     "action": "submit",
     "payload": {
       "comments": [
         {
           "targetText": "selected text from the plan",
           "comment": "user's feedback",
           "position": {
             "offset": 123,
             "length": 28,
             "startLine": 5,
             "startColumn": 3,
             "endLine": 5,
             "endColumn": 31
           }
         }
       ],
       "totalComments": 1
     }
   }
   ```
   Position fields reference the raw markdown file: `startLine`/`endLine` are 1-indexed line numbers, `offset` is the character offset from the beginning of the file.

5. Review each comment and update the plan accordingly. Each comment's `targetText` tells you exactly which part of the plan the feedback refers to.

6. If you made significant changes, launch the review again so the user can verify.

## How it works

1. The server reads the markdown file and serves it as formatted HTML.
2. Users select text in the document → "Add Comment" button appears.
3. A comment form opens where users can write their feedback.
4. Commented text is highlighted in yellow. Clicking a highlight shows the comment.
5. All comments are listed in the sidebar for easy navigation.
6. "Submit Review" sends all comments back to the agent.

## Options

| Option | Description |
|--------|-------------|
| `--file <path>` | Path to the markdown file to review (required) |
| `--title <text>` | Title displayed on the review page (default: "Plan Review") |
| `--port <number>` | Port to serve on (default: 5190) |
