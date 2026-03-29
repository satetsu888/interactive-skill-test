---
name: voxelview
description: Display Minecraft voxel blocks in an interactive 3D viewer
---

## Overview

Renders Minecraft block data as an interactive 3D voxel view in the browser.
The user can orbit, zoom, and inspect the build, then confirm.

Textures are loaded at runtime from Mojang's bedrock-samples repository.

## Usage

```bash
node skills/voxelview-skill/server.mjs --port 5190 --data '<JSON>'
```

### Input format

```json
{
  "title": "My Build",
  "ops": [
    { "fill": [[0, 0, 0], [15, 0, 15]], "block": "stone" },
    { "fill": [[1, 1, 1], [14, 3, 14]], "block": "planks_oak" },
    { "set": [5, 1, 0], "block": "planks_oak", "facing": "north", "half": "bottom" },
    { "set": [6, 0, 3], "block": "planks_oak", "type": "top" },
    { "set": [7, 0, 3], "block": "log_oak", "axis": "y" }
  ]
}
```

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
Textures are loaded from Mojang's [bedrock-samples](https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures/blocks) repository, so use **Bedrock Edition** texture names.

Common examples:
- `stone`, `cobblestone`, `dirt`, `sand`, `gravel`, `glass`
- `planks_oak`, `planks_spruce`, `planks_birch`, `planks_jungle`, `planks_acacia`, `planks_dark_oak`
- `log_oak`, `log_spruce`, `log_birch` (side texture; top is loaded as `{name}_top.png` for axis blocks)
- `wool_colored_white`, `wool_colored_red`, `wool_colored_blue`, etc.
- `concrete_white`, `concrete_red`, `concrete_blue`, etc.
- `stonebrick`, `mossy_cobblestone`, `granite`, `diorite`, `andesite`

### Output

```json
{
  "action": "confirm",
  "payload": { "status": "confirmed", "blockCount": 42 }
}
```
