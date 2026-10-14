import { describe, expect, it } from "vitest"
import { applyNumber } from "../communications/edit"
import { ghostPosition, moveLimited } from "../communications/placement"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "../wall-edit"
import { batteryHolds } from "./battery-geometry"
import { limitNewWallByBatteries, squareAllowedForBatteries, thicknessAllowedForBatteries, violatesBatteries } from "./battery-guard"
import { axisOverlap, bat, duct, expectPoint, riser, w } from "./battery.test-utils"
import type { Wall } from "../types"

// change add-battery: двустороннее ограничение — стены и коммуникации не налагаются на батареи
// (spec battery «Размещение батареи вдоль стены»; wall-collision «Стены не налагаются на батареи»; communications «Коммуникации не
// налагаются на батареи»; design D4; test-plan B-GRD-*).
// Сцена: W (0,0)-(500,0) t20 с батареей X [100,170]×[13,23] на грани y = 10; M — перегородка (0,40)-(300,40) t10 (тело y ∈ [35,45]).
// Функции правки стен мутируют стены (spec-тесты wall-collision), поэтому стены создаются заново в каждом тесте.

const FREE = { ortho: false } as const
const mkW = (): Wall => w(0, 0, 500, 0, "W")
const mkM = (): Wall => w(0, 40, 300, 40, "M", 10)
const W = mkW()
const M = mkM()
const X = bat("W", "a", 100)
const shifted = (wall: Wall, dy: number): Wall => ({ ...wall, a: { x: wall.a.x, y: wall.a.y + dy }, b: { x: wall.b.x, y: wall.b.y + dy } })

describe("violatesBatteries", () => {
  it("B-GRD-0: касание допустимо, наложение — нет (ось M на y = 28: низ тела на y = 23 касается; на y = 27 — наложение 1)", () => {
    expect(violatesBatteries([W, M], [W, shifted(M, -12)], [X])).toBe(false)
    expect(violatesBatteries([W, M], [W, shifted(M, -13)], [X])).toBe(true)
  })

  it("B-GRD-12: граница допуска: 0,009 см — допустимо, 0,011 см — нарушение", () => {
    expect(violatesBatteries([W, M], [W, shifted(M, -12.009)], [X])).toBe(false)
    expect(violatesBatteries([W, M], [W, shifted(M, -12.011)], [X])).toBe(true)
  })

  it("B-GRD-0b: без батарей нарушения нет", () => {
    expect(violatesBatteries([W, M], [W, shifted(M, -30)], [])).toBe(false)
  })

  it("B-GRD-6: наложение из документа не углубляется: 3 → 2 допустимо, 3 → 3 допустимо, 3 → 4 нарушение", () => {
    const overlapped = [W, shifted(M, -15)] // ось 25: тело [20,30], глубина 3
    expect(violatesBatteries(overlapped, [W, shifted(M, -14)], [X])).toBe(false)
    expect(violatesBatteries(overlapped, [W, shifted(M, -15)], [X])).toBe(false)
    expect(violatesBatteries(overlapped, [W, shifted(M, -16)], [X])).toBe(true)
  })

  it("B-GRD-5: опорная стена своей батареей не ограничивается: W сдвинута на (0, 50) — нарушения нет", () => {
    expect(violatesBatteries([W, M], [shifted(W, 50), M], [X])).toBe(false)
  })

  it("B-GRD-5b: батарея на M (грань −1, полоса y ∈ [22,32]) — препятствие для W: W, сдвинутая на 15 (тело [5,25]), налезает", () => {
    const onM = bat("M", "a", 100, { id: "bm", face: -1 })
    expect(violatesBatteries([W, M], [W, M], [onM])).toBe(false)
    expect(violatesBatteries([W, M], [shifted(W, 15), M], [onM])).toBe(true)
    expect(violatesBatteries([W, M], [shifted(W, 12), M], [onM])).toBe(false) // тело [2,22]: касание
  })

  it("B-GRD-0c: батарея на передвигаемой стене едет с ней и упирается в чужой объект: воздуховод y ∈ [60,80]", () => {
    const D = duct(135, 70, 20, 20)
    expect(violatesBatteries([W], [shifted(W, 36)], [X], [D])).toBe(false) // батарея y ∈ [49,59]
    expect(violatesBatteries([W], [shifted(W, 38)], [X], [D])).toBe(true) // [51,61]: наложение 1
  })

  it("B-GRD-0d: батарея на передвигаемой стене и батарея на другой стене: наложение 0,5 см — нарушение, касание — нет", () => {
    const M2 = shifted(M, 30) // ось y = 70
    const other = bat("M", "a", 100, { id: "bm", face: -1 }) // полоса y ∈ [52,62]
    expect(violatesBatteries([W, M2], [shifted(W, 29), M2], [X, other])).toBe(false) // X: [42,52]
    expect(violatesBatteries([W, M2], [shifted(W, 30.5), M2], [X, other])).toBe(true) // X: [43,53]
  })
})

