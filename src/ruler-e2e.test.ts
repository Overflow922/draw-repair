import { describe, expect, it } from "vitest"
import { drawScene } from "./render"
import { rulerReading } from "./ruler"
import type { Point, View, Wall } from "./types"
import { sceneL, sceneR } from "./room-area.test-utils"
import { arcRecorder, extraOps, sceneQ, sceneRbend, sceneStub } from "./ruler.test-utils"
import type { Op } from "./ruler.test-utils"

// Сквозные тесты change ruler-tool: геометрия стен → rulerReading → drawScene → подписи
// (spec ruler-tool «Внутренние углы помещения», «Замер пролёта», «Замер стены»; design D4–D5).
// Ловят расхождение между точным значением сценария и шумом целой сетки контура помещения.

const VIEW: View = { zoom: 1, pan: { x: -50, y: -50 } }

function labels(walls: Wall[], cursor: Point): string[] {
  const draw = (withRuler: boolean): Op[] => {
    const { ctx, ops } = arcRecorder()
    drawScene(ctx, 1200, 900, walls, null, "mm", VIEW, [], withRuler ? { ruler: rulerReading(cursor, walls) } : {})
    return ops
  }
  return extraOps(draw(false), draw(true)).extra.flatMap((o) => (o.kind === "text" ? [o.text] : []))
}

describe("линейка от геометрии до подписей", () => {
  it("RND-Q-E2E-1: косая комната — «90°», «90°», «113°», «68°»", () => {
    expect(
      labels(sceneQ(), { x: 100, y: 150 })
        .filter((t) => t.endsWith("°"))
        .sort(),
    ).toEqual(["113°", "68°", "90°", "90°"].sort())
  })

  it("RND-E2E-2: прямоугольная комната — пролёты «4000» и «3000», четыре «90°»", () => {
    expect(labels(sceneR(), { x: 100, y: 100 }).sort()).toEqual(["3000", "4000", "90°", "90°", "90°", "90°"].sort())
  })

  it("RND-E2E-3: Г-образная комната — один «270°» и пять «90°»", () => {
    expect(
      labels(sceneL(), { x: 20, y: 200 })
        .filter((t) => t.endsWith("°"))
        .sort(),
    ).toEqual(["270°", "90°", "90°", "90°", "90°", "90°"].sort())
  })

  it("RND-E2E-5: излом ровно на 0,5° — подписи «181°» и «180°»", () => {
    const deg = (theta: number): string[] => labels(sceneRbend(theta), { x: 100, y: 100 }).filter((t) => t.endsWith("°"))
    expect(deg(180.5)).toContain("181°")
    expect(deg(180.5)).toHaveLength(5)
    expect(deg(179.5)).toContain("180°")
    expect(deg(179.5)).toHaveLength(5)
  })

  it("RND-E2E-6: комната с перегородкой со свободным концом — шесть «90°», без «270°»", () => {
    expect(
      labels(sceneStub(200), { x: 50, y: 250 })
        .filter((t) => t.endsWith("°"))
        .sort(),
    ).toEqual(["90°", "90°", "90°", "90°", "90°", "90°"])
  })

  it("RND-E2E-4: курсор над стеной — только длина оси", () => {
    expect(labels(sceneR(), { x: 200, y: 0 })).toEqual(["4200"])
  })
})
