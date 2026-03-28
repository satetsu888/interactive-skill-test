---
name: codereview-review
description: "TRIGGER when: user asks for a code review or reviews a PR/diff. Use this skill to present review comments in a GitHub-style diff UI where the user can accept/deny each suggestion and add feedback."
---

## Overview

This skill launches a browser-based code review interface. It runs `git diff` against a specified commit, renders the diff in GitHub style, and displays your review comments inline. Users can accept or deny each comment and add their own feedback.

## When to use

Use this skill when you perform a code review and want to present your findings interactively.

## Usage

1. Prepare the review data as JSON. The server will run `git diff <commit>` to get the diff automatically:
   ```json
   {
     "title": "Review: Add authentication middleware",
     "description": "Optional summary",
     "commit": "abc1234",
     "repo": "/path/to/repo",
     "comments": [
       {
         "id": "c1",
         "file": "src/auth/middleware.ts",
         "line": 14,
         "body": "Should parse the Bearer prefix from the authorization header"
       },
       {
         "id": "c2",
         "file": "src/auth/middleware.ts",
         "line": 11,
         "body": "Wrap verifyToken in try-catch to handle malformed tokens"
       }
     ]
   }
   ```

   **Fields:**
   - `commit`: The base commit hash to diff against (e.g. `HEAD~1`, a branch name, or a SHA). The diff is computed as `git diff <commit>` (changes since that commit).
   - `repo`: Optional path to the git repository. Defaults to the current working directory.
   - `comments[].file`: File path relative to the repo root (must match the path in the diff output exactly).
   - `comments[].line`: **New-side line number** where the comment should appear (the right-side line number in the diff). This is the line number in the current version of the file, NOT the old version.
   - `comments[].body`: Your review comment text.

   Only files that have comments will be shown in the UI.

   ### Getting accurate line numbers

   **The `line` field must match a `newNum` in the parsed diff, not the line number in the original file.** To ensure comments appear at the correct location:

   1. Run `git diff <commit>` yourself first to see the actual diff output.
   2. Look at the hunk headers (e.g. `@@ -120,12 +120,35 @@`) — the `+120` means new-side lines start at 120.
   3. Count the new-side line numbers: context lines and `+` lines increment the new-side counter, `-` lines do not.
   4. Use the new-side line number of the line you want to comment on.

   For example, in this diff:
   ```
   @@ -10,4 +10,8 @@
    context line          <- newNum: 10
   -deleted line          <- no newNum (old side only)
   +added line            <- newNum: 11
   +another added line    <- newNum: 12
    context line          <- newNum: 13
   ```
   To comment on "another added line", use `"line": 12`.

   **Tip**: Comments can only appear on context lines or added lines (lines with a `newNum`). They cannot appear on deleted lines.

   ### Verifying line numbers before submitting

   Off-by-one errors are common when counting diff line numbers. **You MUST verify each comment's line number before passing the data to the skill.** Follow this procedure:

   1. Run `git diff <commit>` and save the output.
   2. For each comment, find the line content you intend to comment on in the diff output.
   3. Count the new-side line number for that line (context and `+` lines only).
   4. Cross-check: read the actual file at that line number (`sed -n '<line>p' <file>`) and confirm it matches the line you want to comment on.
   5. If it doesn't match, re-count from the nearest hunk header.

   **Do NOT skip this verification step.** A comment placed on the wrong line confuses the user and undermines the review.

2. Run **in the background**, passing the JSON via `--data`:
   ```bash
   node skills/codereview-review-skill/server.mjs --port 5190 --data '<JSON>'
   ```

3. Open the browser:
   ```bash
   open http://localhost:5190
   ```

4. The output contains the user's decisions:
   ```json
   {
     "action": "submit",
     "payload": {
       "files": [
         {
           "path": "src/auth/middleware.ts",
           "comments": [
             {
               "id": "c1",
               "line": 14,
               "agentComment": "Should parse the Bearer prefix...",
               "decision": "accept",
               "userFeedback": ""
             },
             {
               "id": "c2",
               "line": 11,
               "agentComment": "Wrap verifyToken in try-catch...",
               "decision": "deny",
               "userFeedback": "verifyToken already returns null on failure. No need for try-catch."
             }
           ]
         }
       ],
       "reviewedCount": 2,
       "totalComments": 2
     }
   }
   ```

5. Apply accepted suggestions and address denied ones based on the user's feedback.
   - `decision` is `"accept"`, `"deny"`, or `null` (if the user did not review that comment).

## Options

| Option | Description |
|--------|-------------|
| `--data <json>` | Review data as JSON string (required) |
| `--port <number>` | Port to serve on (default: 5190) |