describe("перемещение, растяжение и длина стены", () => {
  it("B-GRD-1: M (0,40)-(300,40) на (0, −60) останавливается: низ тела касается верха батареи (ось y = 28, смещение (0, −12))", () => {
    const walls = [mkW(), mkM()]
    const v = moveWallsBounded(walls, [walls[1]], { x: 0, y: -60 }, { ...FREE, batteries: [X] })
    expectPoint(v, 0, -12, 4)
    expectPoint(walls[1].a, 0, 28, 4)
    expectPoint(walls[1].b, 300, 28, 4)
  })

  it("B-GRD-1b: контроль: без батарей та же правка идёт дальше — до касания с W (ось y = 15, смещение (0, −25))", () => {
    const walls = [mkW(), mkM()]
    expectPoint(moveWallsBounded(walls, [walls[1]], { x: 0, y: -60 }, { ...FREE }), 0, -25, 4)
  })

  it("B-GRD-1c: стена вне зоны батареи (x ∈ [200,300]) проходит мимо: смещение (0, −25) целиком", () => {
    const side = w(200, 40, 300, 40, "S", 10)
    const walls = [mkW(), side]
    expectPoint(moveWallsBounded(walls, [side], { x: 0, y: -25 }, { ...FREE, batteries: [X] }), 0, -25, 4)
  })

  it("B-GRD-2: конец стены V (140,100)-(140,200) t10 тянут к (140, 0): останавливается на y = 23 (верх батареи)", () => {
    const V = w(140, 100, 140, 200, "V", 10)
    const walls = [mkW(), V]
    expectPoint(moveEndpointBounded(walls, V, "a", { x: 140, y: 0 }, { ...FREE, batteries: [X] }), 140, 23, 4)
  })

  it("B-GRD-2b: ввод длины: V (140,200)→(140,100), длина 500 ограничена батареей: фактическая длина 177 (от y = 200 до 23)", () => {
    const V = w(140, 200, 140, 100, "V", 10)
    const walls = [mkW(), V]
    const r = resizeWallBounded(walls, V, 500, { ...FREE, batteries: [X] })
    expect(r).toEqual({ kind: "applied", lengthCm: expect.closeTo(177, 4) })
  })

  it("B-GRD-5c: перемещение опорной стены вместе с её батареей на свободное место проходит целиком", () => {
    const walls = [mkW(), mkM()]
    expectPoint(moveWallsBounded(walls, [walls[0]], { x: 0, y: -5 }, { ...FREE, batteries: [X] }), 0, -5, 4)
  })

  it("B-GRD-8: опорная стена с батареей упирается по батарее в воздуховод y ∈ [60,80]: смещение (0, 100) → (0, 37)", () => {
    const D = duct(135, 70, 20, 20)
    const walls = [mkW()]
    expectPoint(moveWallsBounded(walls, [walls[0]], { x: 0, y: 100 }, { ...FREE, batteries: [X], communications: [D] }), 0, 37, 4)
  })
})

