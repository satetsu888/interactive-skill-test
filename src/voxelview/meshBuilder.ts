import {
  MeshBuilder,
  Vector3,
  Vector4,
  Vector2,
  Color3,
  Texture,
  StandardMaterial,
  Scene,
  TransformNode,
} from "@babylonjs/core"
import type { Block, Direction4, Half, Shape, Axis } from "./types"
import { keyToPosition } from "./types"
import { getTextureUrl, partialVectors } from "./blockData"

// 個別テクスチャのフルUV
const FULL_UV = new Vector4(0, 0, 1, 1)
// 階段用（V反転）
const FULL_UV_FLIPPED = new Vector4(0, 1, 1, 0)

// テクスチャキャッシュ: 同じテクスチャ名のブロックで共有
const textureCache = new Map<string, Texture>()
const materialCache = new Map<string, StandardMaterial>()

function getOrCreateTexture(
  textureName: string,
  scene: Scene,
): Texture {
  const cached = textureCache.get(textureName)
  if (cached) return cached

  const url = getTextureUrl(textureName)
  const tex = new Texture(url, scene, false, true, Texture.NEAREST_NEAREST)
  tex.hasAlpha = true
  textureCache.set(textureName, tex)
  return tex
}

function getOrCreateMaterial(
  textureName: string,
  scene: Scene,
): StandardMaterial {
  const cached = materialCache.get(textureName)
  if (cached) return cached

  const tex = getOrCreateTexture(textureName, scene)
  const mat = new StandardMaterial(`mat-${textureName}`, scene)
  mat.diffuseTexture = tex
  mat.specularColor = Color3.Black()
  materialCache.set(textureName, mat)
  return mat
}

function createSimpleBox(
  key: string,
  pos: Vector3,
  blockName: string,
  scene: Scene,
) {
  const box = MeshBuilder.CreateBox(
    key,
    {
      size: 1,
      wrap: true,
      faceUV: [FULL_UV, FULL_UV, FULL_UV, FULL_UV, FULL_UV, FULL_UV],
    },
    scene,
  )
  box.position = pos
  box.material = getOrCreateMaterial(`${blockName}.png`, scene)
}

function createAxisBox(
  key: string,
  pos: Vector3,
  blockName: string,
  axis: Axis,
  scene: Scene,
) {
  const sideMat = getOrCreateMaterial(`${blockName}.png`, scene)
  const topMat = getOrCreateMaterial(`${blockName}_top.png`, scene)

  // 側面と上下面で別テクスチャが必要なため、2つのboxを組み合わせず
  // Babylon.jsのfaceUVは1マテリアルしか使えないので、側面テクスチャで統一し
  // 上下面は別メッシュにする方式は複雑になるため、側面テクスチャのみ使用
  // TODO: マルチマテリアル対応で上下面テクスチャを分離
  const box = MeshBuilder.CreateBox(
    key,
    {
      size: 1,
      wrap: true,
      faceUV: [FULL_UV, FULL_UV, FULL_UV, FULL_UV, FULL_UV, FULL_UV],
    },
    scene,
  )
  box.position = pos
  switch (axis) {
    case "x":
      box.rotation = new Vector3(0, 0, Math.PI / 2)
      break
    case "z":
      box.rotation = new Vector3(Math.PI / 2, 0, 0)
      break
  }
  box.material = sideMat
}

function createHalfBlock(
  key: string,
  pos: Vector3,
  blockName: string,
  type: string,
  scene: Scene,
) {
  const mat = getOrCreateMaterial(`${blockName}.png`, scene)

  const sideFaceUV = [
    partialVectors(FULL_UV, new Vector2(1, 0.5)),
    partialVectors(FULL_UV, new Vector2(1, 0.5)),
    partialVectors(FULL_UV, new Vector2(1, 0.5)),
    partialVectors(FULL_UV, new Vector2(1, 0.5)),
    FULL_UV,
    FULL_UV,
  ]

  if (type === "top" || type === "double") {
    const upper = MeshBuilder.CreateBox(
      `${key}-up`,
      { width: 1, depth: 1, height: 0.5, wrap: true, faceUV: sideFaceUV },
      scene,
    )
    upper.position = pos.add(new Vector3(0, 0.25, 0))
    upper.material = mat
  }

  if (type === "bottom" || type === "double") {
    const lower = MeshBuilder.CreateBox(
      `${key}-down`,
      { width: 1, depth: 1, height: 0.5, wrap: true, faceUV: sideFaceUV },
      scene,
    )
    lower.position = pos.add(new Vector3(0, -0.25, 0))
    lower.material = mat
  }
}

