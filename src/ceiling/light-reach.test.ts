import { describe, expect, it } from "vitest"
import { furnitureReachBodies, reachBodies } from "../furniture/item-wall-reach"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { content, drawing as reconstructionDrawing, drywall } from "../reconstruction/reconstruction.test-utils"
import { drawing as roughDrawing, openingOn, plaster, rectWalls, wall } from "../rough/rough.test-utils"
import type { LightFixture, Point, Wall } from "../types"
import { lightReaches, snapSconce } from "./light-reach"
import type { LightReach } from "./light-reach"

// change add-ceiling-lighting: расстояния объектов освещения до чистовых граней и прилипание бра
// (spec ceiling-lighting «Чистовые грани для расстояний освещения», «Расстояния точки освещения до стен», «Расстояние бра вдоль
// стены», «Группа «Освещение» и постановка»). Помещение сценариев — внутренние грани x = 0, x = 400, y = 0, y = 300: оси стен
// толщиной 20 см на x = −10, x = 410, y = −10, y = 310.

const ROOM = (): Wall[] => rectWalls("w", -10, -10, 410, 310)
const spot = (x: number, y: number, kind: LightFixture["kind"] = "spot"): LightFixture =>
  kind === "sconce" ? { id: "l", kind, x, y, angleDeg: 0 } : { id: "l", kind, x, y }
const sconce = (x: number, y: number, angleDeg: number): LightFixture => ({ id: "b", kind: "sconce", x, y, angleDeg })

// число и направление линии: dir — единичное направление от центра к грани
const shown = (reaches: readonly LightReach[]): { t: number; dir: Point }[] => reaches.map((r) => ({ t: r.t, dir: r.dir }))
const close = (a: { t: number; dir: Point }[], b: { t: number; dir: Point }[]): void => {
  expect(a).toHaveLength(b.length)
  a.forEach((r, i) => {
    const e = b[i]
    if (!e) return
    expect(r.t).toBeCloseTo(e.t, 6)
    expect(r.dir.x).toBeCloseTo(e.dir.x, 9)
    expect(r.dir.y).toBeCloseTo(e.dir.y, 9)
  })
}
const LEFT = { x: -1, y: 0 }
const RIGHT = { x: 1, y: 0 }
const UP = { x: 0, y: -1 }
const DOWN = { x: 0, y: 1 }

describe("расстояния точки освещения", () => {
  it("CL-R1: ближайшие стены по осям — светильник (100, 80): 100 влево, 80 вверх; люстра (250, 200): 150 вправо, 100 вниз", () => {
    close(shown(lightReaches(spot(100, 80), reachBodies(ROOM()))), [{ t: 100, dir: LEFT }, { t: 80, dir: UP }])
    close(shown(lightReaches(spot(250, 200, "chandelier"), reachBodies(ROOM()))), [{ t: 150, dir: RIGHT }, { t: 100, dir: DOWN }])
  })

  it("CL-R2: равные расстояния — влево и вверх", () => {
    close(shown(lightReaches(spot(200, 150, "lighting-outlet"), reachBodies(ROOM()))), [{ t: 200, dir: LEFT }, { t: 150, dir: UP }])
  })

  it("CL-R3: нет стены по одной стороне оси — берётся сторона со стеной", () => {
    const walls = [wall("L", -10, -10, -10, 1000), wall("T", -10, -10, 1000, -10)]
    close(shown(lightReaches(spot(100, 80), reachBodies(walls))), [{ t: 100, dir: LEFT }, { t: 80, dir: UP }])
  })

  it("CL-R4: нет стен по оси — числа этой оси нет", () => {
    const walls = [wall("T", -1000, -10, 1000, -10)]
    close(shown(lightReaches(spot(100, 80), reachBodies(walls))), [{ t: 80, dir: UP }])
  })

  it("CL-R5: ближайшая грань выступа — колонна с гранью x = 40 на y 50..120: по горизонтали 60", () => {
    const column = wall("C", 20, 50, 20, 120, 40)
    close(shown(lightReaches(spot(100, 80), reachBodies([...ROOM(), column]))), [{ t: 60, dir: LEFT }, { t: 80, dir: UP }])
  })

  it("CL-R6: тело, внутри которого лежит центр, не учитывается", () => {
    // центр в толще левой стены (x = −10): лучи идут дальше, до ближайших граней других тел
    const r = lightReaches(spot(-10, 150), reachBodies(ROOM()))
    expect(r.find((x) => x.dir.x !== 0)?.t).toBeCloseTo(410, 6)
  })

  it("CL-R7: центр на грани — число 0 по оси этой грани", () => {
    close(shown(lightReaches(spot(100, 0), reachBodies(ROOM()))), [{ t: 100, dir: LEFT }, { t: 0, dir: UP }])
  })

  it("CL-R8: линия идёт от центра до грани", () => {
    const [x] = lightReaches(spot(100, 80), reachBodies(ROOM()))
    expect(x?.from).toEqual({ x: 100, y: 80 })
    expect(x?.to.x).toBeCloseTo(0, 9)
    expect(x?.to.y).toBeCloseTo(80, 9)
  })
})

