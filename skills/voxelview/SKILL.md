---
name: voxelview
description: A skill that displays Minecraft voxel blocks in an interactive 3D viewer. Users can orbit, zoom, click blocks to add comments, and confirm.
---

## Overview

This skill launches a browser-based 3D voxel viewer. Users can inspect a Minecraft-style block structure, click blocks to add comments on specific coordinates, and submit their feedback.

Textures are loaded at runtime from Mojang's [bedrock-samples](https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures/blocks) repository.

## Usage

1. Prepare the data as JSON:
   ```json
   {
     "title": "My Build",
     "ops": [
       { "fill": [[0, 0, 0], [7, 0, 7]], "block": "stone" },
       { "set": [3, 1, 3], "block": "planks_oak" },
       { "set": [4, 1, 3], "block": "planks_oak", "facing": "north", "half": "bottom" },
       { "set": [5, 1, 3], "block": "planks_oak", "type": "bottom" },
       { "set": [6, 1, 3], "block": "log_oak", "axis": "y" }
     ]
   }
   ```

2. Run the following command **in the background**:
   ```bash
   node skills/voxelview/server.mjs --port 5190 --data '<JSON data>'
   ```
   If port 5190 is in use, try another port (5191, 5192, etc.).

3. Open the URL in the user's browser:
   ```bash
   open http://localhost:5190
   ```

4. The background command will complete when the user clicks Confirm. The output is a JSON object:
   ```json
   {
     "action": "submit",
     "payload": {
       "comments": [
         { "x": 3, "y": 1, "z": 3, "text": "Change this to cobblestone" },
         { "x": 6, "y": 1, "z": 3, "text": "Rotate this log" }
       ]
     }
   }
   ```
   `comments` is an empty array if the user confirmed without adding any comments.

### Operations

| Operation | Format | Description |
|---|---|---|
| `set` | `"set": [x, y, z]` | Place a single block at the given coordinate |
| `fill` | `"fill": [[x1,y1,z1], [x2,y2,z2]]` | Fill a rectangular region with the same block (like Minecraft /fill) |

Operations are applied in order; later ops overwrite earlier ones at the same coordinates.

### Block shape

The block shape is inferred from the optional parameters provided:

| Shape | Parameters | Description |
|---|---|---|
| cube (default) | — | Standard 1x1x1 block |
| stairs | `facing` (north/south/east/west), `half` (bottom/top) | Stair block. `shape` is auto-calculated from adjacent stairs |
| slab | `type` (bottom/top/double) | Half-height block |
| axis | `axis` (x/y/z) | Rotatable block (logs, pillars) |

### Block names (textures)

The `block` field is used directly as the texture filename (without `.png`).
Use **Bedrock Edition** texture names.

Common examples:
- `stone`, `cobblestone`, `dirt`, `sand`, `gravel`, `glass`
- `planks_oak`, `planks_spruce`, `planks_birch`, `planks_jungle`, `planks_acacia`, `planks_big_oak`
- `log_oak`, `log_spruce`, `log_birch` (side texture; top is loaded as `{name}_top.png` for axis blocks)
- `wool_colored_white`, `wool_colored_red`, `wool_colored_blue`, etc.
- `concrete_white`, `concrete_red`, `concrete_blue`, etc.
- `stonebrick`, `mossy_cobblestone`, `granite`, `diorite`, `andesite`