function stairPartPosition(
  half: Half,
  shape: Shape,
  facing: Direction4,
  part: "base" | "stair" | "partialStair",
): Vector3 {
  if (part === "base") {
    return new Vector3(0, half === "top" ? 0.25 : -0.25, 0)
  }

  if (part === "stair") {
    return new Vector3(
      facing === "north" || facing === "south"
        ? 0
        : facing === "east"
          ? -0.25
          : 0.25,
      half === "top" ? -0.25 : 0.25,
      facing === "east" || facing === "west"
        ? 0
        : facing === "north"
          ? -0.25
          : 0.25,
    )
  }

  if (part === "partialStair") {
    if (facing === "south") {
      return new Vector3(
        shape === "inner_left" || shape === "outer_left" ? -0.25 : 0.25,
        half === "top" ? -0.25 : 0.25,
        shape === "inner_left" || shape === "inner_right" ? -0.25 : 0.25,
      )
    } else if (facing === "north") {
      return new Vector3(
        shape === "inner_left" || shape === "outer_left" ? 0.25 : -0.25,
        half === "top" ? -0.25 : 0.25,
        shape === "inner_left" || shape === "inner_right" ? 0.25 : -0.25,
      )
    } else if (facing === "east") {
      return new Vector3(
        shape === "inner_left" || shape === "inner_right" ? 0.25 : -0.25,
        half === "top" ? -0.25 : 0.25,
        shape === "inner_left" || shape === "outer_left" ? -0.25 : 0.25,
      )
    } else if (facing === "west") {
      return new Vector3(
        shape === "inner_left" || shape === "inner_right" ? -0.25 : 0.25,
        half === "top" ? -0.25 : 0.25,
        shape === "inner_left" || shape === "outer_left" ? 0.25 : -0.25,
      )
    }
  }

  return Vector3.Zero()
}

function createStairsBlock(
  key: string,
  pos: Vector3,
  blockName: string,
  facing: Direction4,
  half: Half,
  shape: Shape,
  scene: Scene,
) {
  const mat = getOrCreateMaterial(`${blockName}.png`, scene)

  const parent = new TransformNode(`${key}-stairs`, scene)
  parent.position = pos

  const facingAxis = facing === "north" || facing === "south" ? "z" : "x"
  const tv = FULL_UV_FLIPPED

  // Stair step
  if (["straight", "inner_left", "inner_right"].includes(shape)) {
    const stairFaceUV =
      facingAxis === "z"
        ? [
            partialVectors(tv, new Vector2(1, 0.5)),
            partialVectors(tv, new Vector2(1, 0.5)),
            partialVectors(tv, new Vector2(0.5, 0.5)),
            partialVectors(tv, new Vector2(0.5, 0.5)),
            partialVectors(tv, new Vector2(1, 0.5)),
            partialVectors(tv, new Vector2(1, 0.5)),
          ]
        : [
            partialVectors(tv, new Vector2(0.5, 0.5)),
            partialVectors(tv, new Vector2(0.5, 0.5)),
            partialVectors(tv, new Vector2(1, 0.5)),
            partialVectors(tv, new Vector2(1, 0.5)),
            partialVectors(tv, new Vector2(0.5, 1)),
            partialVectors(tv, new Vector2(0.5, 1)),
          ]

    const stair = MeshBuilder.CreateBox(
      `${key}-stair`,
      {
        width: facingAxis === "z" ? 1 : 0.5,
        depth: facingAxis === "z" ? 0.5 : 1,
        height: 0.5,
        wrap: true,
        faceUV: stairFaceUV,
      },
      scene,
    )
    stair.position = stairPartPosition(half, shape, facing, "stair")
    stair.parent = parent
    stair.material = mat
  }

  // Base
  const base = MeshBuilder.CreateBox(
    `${key}-base`,
    {
      width: 1,
      depth: 1,
      height: 0.5,
      wrap: true,
      faceUV: [
        partialVectors(tv, new Vector2(1, 0.5)),
        partialVectors(tv, new Vector2(1, 0.5)),
        partialVectors(tv, new Vector2(1, 0.5)),
        partialVectors(tv, new Vector2(1, 0.5)),
        tv,
        tv,
      ],
    },
    scene,
  )
  base.position = stairPartPosition(half, shape, facing, "base")
  base.parent = parent
  base.material = mat

  // Partial stair (corner pieces)
  if (
    ["inner_left", "inner_right", "outer_left", "outer_right"].includes(shape)
  ) {
    const halfUV = partialVectors(tv, new Vector2(0.5, 0.5))
    const partial = MeshBuilder.CreateBox(
      `${key}-partial`,
      {
        width: 0.5,
        depth: 0.5,
        height: 0.5,
        wrap: true,
        faceUV: [halfUV, halfUV, halfUV, halfUV, halfUV, halfUV],
      },
      scene,
    )
    partial.position = stairPartPosition(half, shape, facing, "partialStair")
    partial.parent = parent
    partial.material = mat
  }
}

export function createBlockMeshes(
  voxels: Map<string, Block>,
  scene: Scene,
) {
  // キャッシュをクリア（シーン再作成時）
  textureCache.clear()
  materialCache.clear()

  for (const [key, block] of voxels) {
    const { x, y, z } = keyToPosition(key)
    const pos = new Vector3(x, y, z)

    switch (block.behaviorGroup) {
      case "axis":
        createAxisBox(key, pos, block.blockName, block.axis, scene)
        break
      case "slab":
        createHalfBlock(key, pos, block.blockName, block.type, scene)
        break
      case "stairs":
        createStairsBlock(
          key, pos, block.blockName, block.facing, block.half, block.shape, scene,
        )
        break
      default:
        createSimpleBox(key, pos, block.blockName, scene)
    }
  }
}