describe("толщина стены", () => {
  it("B-GRD-4: толщина M до 34 касается батареи (тело y ∈ [23,57]) — допустима; до 36 (тело [22,58]) — наложение", () => {
    expect(thicknessAllowedForBatteries([W, M], M, 34, [X])).toBe(true)
    expect(thicknessAllowedForBatteries([W, M], M, 36, [X])).toBe(false)
  })

  it("B-GRD-4b: утолщение опорной стены выдвигает батарею вперёд (20 → 30: [13,23] → [18,28]); упирается в воздуховод y ∈ [25,35] — не применяется", () => {
    const D = duct(135, 30, 20, 10)
    expect(thicknessAllowedForBatteries([W], W, 20, [X], [D])).toBe(true)
    expect(thicknessAllowedForBatteries([W], W, 30, [X], [D])).toBe(false)
  })
})

describe("рисование стены", () => {
  it("B-GRD-2c: стена t20 из (0,18) к (300,18) заканчивается на (100,18): торец тела — плоский, по прямоугольнику от начала до конца без выступа, и касается батареи (как у стояка: конец в (95,0) при стояке в x = 100)", () => {
    const end = limitNewWallByBatteries({ x: 0, y: 18 }, { x: 300, y: 18 }, 20, [W], [X])
    expect(end).not.toBeNull()
    if (end) expectPoint(end, 100, 18, 4)
  })

  it("B-GRD-2d: стена мимо батареи (y = 60) не ограничивается", () => {
    const end = limitNewWallByBatteries({ x: 0, y: 60 }, { x: 300, y: 60 }, 20, [W], [X])
    expect(end).not.toBeNull()
    if (end) expectPoint(end, 300, 60, 4)
  })

  it("B-GRD-2e: начало вплотную к батарее и конец по ту сторону — нулевая стена, null", () => {
    expect(limitNewWallByBatteries({ x: 100, y: 18 }, { x: 300, y: 18 }, 20, [W], [X])).toBeNull()
  })

  const square = (cx: number, cy: number) => [
    { x: cx - 10, y: cy - 10 },
    { x: cx + 10, y: cy - 10 },
    { x: cx + 10, y: cy + 10 },
    { x: cx - 10, y: cy + 10 },
  ]

  it("B-GRD-3: начальный квадрат установки 20×20, налагающийся на батарею, не фиксирует начало; вдали — допустим", () => {
    expect(squareAllowedForBatteries(square(130, 18), [W], [X])).toBe(false)
    expect(squareAllowedForBatteries(square(400, 100), [W], [X])).toBe(true)
  })

  it("B-GRD-3b: квадрат вплотную (низ квадрата на y = 23) допустим", () => {
    expect(squareAllowedForBatteries(square(130, 33), [W], [X])).toBe(true)
  })
})

describe("коммуникации", () => {
  const D = (cy: number) => duct(135, cy, 20, 20)
  const boxOfDuct = (c: { x: number; y: number }) => ({ minX: c.x - 10, minY: c.y - 10, maxX: c.x + 10, maxY: c.y + 10 })
  const batteryBox = { minX: 100, minY: 13, maxX: 170, maxY: 23 }

  it("B-GRD-7: воздуховод, двигаемый к батарее, останавливается в касании: центр (135,33), верх на y = 23", () => {
    expectPoint(moveLimited(D(100), { x: 135, y: 30 }, [W], [], [X]), 135, 33, 3)
  })

  it("B-GRD-7b: контроль: без батарей воздуховод доходит до цели (135,30)", () => {
    expectPoint(moveLimited(D(100), { x: 135, y: 30 }, [W], []), 135, 30, 3)
  })

  it("B-GRD-7c: стояк Ø 20 идёт справа к торцу батареи и встаёт, касаясь её круглым боком: центр x ≈ 179,8", () => {
    // ближайшая к центру стояка точка прямоугольника — угол (170, 23); расстояние до него равно радиусу: Δx = √(10² − 2²) ≈ 9,798
    const p = moveLimited(riser(300, 25, 20), { x: 100, y: 25 }, [W], [], [X])
    expect(p.x).toBeCloseTo(170 + Math.sqrt(96), 1)
    expect(p.y).toBeCloseTo(25, 3)
  })

  it("B-GRD-8b: призрак установки над батареей: нет или без наложения (глубина ≤ 0,01)", () => {
    const g = ghostPosition(D(100), { x: 135, y: 18 }, [W], [], [X])
    if (g) expect(axisOverlap(boxOfDuct(g), batteryBox)).toBeLessThanOrEqual(0.01)
  })

  it("B-GRD-9: касание допустимо: воздуховод в (180,33) (угол касается угла батареи) ставится на место", () => {
    const g = ghostPosition(duct(180, 33, 20, 20), { x: 180, y: 33 }, [W], [], [X])
    expect(g).toMatchObject({ kind: "duct", x: 180, y: 33 })
  })

  it("B-GRD-11: наложение из документа не углубляется: воздуховод, вошедший в батарею на 3 см (центр y = 30), на y = 26 не идёт", () => {
    expect(moveLimited(D(30), { x: 135, y: 26 }, [W], [], [X]).y).toBeGreaterThanOrEqual(29.99)
  })

  it("B-GRD-11b: из наложения можно выйти: цель (135,60) достигается", () => {
    expectPoint(moveLimited(D(30), { x: 135, y: 60 }, [W], [], [X]), 135, 60, 3)
  })
})

