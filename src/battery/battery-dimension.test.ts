import { describe, expect, it } from "vitest"
import { dimPointPoint, measureDimension, nearestDimAnchor } from "../geometry"
import type { BatteryCornerPoint, Dimension, JambPoint } from "../types"
import { bat, expectPoint, sceneF, sceneRP, w, windowAt } from "./battery.test-utils"

// change add-battery: углы батареи как точки замера, направление измерения вдоль оси стены или поперёк
// (spec dimension-tool «Точки замера на углах батареи»; design D5; test-plan B-DIM-*).
// Сцена: W (0,0)-(500,0) t20; батарея X [100,170]×[13,23] на грани y = 10; окно WA [200,320] (откос a на грани +1 — (200,10)).

const { walls } = sceneF()
const X = bat("W", "a", 100)
const WA = windowAt("W", "a", 200)
const corner = (end: "a" | "b", side: "back" | "front", batteryId = "b0"): BatteryCornerPoint => ({ kind: "corner", batteryId, end, side })
const jamb = (elementId: string, j: "a" | "b", face: 1 | -1): JambPoint => ({ kind: "jamb", elementId, jamb: j, face })
const dim = (from: Dimension["from"], to: Dimension["to"]): Dimension => ({ from, to, offset: 20 })

const absDir = (d: { x: number; y: number } | undefined): [number, number] => [Math.abs(d?.x ?? NaN), Math.abs(d?.y ?? NaN)]

describe("разрешение точки замера", () => {
  it("B-DIM-3: угол в мировых координатах: четыре угла X", () => {
    expectPoint(dimPointPoint(corner("a", "back"), walls, [], [X]) ?? { x: NaN, y: NaN }, 100, 13)
    expectPoint(dimPointPoint(corner("a", "front"), walls, [], [X]) ?? { x: NaN, y: NaN }, 100, 23)
    expectPoint(dimPointPoint(corner("b", "back"), walls, [], [X]) ?? { x: NaN, y: NaN }, 170, 13)
    expectPoint(dimPointPoint(corner("b", "front"), walls, [], [X]) ?? { x: NaN, y: NaN }, 170, 23)
  })

  it("B-DIM-7: батареи или её опорной стены нет — точка не разрешается (null)", () => {
    expect(dimPointPoint(corner("a", "back"), walls, [], [])).toBeNull()
    expect(dimPointPoint(corner("a", "back", "other"), walls, [], [X])).toBeNull()
    expect(dimPointPoint(corner("a", "back"), [], [], [X])).toBeNull()
  })

  it("B-DIM-7b: размер к углу несуществующей батареи не измеряется (null)", () => {
    expect(measureDimension(dim(corner("a", "back"), jamb("w0", "a", 1)), walls, [WA], [])).toBeNull()
  })
})

describe("прикрепление к углам инструментом «Размер»", () => {
  it("B-DIM-3c: курсор у каждого из четырёх углов даёт именно этот угол", () => {
    const cases: [number, number, "a" | "b", "back" | "front"][] = [
      [100, 13, "a", "back"],
      [100, 23, "a", "front"],
      [170, 13, "b", "back"],
      [170, 23, "b", "front"],
    ]
    for (const [x, y, end, side] of cases) {
      const hit = nearestDimAnchor({ x: x + 1, y: y + 1 }, walls, [], 3, [X])
      expect(hit?.anchor).toEqual(corner(end, side))
      expectPoint(hit?.point ?? { x: NaN, y: NaN }, x, y)
    }
  })

  it("B-DIM-3d: клик мимо углов и вершин вне радиуса не задаёт точку", () => {
    expect(nearestDimAnchor({ x: 135, y: 18 }, walls, [], 3, [X])).toBeNull()
  })

  it("B-DIM-4: при равных расстояниях вершина контура выигрывает у угла батареи (угол вплотную к перегородке P)", () => {
    const rp = sceneRP() // P: тело x ∈ [295,305], упирается в грань W y = 10: вершина контура (295,10)
    const flush = bat("W", "a", 225, { gapCm: 0 }) // [225,295]×[10,20]: угол b/back = (295,10) совпадает с вершиной
    const hit = nearestDimAnchor({ x: 295, y: 10 }, rp.walls, [], 3, [flush])
    expect(hit?.anchor.kind).toBeUndefined()
    // та же батарея без совпадения: другой её угол (225,10) — это именно угол батареи
    expect(nearestDimAnchor({ x: 225, y: 10 }, rp.walls, [], 3, [flush])?.anchor).toEqual(corner("a", "back"))
  })

  it("B-DIM-4b: откос окна выигрывает у угла батареи при равенстве расстояний (откос и угол в одной точке)", () => {
    const flush = bat("W", "a", 130, { gapCm: 0 }) // [130,200]×[10,20]: угол b/back = (200,10), как откос a окна на грани +1
    const hit = nearestDimAnchor({ x: 200, y: 10 }, walls, [WA], 3, [flush])
    expect(hit?.anchor).toEqual(jamb("w0", "a", 1))
    // без окна та же точка — угол батареи
    expect(nearestDimAnchor({ x: 200, y: 10 }, walls, [], 3, [flush])?.anchor).toEqual(corner("b", "back"))
  })

  it("B-DIM-8: без списка батарей (подложка «Монтажа») углы не предлагаются", () => {
    expect(nearestDimAnchor({ x: 171, y: 24 }, walls, [], 3, [])).toBeNull()
    expect(nearestDimAnchor({ x: 171, y: 24 }, walls, [], 3)).toBeNull()
  })
})