describe("чистовые грани", () => {
  const walls = (): Wall[] => ROOM()
  const left = (d: ReturnType<typeof roughDrawing>, at: LightFixture = spot(100, 150)): number | undefined =>
    lightReaches(at, furnitureReachBodies(reconstructionScene(d))).find((r) => r.dir.x !== 0)?.t

  it("CL-R10: до штукатурки 3 см на грани x = 0 — 97", () => {
    const d = roughDrawing({ walls: walls(), roughPlaster: [plaster("p1", "w4", 1, "a", 0, 320, 30), plaster("p2", "w4", -1, "a", 0, 320, 30)] })
    expect(left(d)).toBeCloseTo(97, 6)
  })

  it("CL-R11: до стены гипсокартона с внутренней гранью x = 10 — 90", () => {
    const d = reconstructionDrawing({ walls: walls(), reconstruction: content([drywall("g1", 5, 0, 5, 300, 10)]) })
    expect(left(d)).toBeCloseTo(90, 6)
  })

  it("CL-R12: проём не прерывает грань — 100", () => {
    // проём на w4 против светильника: откосы на y = 210 и y = 120 (центр y = 150 между ними)
    const d = roughDrawing({ walls: walls(), doorways: [openingOn("o1", "w4", 100, 90)] })
    expect(left(d)).toBeCloseTo(100, 6)
  })

  it("CL-R13: мебель и батарея гранями не считаются", () => {
    const d = roughDrawing({ walls: walls() })
    const withFurniture = { ...d, furniture: { items: [{ id: "t", kind: "table" as const, x: 40, y: 150, widthCm: 40, lengthCm: 40, angleDeg: 0 }], dimensions: [] } }
    expect(left(withFurniture)).toBeCloseTo(100, 6)
  })

  it("CL-R14: штукатурка 2 см на левой стене — число 98", () => {
    const d = roughDrawing({ walls: walls(), roughPlaster: [plaster("p1", "w4", 1, "a", 0, 320, 20), plaster("p2", "w4", -1, "a", 0, 320, 20)] })
    expect(left(d, spot(100, 80))).toBeCloseTo(98, 6)
  })
})

