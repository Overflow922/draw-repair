import { describe, expect, it } from "vitest"
import type { Battery, Communication, Doorway, Point, FurnitureItem, Wall } from "../types"
import { OBSTACLE_ORDER, furnitureOverlaps, obstaclesOf, overlapKinds, itemOverlaps } from "./overlap"
import type { ObstacleSource, Overlap } from "./overlap"

// change furniture-plan-table: пересечения стола (spec furniture-plan «Пересечения стола»).
// Эталоны посчитаны вручную по геометрии сцен, а не получены из модуля.

const wall = (id: string, ax: number, ay: number, bx: number, by: number, thicknessCm = 20): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thicknessCm, type: "brick" })
const table = (id: string, x: number, y: number, widthCm: number, lengthCm: number, angleDeg = 0): FurnitureItem => ({ id, kind: "table", x, y, widthCm, lengthCm, angleDeg })

const source = (parts: Partial<ObstacleSource> = {}): ObstacleSource => ({ walls: [], drywall: [], plaster: [], elements: [], batteries: [], communications: [], ...parts })

const area = (region: readonly Point[]): number => {
  let s = 0
  for (let i = 0; i < region.length; i++) {
    const a = region[i]
    const b = region[(i + 1) % region.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}
const totalArea = (overlaps: readonly Overlap[]): number => overlaps.reduce((s, o) => s + area(o.region), 0)
const bbox = (region: readonly Point[]): [number, number, number, number] => [
  Math.min(...region.map((p) => p.x)),
  Math.min(...region.map((p) => p.y)),
  Math.max(...region.map((p) => p.x)),
  Math.max(...region.map((p) => p.y)),
]

// вертикальная стена x ∈ [240, 260], y ∈ [0, 300]
const vertical = wall("w", 250, 0, 250, 300)

describe("наложение на стену", () => {
  it("FP-110: стол 80×160 в x 170–250 на стену x 240–260 даёт область 10×160 на (240, 20)–(250, 180)", () => {
    const o = itemOverlaps(table("t", 210, 100, 80, 160), obstaclesOf(source({ walls: [vertical] })))
    expect(o).toHaveLength(1)
    expect(o[0].kind).toBe("wall")
    expect(area(o[0].region)).toBeCloseTo(1600)
    const [x0, y0, x1, y1] = bbox(o[0].region)
    expect([x0, y0, x1, y1].map((v) => Math.round(v))).toEqual([240, 20, 250, 180])
  })

  it("FP-111: касание граней — не пересечение (стол x 160–240 у стены x 240–260)", () => {
    expect(itemOverlaps(table("t", 200, 100, 80, 160), obstaclesOf(source({ walls: [vertical] })))).toEqual([])
  })

  it("FP-111: наложение мельче допуска 0.01 см — не пересечение, глубже — пересечение", () => {
    const obstacles = obstaclesOf(source({ walls: [vertical] }))
    expect(itemOverlaps(table("t", 200.005, 100, 80, 160), obstacles)).toEqual([])
    expect(itemOverlaps(table("t", 200.5, 100, 80, 160), obstacles)).toHaveLength(1)
  })

  it("FP-112: повёрнутый на 45° стол даёт трапецию наложения, а не описанный прямоугольник", () => {
    // квадрат 100×100, центр (200, 100): ромб |dx|+|dy| ≤ 70.71; полоса стены x 240–260:
    // ширина по высоте 61.42 на x=240 и 21.42 на x=260, площадь (61.42 + 21.42) / 2 · 20 = 828.43
    const o = itemOverlaps(table("t", 200, 100, 100, 100, 45), obstaclesOf(source({ walls: [vertical] })))
    expect(o).toHaveLength(1)
    expect(area(o[0].region)).toBeCloseTo(828.43, 1)
  })

  it("FP-112: одну область даёт стена, склеенная из двух стен угла (по куску на каждую)", () => {
    const corner = [wall("a", 250, 0, 250, 300), wall("b", 250, 300, 500, 300)]
    const o = itemOverlaps(table("t", 210, 100, 80, 160), obstaclesOf(source({ walls: corner })))
    expect(totalArea(o)).toBeCloseTo(1600)
  })
})

// change furniture-line-drawings (spec furniture-plan «Каталог видов мебели», сценарий «Пересечение считается по прямоугольнику»)
describe("пересечение считается по прямоугольнику предмета, а не по рисунку", () => {
  it("ID-40: стул 45×45 — стена заходит только в срезанный дугой верхний левый угол рисунка, пересечение есть", () => {
    // стул: x 177.5–222.5, y 77.5–122.5; дуга спинки радиуса 18 с центром (195.5, 95.5) срезает угол. Стена y 71–81, x 160–182:
    // наложение на прямоугольник 4.5 × 3.5 = 15.75 см²; его дальний угол (182, 81) на 19.8 см от центра дуги — вне рисунка
    const chair: FurnitureItem = { id: "c", kind: "chair", x: 200, y: 100, widthCm: 45, lengthCm: 45, angleDeg: 0 }
    const o = itemOverlaps(chair, obstaclesOf(source({ walls: [wall("w", 160, 76, 182, 76, 10)] })))
    expect(o).toHaveLength(1)
    expect(o[0]?.kind).toBe("wall")
    expect(area(o[0]?.region ?? [])).toBeCloseTo(15.75, 2)
  })
})

describe("проёмы, двери и окна", () => {
  // горизонтальная стена y ∈ [190, 210], x ∈ [0, 400]; проём x 100–190 (anchor a, offset 100, width 90)
  const horizontal = wall("h", 0, 200, 400, 200)
  const element = (extra: Partial<Doorway> = {}): Doorway => ({ id: "d", wallId: "h", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210, ...extra })

  it("FP-113: стол в проёме пересекает «проём», но не «стену» — вырез стены не считается телом", () => {
    // стол 40×40, центр (145, 215): y 195–235; в проёме x 125–165, y 195–210 → 40 × 15 = 600
    const o = itemOverlaps(table("t", 145, 215, 40, 40), obstaclesOf(source({ walls: [horizontal], elements: [element()] })))
    expect(overlapKinds(o)).toEqual(["opening"])
    expect(totalArea(o)).toBeCloseTo(600)
  })

  it("FP-113: стол у откоса, не заходя в проём, пересекает стену", () => {
    // x 60–100 примыкает к откосу x=100 без наложения на проём; y 195–235 заходит в тело стены y 190–210 на 15
    const o = itemOverlaps(table("t", 80, 215, 40, 40), obstaclesOf(source({ walls: [horizontal], elements: [element()] })))
    expect(overlapKinds(o)).toEqual(["wall"])
    expect(totalArea(o)).toBeCloseTo(600)
  })

  it("FP-113: дверь и окно называются своими видами", () => {
    const door = { ...element({ id: "x" }), kind: "door" as const, hinge: "a" as const, swing: "left" as const }
    const win = { ...element({ id: "y" }), kind: "window" as const, sillCm: 80 }
    const t = table("t", 145, 215, 40, 40)
    expect(overlapKinds(itemOverlaps(t, obstaclesOf(source({ walls: [horizontal], elements: [door] }))))).toEqual(["door"])
    expect(overlapKinds(itemOverlaps(t, obstaclesOf(source({ walls: [horizontal], elements: [win] }))))).toEqual(["window"])
  })
})

describe("прочие препятствия", () => {
  it("FP-114: гипсокартон и штукатурка называются своими видами", () => {
    const t = table("t", 210, 100, 80, 160)
    expect(overlapKinds(itemOverlaps(t, obstaclesOf(source({ drywall: [vertical] }))))).toEqual(["drywall"])
    expect(overlapKinds(itemOverlaps(t, obstaclesOf(source({ plaster: [vertical] }))))).toEqual(["plaster"])
  })

  it("FP-114: батарея — прямоугольник на грани опорной стены", () => {
    // стена (0,0)–(400,0) толщиной 20; батарея на грани +1 (y > 0): задняя сторона y=10, передняя y=20, x 50–150
    const host = wall("h", 0, 0, 400, 0)
    const battery: Battery = { id: "b", wallId: "h", face: 1, anchor: "a", offsetCm: 50, lengthCm: 100, thicknessCm: 10, gapCm: 0 }
    // стол 40×40 центром (100, 30): y 10–50, x 80–120 — на стену касается (y=10), на батарею налагается 40 × 10
    const o = itemOverlaps(table("t", 100, 30, 40, 40), obstaclesOf(source({ walls: [host], batteries: [battery] })))
    expect(overlapKinds(o)).toEqual(["battery"])
    expect(totalArea(o)).toBeCloseTo(400)
  })

  it("FP-115: стояк — круг, воздуховод — прямоугольник; обе названы «коммуникация»", () => {
    const riser: Communication = { kind: "riser", id: "r", x: 100, y: 100, diameterCm: 20 }
    const duct: Communication = { kind: "duct", id: "d", x: 100, y: 100, widthCm: 40, depthCm: 60 }
    const t = table("t", 100, 100, 100, 100)
    const r = itemOverlaps(t, obstaclesOf(source({ communications: [riser] })))
    expect(overlapKinds(r)).toEqual(["communication"])
    expect(area(r[0].region)).toBeCloseTo(Math.PI * 100, -1) // πr² = 314.16 с точностью многоугольника
    const d = itemOverlaps(t, obstaclesOf(source({ communications: [duct] })))
    expect(area(d[0].region)).toBeCloseTo(2400)
  })

  it("FP-115: стол вне препятствий — пересечений нет", () => {
    expect(itemOverlaps(table("t", 1000, 1000, 80, 160), obstaclesOf(source({ walls: [vertical] })))).toEqual([])
  })
})

describe("столы между собой", () => {
  it("FP-116: два стола внахлёст дают одну область — у стола с меньшим идентификатором", () => {
    const a = table("a", 100, 100, 100, 100) // x 50–150
    const b = table("b", 180, 100, 100, 100) // x 130–230 → наложение 20 × 100
    const o = furnitureOverlaps([b, a], [])
    expect(o).toHaveLength(1)
    expect(o[0].itemId).toBe("a")
    expect(o[0].kind).toBe("furniture")
    expect(area(o[0].region)).toBeCloseTo(2000)
  })

  it("FP-116: столы в касании не пересекаются", () => {
    expect(furnitureOverlaps([table("a", 100, 100, 100, 100), table("b", 200, 100, 100, 100)], [])).toEqual([])
  })

  it("FP-116: призрак видит все столы, включая стол с меньшим идентификатором", () => {
    const placed = table("a", 100, 100, 100, 100)
    const ghost = table("", 180, 100, 100, 100)
    expect(overlapKinds(itemOverlaps(ghost, [], [placed]))).toEqual(["furniture"])
  })
})

describe("виды в плашке", () => {
  // TCR (change furniture-items-catalog): вид препятствия «стол» стал общим видом «furniture», у пересечения есть вид предмета
  const overlap = (kind: Overlap["kind"]): Overlap => ({ kind, itemId: "t", itemKind: "table", region: [] })

  it("FP-117: виды без повторов в порядке «стена, гипсокартон, штукатурка, проём, дверь, окно, батарея, коммуникация, стол»", () => {
    expect(OBSTACLE_ORDER).toEqual(["wall", "drywall", "plaster", "opening", "door", "window", "battery", "communication", "furniture"])
    expect(overlapKinds([overlap("furniture"), overlap("plaster"), overlap("wall"), overlap("plaster"), overlap("drywall")])).toEqual(["wall", "drywall", "plaster", "furniture"])
  })

  it("FP-117: без пересечений видов нет", () => {
    expect(overlapKinds([])).toEqual([])
  })
})
