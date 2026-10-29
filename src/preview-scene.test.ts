import { describe, expect, it } from "vitest"
import { previewSceneOf } from "./preview-scene"
import type { Wall } from "./types"
import { contourSegments, displayPolygons } from "./wall-geometry"

function wall(id: string, ax: number, ay: number, bx: number, by: number): Wall {
  return { id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thicknessCm: 20, type: "brick" }
}

//   +--------+  y=0     W1 — комната из четырёх стен 400 x 300
//   |        |
//   |        |          P — превью, тянется от угла комнаты вверх и вправо
//   +--------+  y=300   F — стена далеко справа
const room = [wall("t", 0, 0, 400, 0), wall("r", 400, 0, 400, 300), wall("b", 400, 300, 0, 300), wall("l", 0, 300, 0, 0)]
const far = wall("f", 2000, 0, 2000, 300)
const stable = [...room, far]

describe("previewSceneOf", () => {
  it("без превью все стены берутся из сцены без превью", () => {
    const withoutPreview = previewSceneOf(null, stable, stable)
    expect(withoutPreview(room[0])).toBe(stable)
  })

  it("стена, которой касается превью, берётся из сцены с превью, далёкая — из сцены без превью", () => {
    const preview = wall("", 400, 0, 700, 0)
    const withPreview = [...stable, preview]
    const sceneOf = previewSceneOf(preview, stable, withPreview)
    expect(sceneOf(room[1])).toBe(withPreview)
    expect(sceneOf(room[0])).toBe(withPreview)
    expect(sceneOf(far)).toBe(stable)
  })

  it("вид далёкой стены на обеих сценах совпадает: подмена сцены не меняет рисунок", () => {
    const preview = wall("", 400, 0, 700, 0)
    const withPreview = [...stable, preview]
    const sceneOf = previewSceneOf(preview, stable, withPreview)
    for (const w of stable) {
      if (sceneOf(w) !== stable) continue
      expect(displayPolygons(w, stable)).toEqual(displayPolygons(w, withPreview))
      expect(contourSegments(w, stable)).toEqual(contourSegments(w, withPreview))
    }
  })
})