describe("расстояние бра вдоль стены", () => {
  it("CL-R20: бра на северной стене (120, 0) — одно число 120 влево по грани", () => {
    const r = lightReaches(sconce(120, 0, 90), reachBodies(ROOM()))
    close(shown(r), [{ t: 120, dir: LEFT }])
    expect(r[0]?.from).toEqual({ x: 120, y: 0 })
    expect(r[0]?.to.y).toBeCloseTo(0, 9)
  })

  it("CL-R21: бра на западной стене (0, 200) — 100 вниз по грани", () => {
    close(shown(lightReaches(sconce(0, 200, 0), reachBodies(ROOM()))), [{ t: 100, dir: DOWN }])
  })

  it("CL-R22: поперечная штукатурка 3 см — 117", () => {
    const d = roughDrawing({ walls: ROOM(), roughPlaster: [plaster("p1", "w4", 1, "a", 0, 320, 30), plaster("p2", "w4", -1, "a", 0, 320, 30)] })
    close(shown(lightReaches(sconce(120, 0, 90), furnitureReachBodies(reconstructionScene(d)))), [{ t: 117, dir: LEFT }])
  })

  it("CL-R23: бра на наклонной стене — вдоль грани до поперечной стены", () => {
    // стена под 45°: грань от (0, 100) к (100, 0) в помещении x ≥ 0, y ≥ 0; бра в середине грани (50, 50), нормаль в помещение (−45°+180 = 225°?)
    const walls = [wall("D", 0, 100, 100, 0, 0.0001), wall("L", -10, -100, -10, 300), wall("T", -100, -10, 300, -10)]
    const r = lightReaches(sconce(50, 50, 225), reachBodies(walls))
    expect(r).toHaveLength(1)
    // вдоль грани к стене x = 0 или к стене y = 0 — одинаково 50·√2; при равенстве — луч с меньшим X
    // луч смещён на 1 мм в помещение: у поперечной стены не под прямым углом расстояние отличается не больше чем на 0,2 см
    expect(Math.abs((r[0]?.t ?? 0) - 50 * Math.SQRT2)).toBeLessThan(0.2)
    expect(r[0]?.dir.x).toBeLessThan(0)
  })

  it("CL-R24: граней вдоль стены нет — числа нет", () => {
    expect(lightReaches(sconce(120, 0, 90), reachBodies([wall("T", -1000, -10, 1000, -10)]))).toEqual([])
  })
})

describe("прилипание бра", () => {
  const bodies = () => reachBodies(ROOM())
  it("CL-P1: курсор в 10 см от северной грани над x = 120 — центр (120, 0), дуга вниз (90°)", () => {
    const s = snapSconce({ x: 120.3, y: 10 }, bodies(), 20)
    expect(s?.at.x).toBe(120)
    expect(s?.at.y).toBeCloseTo(0, 9)
    expect(s?.angleDeg).toBeCloseTo(90, 9)
  })

  it("CL-P2: курсор дальше предела — null; курсор внутри тела — null", () => {
    expect(snapSconce({ x: 200, y: 150 }, bodies(), 20)).toBeNull()
    expect(snapSconce({ x: 120, y: -5 }, bodies(), 20)).toBeNull()
  })

  it("CL-P3: западная грань — центр (0, y), направление 0°", () => {
    const s = snapSconce({ x: 8, y: 200.6 }, bodies(), 20)
    expect(s?.at.x).toBeCloseTo(0, 9)
    expect(s?.at.y).toBe(201)
    expect(s?.angleDeg).toBeCloseTo(0, 9)
  })

  it("CL-P4: штукатурка 3 см на северной стене — центр на поверхности y = 3, не на грани стены под ней", () => {
    const d = roughDrawing({ walls: ROOM(), roughPlaster: [plaster("p1", "w1", 1, "a", 0, 420, 30), plaster("p2", "w1", -1, "a", 0, 420, 30)] })
    const s = snapSconce({ x: 120, y: 10 }, furnitureReachBodies(reconstructionScene(d)), 20)
    expect(s?.at.y).toBeCloseTo(3, 6)
    expect(s?.angleDeg).toBeCloseTo(90, 6)
  })

  it("CL-P5: грань на дробной координате — центр остаётся на грани (y = 7.5), округлён только X", () => {
    const walls = [wall("N", -100, 0, 500, 0, 15)]
    const s = snapSconce({ x: 120.3, y: 20 }, reachBodies(walls), 20)
    expect(s?.at).toEqual({ x: 120, y: 7.5 })
  })
})