describe("конец стены, к которому привязана батарея", () => {
  // стена S (0,0)-(150,0): батарея длиной 40 лежит в мире на [100,140]
  const mkS = (): Wall => w(0, 0, 150, 0, "S")
  const fromA = bat("S", "a", 100, { id: "ba", lengthCm: 40 }) // t ∈ [100,140] от конца a: едет вместе с концом a
  const fromB = bat("S", "b", 10, { id: "bb", lengthCm: 40 }) // от конца b: стоит на месте при движении конца a

  it("B-FOL-11: привязка a: конец a тянут к (50,0) — стена не короче 140 (батарея до t = 140): конец останавливается на x = 10", () => {
    const S = mkS()
    expectPoint(moveEndpointBounded([S], S, "a", { x: 50, y: 0 }, { ...FREE, batteries: [fromA] }), 10, 0, 4)
  })

  it("B-FOL-11b: привязка b: конец a тянут к (120,0) — батарея остаётся в мире [100,140], конец останавливается на x = 100", () => {
    const S = mkS()
    expectPoint(moveEndpointBounded([S], S, "a", { x: 120, y: 0 }, { ...FREE, batteries: [fromB] }), 100, 0, 4)
  })

  it("B-FOL-11c: контроль: без батарей конец a доходит до (120,0)", () => {
    const S = mkS()
    expectPoint(moveEndpointBounded([S], S, "a", { x: 120, y: 0 }, { ...FREE }), 120, 0, 4)
  })

  it("B-FOL-11d: ввод длины стены 120: привязка a — длина ограничена 140 (батарея до t = 140)", () => {
    const S = mkS()
    expect(resizeWallBounded([S], S, 120, { ...FREE, batteries: [fromA] })).toEqual({ kind: "applied", lengthCm: expect.closeTo(140, 4) })
  })

  it("B-FOL-11e: ввод длины 120 при привязке b — применяется целиком (батарея едет с концом b: t от b = [10,50], помещается)", () => {
    const S = mkS()
    expect(resizeWallBounded([S], S, 120, { ...FREE, batteries: [fromB] })).toEqual({ kind: "applied", lengthCm: expect.closeTo(120, 4) })
  })

  it("B-FOL-11f: перемещение всей стены S вместе с её батареей не ограничивается самой батареей", () => {
    const S = mkS()
    expectPoint(moveWallsBounded([S], [S], { x: 30, y: 40 }, { ...FREE, batteries: [fromA] }), 30, 40, 4)
  })
})

