export type SimpleBlock = {
  behaviorGroup: "simple"
  blockName: string
}

export type AxisBlock = {
  behaviorGroup: "axis"
  blockName: string
  axis: Axis
}

export type HalfBlock = {
  behaviorGroup: "slab"
  blockName: string
  type: SlabType
}

export type StairsBlock = {
  behaviorGroup: "stairs"
  blockName: string
  facing: Direction4
  half: Half
  shape: Shape
}

export type Block = SimpleBlock | AxisBlock | HalfBlock | StairsBlock

export type Direction4 = "north" | "south" | "east" | "west"
export type Axis = "x" | "y" | "z"
export type SlabType = "bottom" | "top" | "double"
export type Half = "bottom" | "top"
export type Shape =
  | "straight"
  | "inner_left"
  | "inner_right"
  | "outer_left"
  | "outer_right"

// 入力JSON形式
export type VoxelViewData = {
  title?: string
  ops: Op[]
}

export type Op = SetOp | FillOp

export type SetOp = {
  set: [number, number, number]
  block: string
  facing?: Direction4
  half?: Half
  type?: SlabType
  axis?: Axis
}

export type FillOp = {
  fill: [[number, number, number], [number, number, number]]
  block: string
  facing?: Direction4
  half?: Half
  type?: SlabType
  axis?: Axis
}

export interface VoxelComment {
  id: string
  x: number
  y: number
  z: number
  text: string
}

export const positionToKey = (x: number, y: number, z: number) =>
  `${x},${y},${z}`

export const keyToPosition = (key: string) => {
  const [x, y, z] = key.split(",").map(Number)
  return { x, y, z }
}
