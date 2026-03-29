import { Vector4, Vector2 } from "@babylonjs/core"

const BEDROCK_TEXTURES_BASE =
  "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/blocks/"

export const getTextureUrl = (textureName: string): string =>
  `${BEDROCK_TEXTURES_BASE}${textureName}`

export const partialVectors = (vector: Vector4, size: Vector2): Vector4 => {
  return new Vector4(
    vector.x,
    vector.y,
    vector.x + (vector.z - vector.x) * size.x,
    vector.y + (vector.w - vector.y) * size.y,
  )
}
