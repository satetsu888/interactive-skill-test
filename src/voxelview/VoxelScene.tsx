import { useRef, useEffect } from "react"
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  Vector3,
  Vector4 as V4,
  Color3,
  Color4,
  PointerEventTypes,
  AbstractMesh,
  HighlightLayer,
  Matrix,
  Viewport,
} from "@babylonjs/core"
import { GridMaterial } from "@babylonjs/materials"
import type { Block, VoxelComment } from "./types"
import { keyToPosition } from "./types"
import { createBlockMeshes } from "./meshBuilder"

type Props = {
  voxels: Map<string, Block>
  onBlockClick: (key: string) => void
  commentedKeys: Set<string>
  pendingKey: string | null
  comments: VoxelComment[]
  showLabels: boolean
}

function computeBounds(voxels: Map<string, Block>) {
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const key of voxels.keys()) {
    const { x, y, z } = keyToPosition(key)
    minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z)
  }
  if (minX === Infinity) {
    return { center: new Vector3(0, 0, 0), radius: 10, groundSize: 16 }
  }
  const center = new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
  const dx = maxX - minX + 1, dy = maxY - minY + 1, dz = maxZ - minZ + 1
  const diag = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return { center, radius: Math.max(diag * 1.2, 5), groundSize: Math.max(dx, dz) + 8 }
}

function resolveBlockKey(mesh: AbstractMesh): string | null {
  const name = mesh.name
  if (name === "ground") return null
  if (mesh.parent && mesh.parent.name.endsWith("-stairs")) {
    return mesh.parent.name.replace(/-stairs$/, "")
  }
  if (name.endsWith("-up") || name.endsWith("-down")) {
    return name.replace(/-(up|down)$/, "")
  }
  if (/^-?\d+,-?\d+,-?\d+$/.test(name)) return name
  return null
}

function getMeshesForKey(scene: Scene, key: string): AbstractMesh[] {
  const meshes: AbstractMesh[] = []
  const direct = scene.getMeshByName(key)
  if (direct) meshes.push(direct)
  const up = scene.getMeshByName(`${key}-up`)
  if (up) meshes.push(up)
  const down = scene.getMeshByName(`${key}-down`)
  if (down) meshes.push(down)
  const stairsNode = scene.getTransformNodeByName(`${key}-stairs`)
  if (stairsNode) for (const child of stairsNode.getChildMeshes()) meshes.push(child)
  return meshes
}

const PENDING_COLOR = new Color3(0.3, 0.7, 1)
const COMMENTED_COLOR = new Color3(1, 0.75, 0)

const VoxelScene = ({ voxels, onBlockClick, commentedKeys, pendingKey, comments, showLabels }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const highlightRef = useRef<HighlightLayer | null>(null)
  const onBlockClickRef = useRef(onBlockClick)
  const commentsRef = useRef(comments)
  const showLabelsRef = useRef(showLabels)

  useEffect(() => { onBlockClickRef.current = onBlockClick })
  useEffect(() => { commentsRef.current = comments })
  useEffect(() => { showLabelsRef.current = showLabels })

  // Main scene setup
  useEffect(() => {
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!canvas || !overlay) return

    const engine = new Engine(canvas, true, undefined, true)
    const scene = new Scene(engine)
    sceneRef.current = scene
    scene.clearColor = new Color4(0.1, 0.1, 0.18, 1)

    const hl = new HighlightLayer("hl", scene)
    hl.blurHorizontalSize = 0.5
    hl.blurVerticalSize = 0.5
    highlightRef.current = hl

    const { center, radius, groundSize } = computeBounds(voxels)

    const camera = new ArcRotateCamera("camera", -Math.PI / 4, Math.PI / 3, radius, center, scene)
    camera.minZ = 0.1
    camera.wheelPrecision = 50
    camera.lowerRadiusLimit = 2
    camera.upperRadiusLimit = 50
    camera.attachControl(canvas, true)

    new HemisphericLight("light1", new Vector3(-1, 1, -0.7), scene).intensity = 0.8
    new HemisphericLight("light2", new Vector3(1, -1, 0.7), scene).intensity = 0.5
    const dir = new DirectionalLight("directionalLight", new Vector3(1, -1, 1), scene)
    dir.intensity = 0.4

    const ground = MeshBuilder.CreateGround("ground", { width: groundSize, height: groundSize, subdivisions: 32 }, scene)
    ground.position = new Vector3(-0.5, -0.5, -0.5)
    ground.receiveShadows = true
    const gridMat = new GridMaterial("gridMat", scene)
    gridMat.mainColor = new Color3(0.3, 0.4, 0.2)
    gridMat.lineColor = Color3.Green()
    gridMat.majorUnitFrequency = 8
    ground.material = gridMat

    createBlockMeshes(voxels, scene)

    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERTAP) return
      const pickResult = pointerInfo.pickInfo
      if (!pickResult?.hit || !pickResult.pickedMesh) return
      const key = resolveBlockKey(pickResult.pickedMesh)
      if (key) onBlockClickRef.current(key)
    })

    // Label projection in render loop
    scene.registerAfterRender(() => {
      if (!showLabelsRef.current || commentsRef.current.length === 0) {
        overlay.innerHTML = ""
        return
      }

      const cam = scene.activeCamera
      if (!cam) return
      const rw = engine.getRenderWidth()
      const rh = engine.getRenderHeight()
      const vp = cam.viewport.toGlobal(rw, rh)
      const viewMatrix = scene.getViewMatrix()
      const projMatrix = scene.getProjectionMatrix()
      const rect = canvas.getBoundingClientRect()
      // devicePixelRatio による CSS↔render 座標のスケール
      const scaleX = rect.width / rw
      const scaleY = rect.height / rh

      let html = ""
      for (let i = 0; i < commentsRef.current.length; i++) {
        const c = commentsRef.current[i]
        const worldPos = new Vector3(c.x, c.y + 0.8, c.z)
        const projected = Vector3.Project(worldPos, viewMatrix, projMatrix, vp)
        if (projected.z < 0 || projected.z > 1) continue

        const sx = projected.x * scaleX
        const sy = projected.y * scaleY

        html += `<div style="position:absolute;left:${sx}px;top:${sy}px;transform:translate(-50%,-100%);pointer-events:none;" title="${c.text.replace(/"/g, '&quot;')}">` +
          `<div style="display:flex;flex-direction:column;align-items:center;">` +
          `<div style="background:rgba(20,20,40,0.85);color:#e0e0e0;font-size:11px;padding:2px 6px;border-radius:3px;border:1px solid #f0c040;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.text.replace(/</g, '&lt;')}</div>` +
          `<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #f0c040;"></div>` +
          `</div></div>`
      }
      overlay.innerHTML = html
    })

    engine.runRenderLoop(() => scene.render())
    const handleResize = () => engine.resize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      highlightRef.current = null
      sceneRef.current = null
      engine.dispose()
    }
  }, [voxels])

  // Highlight effect
  useEffect(() => {
    const scene = sceneRef.current
    const hl = highlightRef.current
    if (!scene || !hl) return

    hl.removeAllMeshes()

    for (const key of commentedKeys) {
      for (const mesh of getMeshesForKey(scene, key)) {
        hl.addMesh(mesh, COMMENTED_COLOR)
      }
    }

    if (pendingKey) {
      for (const mesh of getMeshesForKey(scene, pendingKey)) {
        hl.addMesh(mesh, PENDING_COLOR)
      }
    }
  }, [pendingKey, commentedKeys])

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div
        ref={overlayRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          overflow: "hidden",
        }}
      />
    </div>
  )
}

export default VoxelScene
