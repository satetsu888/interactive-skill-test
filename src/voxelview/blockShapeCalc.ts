import { Vector3, Quaternion } from "@babylonjs/core"
import type { Block, Direction4, Shape, StairsBlock } from "./types"
import { positionToKey } from "./types"

const convertFacingToVector3 = (facing: Direction4): Vector3 => {
  switch (facing) {
    case "north":
      return new Vector3(0, 0, -1)
    case "east":
      return new Vector3(-1, 0, 0)
    case "south":
      return new Vector3(0, 0, 1)
    case "west":
      return new Vector3(1, 0, 0)
  }
}

const decideStairsShape = (
  originalBlock: StairsBlock,
  forwardBlock?: Block,
  backwardBlock?: Block,
): Shape => {
  const originalBlockFacingVector = convertFacingToVector3(originalBlock.facing)
  const baseVector = new Vector3(0, 0, 1)

  if (
    forwardBlock &&
    forwardBlock.behaviorGroup === "stairs" &&
    forwardBlock.half === originalBlock.half
  ) {
    const forwardBlockFacingVector = convertFacingToVector3(forwardBlock.facing)
    const q = Quaternion.Zero()
    Quaternion.FromUnitVectorsToRef(
      forwardBlockFacingVector,
      originalBlockFacingVector,
      q,
    )
    const v = Vector3.Zero()
    baseVector.rotateByQuaternionToRef(q, v)
    const rel = new Vector3(Math.round(v.x), Math.round(v.y), Math.round(v.z))

    if (rel.x === 1) return "outer_left"
    if (rel.x === -1) return "outer_right"
  }

  if (
    backwardBlock &&
    backwardBlock.behaviorGroup === "stairs" &&
    backwardBlock.half === originalBlock.half
  ) {
    const backwardBlockFacingVector = convertFacingToVector3(
      backwardBlock.facing,
    )
    const q = Quaternion.Zero()
    Quaternion.FromUnitVectorsToRef(
      backwardBlockFacingVector,
      originalBlockFacingVector,
      q,
    )
    const v = Vector3.Zero()
    baseVector.rotateByQuaternionToRef(q, v)
    const rel = new Vector3(Math.round(v.x), Math.round(v.y), Math.round(v.z))

    if (rel.x === 1) return "inner_left"
    if (rel.x === -1) return "inner_right"
  }

  return "straight"
}

const calcStairBlockShape = (
  x: number,
  y: number,
  z: number,
  block: Block,
  state: Map<string, Block>,
): Block => {
  if (block.behaviorGroup !== "stairs") return block

  const facingVec = convertFacingToVector3(block.facing)
  const forwardKey = positionToKey(
    x + facingVec.x,
    y + facingVec.y,
    z + facingVec.z,
  )
  const backwardKey = positionToKey(
    x - facingVec.x,
    y - facingVec.y,
    z - facingVec.z,
  )

  const shape = decideStairsShape(
    block,
    state.get(forwardKey),
    state.get(backwardKey),
  )

  return { ...block, shape }
}

export function calcAllStairShapes(state: Map<string, Block>): void {
  for (const [key, block] of state) {
    if (block.behaviorGroup !== "stairs") continue
    const [x, y, z] = key.split(",").map(Number)
    const updated = calcStairBlockShape(x, y, z, block, state)
    state.set(key, updated)
  }
}
