import type { Op, Block } from "./types"
import { positionToKey } from "./types"
import { calcAllStairShapes } from "./blockShapeCalc"

function inferBlock(op: Op): Block {
  const blockName = op.block

  // 入力パラメータからbehaviorGroupを推論
  if (op.facing != null || op.half != null) {
    return {
      behaviorGroup: "stairs",
      blockName,
      facing: op.facing ?? "north",
      half: op.half ?? "bottom",
      shape: "straight",
    }
  }
  if (op.type != null) {
    return {
      behaviorGroup: "slab",
      blockName,
      type: op.type,
    }
  }
  if (op.axis != null) {
    return {
      behaviorGroup: "axis",
      blockName,
      axis: op.axis,
    }
  }
  return {
    behaviorGroup: "simple",
    blockName,
  }
}

export function expandOps(ops: Op[]): Map<string, Block> {
  const state = new Map<string, Block>()

  for (const op of ops) {
    if ("set" in op) {
      const [x, y, z] = op.set
      state.set(positionToKey(x, y, z), inferBlock(op))
    } else if ("fill" in op) {
      const [[x1, y1, z1], [x2, y2, z2]] = op.fill
      const minX = Math.min(x1, x2),
        maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2),
        maxY = Math.max(y1, y2)
      const minZ = Math.min(z1, z2),
        maxZ = Math.max(z1, z2)
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            state.set(positionToKey(x, y, z), inferBlock(op))
          }
        }
      }
    }
  }

  calcAllStairShapes(state)
  return state
}