describe("направление измерения", () => {
  it("B-DIM-1: угол b/front (170,23) и откос a окна (200,10): проекции 30 (ось) и 13 (нормаль) — измерение вдоль оси, число 30", () => {
    const m = measureDimension(dim(corner("b", "front"), jamb("w0", "a", 1)), walls, [WA], [X])
    expect(m?.valueCm).toBeCloseTo(30, 6)
    expect(absDir(m?.direction)[0]).toBeCloseTo(1, 6)
    expect(absDir(m?.direction)[1]).toBeCloseTo(0, 6)
  })

  it("B-DIM-2: откос a окна (100,10) и угол a/front (100,23): проекция на ось 0 < 13 — измерение поперёк, число 13 (отступ + толщина)", () => {
    const win = windowAt("W", "a", 100)
    const m = measureDimension(dim(jamb("w0", "a", 1), corner("a", "front")), walls, [win], [X])
    expect(m?.valueCm).toBeCloseTo(13, 6)
    expect(absDir(m?.direction)[0]).toBeCloseTo(0, 6)
    expect(absDir(m?.direction)[1]).toBeCloseTo(1, 6)
  })

  it("B-DIM-9: равные проекции (36 и 36): выбирается ось", () => {
    const Z = bat("W", "a", 206, { id: "z", face: -1 }) // a/back = (206,−13)
    const m = measureDimension(dim(corner("b", "front"), corner("a", "back", "z")), walls, [], [X, Z])
    expect(m?.valueCm).toBeCloseTo(36, 6)
    expect(absDir(m?.direction)[0]).toBeCloseTo(1, 6)
  })

  it("B-DIM-9b: два угла одного торца (a/back — a/front): число 10 (толщина), поперёк стены", () => {
    const m = measureDimension(dim(corner("a", "back"), corner("a", "front")), walls, [], [X])
    expect(m?.valueCm).toBeCloseTo(10, 6)
    expect(absDir(m?.direction)[1]).toBeCloseTo(1, 6)
  })

  it("B-DIM-9c: два угла одной стороны (a/front — b/front): число 70 (длина), вдоль оси", () => {
    const m = measureDimension(dim(corner("a", "front"), corner("b", "front")), walls, [], [X])
    expect(m?.valueCm).toBeCloseTo(70, 6)
    expect(absDir(m?.direction)[0]).toBeCloseTo(1, 6)
  })

  it("B-DIM-5: размер между батареями на одной грани: X b/front (170,23) → Y a/front (300,23): число 130, вдоль оси", () => {
    const Y = bat("W", "a", 300, { id: "y" })
    const m = measureDimension(dim(corner("b", "front"), corner("a", "front", "y")), walls, [], [X, Y])
    expect(m?.valueCm).toBeCloseTo(130, 6)
    expect(absDir(m?.direction)[0]).toBeCloseTo(1, 6)
  })

  it("B-DIM-5b: направление определяет ось стены той батареи, чей угол — первая точка; на наклонной стене — её ось (0,6 / 0,8)", () => {
    const D = w(0, 0, 300, 400, "D")
    const onD = bat("D", "a", 100, { id: "d1" })
    const m = measureDimension(dim(corner("a", "front", "d1"), corner("b", "front", "d1")), [D], [], [onD])
    expect(m?.valueCm).toBeCloseTo(70, 6)
    expect(absDir(m?.direction)[0]).toBeCloseTo(0.6, 6)
    expect(absDir(m?.direction)[1]).toBeCloseTo(0.8, 6)
  })

  it("B-DIM-9d: размеры без углов батареи измеряются, как раньше: прямое расстояние между откосами на разных гранях √(120² + 20²)", () => {
    const m = measureDimension(dim(jamb("w0", "a", 1), jamb("w0", "b", -1)), walls, [WA], [])
    expect(m?.valueCm).toBeCloseTo(Math.hypot(120, 20), 6)
  })
})