describe("коммуникации: ввод размеров", () => {
  const walls1 = [W]

  it("B-GRD-10: диаметр стояка у батареи: центр (135,35), запрошено 40 → наибольший допустимый 24 (круг касается верха батареи y = 23)", () => {
    const r = applyNumber(riser(135, 35, 20), { kind: "diameter" }, 40, walls1, [], [X])
    expect(r.changed).toBe(true)
    expect(r.communication.kind === "riser" ? r.communication.diameterCm : NaN).toBeCloseTo(24, 2)
  })

  it("B-GRD-10b: без батарей тот же ввод применяется целиком (40)", () => {
    const r = applyNumber(riser(135, 35, 20), { kind: "diameter" }, 40, walls1, [])
    expect(r.communication.kind === "riser" ? r.communication.diameterCm : NaN).toBe(40)
  })

  it("B-GRD-10c: глубина воздуховода, касающегося батареи, не налезает на неё: после ввода наложения нет", () => {
    const start = duct(135, 33, 20, 20) // y ∈ [23,43]: касается верха батареи
    const r = applyNumber(start, { kind: "depth" }, 40, walls1, [], [X])
    const c = r.communication
    if (c.kind === "duct") {
      const box = { minX: c.x - c.widthCm / 2, minY: c.y - c.depthCm / 2, maxX: c.x + c.widthCm / 2, maxY: c.y + c.depthCm / 2 }
      expect(axisOverlap(box, { minX: 100, minY: 13, maxX: 170, maxY: 23 })).toBeLessThanOrEqual(0.01)
    }
  })

  it("B-GRD-10d: ввод, не меняющий воздуховод, — changed = false (без записи в историю)", () => {
    const start = duct(135, 33, 20, 20)
    expect(applyNumber(start, { kind: "width" }, 20, walls1, [], [X]).changed).toBe(false)
  })
})

describe("правка опорной стены, увлекающая батарею в объект", () => {
  const FREE2 = { ortho: false } as const
  const mkS = (): Wall => w(0, 0, 300, 0, "S")
  const carried = bat("S", "a", 100, { id: "ba", lengthCm: 40 }) // мир [100,140]; едет вместе с концом a
  const obstacle = duct(180, 24, 20, 20) // x ∈ [170,190], y ∈ [14,34] — на уровне полосы батареи [13,23]

  it("B-FOL-12: конец a тянут к (60,0): батарея с привязкой a едет вместе с ним и упирается в воздуховод — конец останавливается на x = 30", () => {
    const S = mkS()
    expectPoint(moveEndpointBounded([S], S, "a", { x: 60, y: 0 }, { ...FREE2, batteries: [carried], communications: [obstacle] }), 30, 0, 4)
  })

  it("B-FOL-12b: контроль: без батарей конец a доходит до цели (60,0)", () => {
    const S = mkS()
    expectPoint(moveEndpointBounded([S], S, "a", { x: 60, y: 0 }, { ...FREE2, communications: [obstacle] }), 60, 0, 4)
  })

  it("B-FOL-12c: поворот: конец b опускают из (300,0) к (300,100); батарея с привязкой a поворачивается и упирается в воздуховод под стеной — конец останавливается раньше цели, батарея не налегает", () => {
    const S = mkS()
    const below = duct(120, 50, 20, 20) // x ∈ [110,130], y ∈ [40,60]
    const end = moveEndpointBounded([S], S, "b", { x: 300, y: 100 }, { ...FREE2, batteries: [carried], communications: [below] })
    expect(end.y).toBeGreaterThan(0)
    expect(end.y).toBeLessThan(100)
    expect(batteryHolds(carried, { walls: [S], batteries: [], communications: [below] })).toBe(true)
  })

  it("B-FOL-12d: ввод длины стены не прячет батарею: резать стену до 120 при батарее до t = 140 нельзя (см. B-FOL-11d), здесь воздуховод за концом не мешает", () => {
    const S = mkS()
    expect(resizeWallBounded([S], S, 200, { ...FREE2, batteries: [carried], communications: [obstacle] }).kind).toBe("applied")
  })
})

describe("коммуникации: ввод расстояния", () => {
  it("B-GRD-10e: ввод расстояния воздуховода «вверх» до стены (5) останавливается у батареи: центр y ≈ 33 (верх воздуховода на y = 23), а не 25", () => {
    const start = duct(135, 60, 20, 20)
    const r = applyNumber(start, { kind: "distance", dir: "up" }, 5, [W], [], [X])
    expect(r.changed).toBe(true)
    expect(r.communication.y).toBeCloseTo(33, 3)
  })

  it("B-GRD-10f: контроль: без батарей воздуховод доходит до заданного расстояния (центр y = 25)", () => {
    const start = duct(135, 60, 20, 20)
    const r = applyNumber(start, { kind: "distance", dir: "up" }, 5, [W], [])
    expect(r.communication.y).toBeCloseTo(25, 3)
  })
})