describe("размер следует за батареей и стеной", () => {
  const link = dim(corner("b", "front"), jamb("w0", "a", 1))
  const value = (batteries: ReturnType<typeof bat>[], wallList = walls): number | undefined =>
    measureDimension(link, wallList, [{ ...WA }], batteries)?.valueCm

  it("B-DIM-6: перемещение батареи на 50 пересчитывает число: угол (220,23), откос (200,10) → 20", () => {
    expect(value([bat("W", "a", 150)])).toBeCloseTo(20, 6)
  })

  it("B-DIM-6b: смена длины на 85: угол b/front на x = 185, проекции 15 (ось) и 13 (нормаль) → число 15", () => {
    expect(value([bat("W", "a", 100, { lengthCm: 85 })])).toBeCloseTo(15, 6)
  })

  it("B-DIM-6c: смена отступа и толщины не меняет число вдоль оси (30), пока проекция на ось больше", () => {
    expect(value([bat("W", "a", 100, { gapCm: 8, thicknessCm: 15 })])).toBeCloseTo(30, 6)
  })

  it("B-DIM-6d: перенос опорной стены на (0, 50) сохраняет число (угол и откос едут вместе)", () => {
    const moved = [{ ...walls[0], a: { x: 0, y: 50 }, b: { x: 500, y: 50 } }]
    expect(value([X], moved)).toBeCloseTo(30, 6)
  })

  it("B-DIM-6e: растяжение конца b не меняет число (привязка a)", () => {
    const stretched = [{ ...walls[0], b: { x: 700, y: 0 } }]
    expect(value([X], stretched)).toBeCloseTo(30, 6)
  })
})

describe("ось измерения берётся у батареи первой точки", () => {
  // две батареи на разных стенах: X на горизонтальной W и d1 на наклонной D (0,0)-(300,400), ось (0,6; 0,8), нормаль (−0,8; 0,6)
  const D = w(0, 0, 300, 400, "D")
  const d1 = bat("D", "a", 100, { id: "d1" })
  const both = [...walls, D]
  // угол X b/front = (170,23); угол d1 a/front = (0,6·100 − 0,8·23; 0,8·100 + 0,6·23) = (41,6; 93,8)
  const fromX = dim(corner("b", "front"), corner("a", "front", "d1"))
  const fromD = dim(corner("a", "front", "d1"), corner("b", "front"))

  it("B-DIM-11: первая точка — угол X: ось W; Δ = (−128,4; 70,8): проекция на ось W 128,4 больше проекции на нормаль 70,8 → число 128,4 вдоль W", () => {
    const m = measureDimension(fromX, both, [], [X, d1])
    expect(m?.valueCm).toBeCloseTo(128.4, 6)
    expect(absDir(m?.direction)[0]).toBeCloseTo(1, 6)
    expect(absDir(m?.direction)[1]).toBeCloseTo(0, 6)
  })

  it("B-DIM-11b: те же точки в обратном порядке: ось D; проекция на ось D 20,4, на нормаль D 145,2 → число 145,2 поперёк D", () => {
    const m = measureDimension(fromD, both, [], [X, d1])
    expect(m?.valueCm).toBeCloseTo(145.2, 6)
    expect(absDir(m?.direction)[0]).toBeCloseTo(0.8, 6)
    expect(absDir(m?.direction)[1]).toBeCloseTo(0.6, 6)
  })

  it("B-DIM-11c: перестановка точек даёт разные числа (защита от «ось всегда по второй точке»)", () => {
    const a = measureDimension(fromX, both, [], [X, d1])?.valueCm
    const b = measureDimension(fromD, both, [], [X, d1])?.valueCm
    expect(a).not.toBeCloseTo(b ?? NaN, 3)
  })
})
