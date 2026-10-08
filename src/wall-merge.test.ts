import { describe, expect, it } from "vitest"
import type { Scene } from "./history"
import { drawingHistory, emptyHistory, record, undoEntry } from "./history"
import { dimPointPoint, wallShape } from "./geometry"
import { doorLeaf } from "./doorway/doorway-layout"
import { doorwayHolds, jambsT } from "./doorway/doorway-faces"
import { door, w } from "./doorway/doorway.test-utils"
import { dr } from "./doorway/door.test-utils"
import { win } from "./doorway/window.test-utils"
import type { Dimension, Point, Wall, WallElement } from "./types"
import { mergeContinuation } from "./wall-merge"

// change merge-collinear-walls: слияние продолжения со стеной (specs wall-drawing «Продолжение стены
// удлиняет существующую», doorway «Элементы остаются на месте при удлинении опорной стены»; design D1–D6).
// Числа выведены из спецификации и геометрии сцен, а не из продакшн-кода.

const EPS = 1e-6

const sceneOf = (walls: Wall[], doorways: WallElement[] = [], dimensions: Dimension[] = []): Scene => ({ walls, dimensions, doorways })

// стена E: (0,0)-(500,0), кирпич, 20 см; N — продолжение с теми же материалом и толщиной
const E = (): Wall => w(0, 0, 500, 0, "E")
const N = (ax: number, ay: number, bx: number, by: number, thicknessCm = 20): Wall => w(ax, ay, bx, by, "N", thicknessCm)

function merged(scene: Scene, wall: Wall): Scene {
  const r = mergeContinuation(scene, wall)
  if (r.kind !== "merged") throw new Error(`ожидалось слияние, получено ${r.kind}`)
  return r.scene
}

const wallOf = (scene: Scene, id: string): Wall => {
  const found = scene.walls.find((x) => x.id === id)
  if (!found) throw new Error(`нет стены ${id}`)
  return found
}

const expectPoint = (p: Point, x: number, y: number, digits = 6): void => {
  expect(p.x).toBeCloseTo(x, digits)
  expect(p.y).toBeCloseTo(y, digits)
}

// откосы элемента в мировых координатах по независимой модели (spec doorway «Проём и опорная стена»)
function jambsWorld(el: WallElement, wall: Wall): [Point, Point] {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  const [t1, t2] = el.anchor === "a" ? [el.offsetCm, el.offsetCm + el.widthCm] : [len - el.offsetCm - el.widthCm, len - el.offsetCm]
  const at = (t: number): Point => ({ x: wall.a.x + ((wall.b.x - wall.a.x) / len) * t, y: wall.a.y + ((wall.b.y - wall.a.y) / len) * t })
  return [at(t1), at(t2)]
}

function expectSameJambs(before: Scene, after: Scene, id: string): void {
  const el0 = (before.doorways ?? []).find((d) => d.id === id)
  const el1 = (after.doorways ?? []).find((d) => d.id === id)
  if (!el0 || !el1) throw new Error(`нет элемента ${id}`)
  const w0 = wallOf(before, el0.wallId)
  const w1 = wallOf(after, el1.wallId)
  const key = (p: Point): number => p.x * 1e6 + p.y
  const s0 = [...jambsWorld(el0, w0)].sort((p, q) => key(p) - key(q))
  const s1 = [...jambsWorld(el1, w1)].sort((p, q) => key(p) - key(q))
  expectPoint(s1[0], s0[0].x, s0[0].y)
  expectPoint(s1[1], s0[1].x, s0[1].y)
  expect(el1.widthCm).toBe(el0.widthCm)
  expect(el1.heightCm).toBe(el0.heightCm)
  expect(el1.id).toBe(el0.id)
  expect(el1.wallId).toBe(el0.wallId)
  expect(el1.kind).toBe(el0.kind)
}

function expectClose(actual: unknown, expected: unknown, path = "value"): void {
  if (typeof expected === "number" && typeof actual === "number") {
    expect(Math.abs(actual - expected), path).toBeLessThan(EPS)
    return
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    expect(actual.length, path).toBe(expected.length)
    expected.forEach((e, i) => expectClose(actual[i], e, `${path}[${i}]`))
    return
  }
  if (expected && typeof expected === "object" && actual && typeof actual === "object") {
    const keys = Object.keys(expected)
    expect(Object.keys(actual).sort(), path).toEqual([...keys].sort())
    for (const k of keys) expectClose(Reflect.get(actual, k), Reflect.get(expected, k), `${path}.${k}`)
    return
  }
  expect(actual, path).toEqual(expected)
}

const snapshot = (scene: Scene): string => JSON.stringify(scene)

describe("слияние: продолжение у конца", () => {
  it("MW-1: продолжение у конца b — E удлиняется до (900, 0), новая стена не создаётся, id, толщина и материал прежние", () => {
    const scene = sceneOf([E()])
    const after = merged(scene, N(510, 0, 900, 0))
    expect(after.walls).toHaveLength(1)
    const e = wallOf(after, "E")
    expectPoint(e.a, 0, 0)
    expectPoint(e.b, 900, 0)
    expect(e.thicknessCm).toBe(20)
    expect(e.type).toBe("brick")
    expect(after.walls.some((x) => x.id === "N")).toBe(false)
    const xs = wallShape(e, after.walls).map((p) => p.x)
    const ys = wallShape(e, after.walls).map((p) => p.y)
    expect(Math.min(...xs)).toBeCloseTo(0, 6)
    expect(Math.max(...xs)).toBeCloseTo(900, 6)
    expect(Math.min(...ys)).toBeCloseTo(-10, 6)
    expect(Math.max(...ys)).toBeCloseTo(10, 6)
  })

  it("MW-2: продолжение у конца a — E получает ось (−400, 0)…(500, 0), направление a → b прежнее", () => {
    const scene = sceneOf([E()])
    const after = merged(scene, N(-10, 0, -400, 0))
    expect(after.walls).toHaveLength(1)
    const e = wallOf(after, "E")
    expectPoint(e.a, -400, 0)
    expectPoint(e.b, 500, 0)
    expect(e.b.x - e.a.x).toBeGreaterThan(0)
  })

  it("MW-3: начало ровно в конечной точке оси — слияние, E до (800, 0)", () => {
    const after = merged(sceneOf([E()]), N(500, 0, 800, 0))
    expectPoint(wallOf(after, "E").b, 800, 0)
    expect(after.walls).toHaveLength(1)
  })

  it("MW-3b: то же у конца a — начало в (0, 0), конец в (−300, 0)", () => {
    const after = merged(sceneOf([E()]), N(0, 0, -300, 0))
    expectPoint(wallOf(after, "E").a, -300, 0)
    expectPoint(wallOf(after, "E").b, 500, 0)
  })

  it("MW-3c: три продолжения подряд дают одну стену длиной по сумме отрезков", () => {
    let scene = sceneOf([E()])
    scene = merged(scene, N(510, 0, 900, 0))
    scene = merged(scene, N(910, 0, 1300, 0))
    expect(scene.walls).toHaveLength(1)
    expectPoint(wallOf(scene, "E").b, 1300, 0)
  })
})

describe("слияние: допуски", () => {
  it("MW-4: обе вершины в пределах 0.5 см от прямой — E удлиняется до основания перпендикуляра (900, 0)", () => {
    const after = merged(sceneOf([E()]), N(510, 0.3, 900, 0.4))
    const e = wallOf(after, "E")
    expectPoint(e.a, 0, 0)
    expect(Math.abs(e.b.y)).toBeLessThan(1e-9)
    expect(e.b.x).toBeCloseTo(900, 6)
  })

  it("MW-5: отклонение вершины от прямой больше 0.5 см — слияния нет (обе вершины проверяются)", () => {
    const scene = sceneOf([E()])
    expect(mergeContinuation(scene, N(510, 0, 900, 2)).kind).toBe("none")
    expect(mergeContinuation(scene, N(510, 0, 900, 0.51)).kind).toBe("none")
    expect(mergeContinuation(scene, N(510, 0.51, 900, 0)).kind).toBe("none")
    expect(mergeContinuation(scene, N(510, -0.51, 900, 0)).kind).toBe("none")
    expect(mergeContinuation(scene, N(510, 0, 900, -0.51)).kind).toBe("none")
  })

  it("MW-5b: отклонение ровно 0.5 см допустимо с обеих сторон прямой", () => {
    const scene = sceneOf([E()])
    expect(mergeContinuation(scene, N(510, 0.5, 900, 0)).kind).toBe("merged")
    expect(mergeContinuation(scene, N(510, 0, 900, -0.5)).kind).toBe("merged")
  })

  it("MW-4b: у конца a обе вершины в пределах 0.5 см от прямой — E удлиняется до основания перпендикуляра (−400, 0)", () => {
    const after = merged(sceneOf([E()]), N(-10, 0.3, -400, 0.4))
    const e = wallOf(after, "E")
    expectPoint(e.b, 500, 0)
    expect(Math.abs(e.a.y)).toBeLessThan(1e-9)
    expect(e.a.x).toBeCloseTo(-400, 6)
  })

  it("MW-5c: у конца a отклонение от прямой больше 0.5 см — слияния нет, ровно 0.5 см — слияние", () => {
    const scene = sceneOf([E()])
    expect(mergeContinuation(scene, N(-10, 0, -400, 2)).kind).toBe("none")
    expect(mergeContinuation(scene, N(-10, 0, -400, 0.51)).kind).toBe("none")
    expect(mergeContinuation(scene, N(-10, 0, -400, -0.51)).kind).toBe("none")
    expect(mergeContinuation(scene, N(-10, 0.51, -400, 0)).kind).toBe("none")
    expect(mergeContinuation(scene, N(-10, -0.51, -400, 0)).kind).toBe("none")
    expect(mergeContinuation(scene, N(-10, 0.5, -400, 0)).kind).toBe("merged")
    expect(mergeContinuation(scene, N(-10, 0, -400, -0.5)).kind).toBe("merged")
  })
  it("MW-16: наклонная E — вершина проецируется на прямую оси E", () => {
    const base = w(0, 0, 300, 400, "E")
    // направление (0.6, 0.8); начало на 10 см за концом, длина нового отрезка 400, конец смещён на 0.3 см по нормали
    const a = { x: 300 + 6, y: 400 + 8 }
    const b = { x: a.x + 240 + 0.3 * -0.8, y: a.y + 320 + 0.3 * 0.6 }
    const after = merged(sceneOf([base]), { ...N(0, 0, 0, 0), a, b })
    const e = wallOf(after, "E")
    expectPoint(e.b, 546, 728, 6)
    const cross = (e.b.x - e.a.x) * 0.8 - (e.b.y - e.a.y) * 0.6
    expect(Math.abs(cross)).toBeLessThan(1e-9)
  })

  it("MW-16b: наклонная E, продолжение у конца a — вершина a проецируется на прямую оси E", () => {
    const base = w(0, 0, 300, 400, "E")
    const a = { x: -6, y: -8 }
    const b = { x: a.x - 240 - 0.3 * -0.8, y: a.y - 320 - 0.3 * 0.6 }
    const after = merged(sceneOf([base]), { ...N(0, 0, 0, 0), a, b })
    const e = wallOf(after, "E")
    expectPoint(e.a, -246, -328, 6)
    expectPoint(e.b, 300, 400)
    const cross = (e.b.x - e.a.x) * 0.8 - (e.b.y - e.a.y) * 0.6
    expect(Math.abs(cross)).toBeLessThan(1e-9)
  })
  it("MW-24: начало на допуске вершины стыка (10 см) — слияние, дальше 10 см или внутри тела — нет", () => {
    const scene = sceneOf([E()])
    expect(mergeContinuation(scene, N(510, 0, 900, 0)).kind).toBe("merged")
    expect(mergeContinuation(scene, N(510.01, 0, 900, 0)).kind).toBe("none")
    expect(mergeContinuation(scene, N(499.99, 0, 900, 0)).kind).toBe("none")
    expect(mergeContinuation(scene, N(520, 0, 900, 0)).kind).toBe("none")
  })

  it("MW-24b: допуск вершины стыка берётся по большей толщине — при тех же 20 см у конца a тоже 10 см", () => {
    const scene = sceneOf([E()])
    expect(mergeContinuation(scene, N(-10, 0, -400, 0)).kind).toBe("merged")
    expect(mergeContinuation(scene, N(-10.01, 0, -400, 0)).kind).toBe("none")
  })

  it("MW-25: нулевая длина нового отрезка — слияния нет", () => {
    expect(mergeContinuation(sceneOf([E()]), N(510, 0, 510, 0)).kind).toBe("none")
  })
})

describe("слияние: отказы", () => {
  it("MW-6: другая толщина не сливается (точное сравнение)", () => {
    const scene = sceneOf([E()])
    expect(mergeContinuation(scene, N(510, 0, 900, 0, 10)).kind).toBe("none")
    expect(mergeContinuation(scene, N(510, 0, 900, 0, 20.0000001)).kind).toBe("none")
    expect(mergeContinuation(scene, N(510, 0, 900, 0, 19.9999999)).kind).toBe("none")
  })

  it("MW-7: другой материал не сливается", () => {
    const scene = sceneOf([E()])
    expect(mergeContinuation(scene, { ...N(510, 0, 900, 0), type: "concrete" }).kind).toBe("none")
    expect(mergeContinuation(scene, { ...N(510, 0, 900, 0), type: "wood-long" }).kind).toBe("none")
    expect(mergeContinuation(scene, { ...N(510, 0, 900, 0), type: "reinforced" }).kind).toBe("none")
    expect(mergeContinuation(scene, { ...N(510, 0, 900, 0), type: "brick" }).kind).toBe("merged")
  })

  it("MW-8: конец занят стыком — слияния нет", () => {
    const f = w(500, 0, 500, 300, "F")
    expect(mergeContinuation(sceneOf([E(), f]), N(510, 0, 900, 0)).kind).toBe("none")
  })

  it("MW-8b: конец внутри тела другой стены — слияния нет", () => {
    const h = w(505, -100, 505, 100, "H")
    expect(mergeContinuation(sceneOf([E(), h]), N(510, 0, 900, 0)).kind).toBe("none")
  })

  it("MW-8c: конец лежит на оси другой стены (T-примыкание торцом E) — слияния нет", () => {
    const g = w(500, -100, 500, 100, "G")
    expect(mergeContinuation(sceneOf([E(), g]), N(510, 0, 900, 0)).kind).toBe("none")
  })

  it("MW-8d: занят конец a, продолжается свободный конец b — слияние у b", () => {
    const f = w(0, 0, 0, 300, "F")
    const after = merged(sceneOf([E(), f]), N(510, 0, 900, 0))
    expectPoint(wallOf(after, "E").b, 900, 0)
    expectPoint(wallOf(after, "E").a, 0, 0)
  })

  it("MW-8e: занят конец b, продолжается свободный конец a", () => {
    const f = w(500, 0, 500, 300, "F")
    const after = merged(sceneOf([E(), f]), N(-10, 0, -400, 0))
    expectPoint(wallOf(after, "E").a, -400, 0)
    expectPoint(wallOf(after, "E").b, 500, 0)
  })

  it("MW-8f: занят конец a стыком, продолжение у a — слияния нет", () => {
    const f = w(0, 0, 0, 300, "F")
    expect(mergeContinuation(sceneOf([E(), f]), N(-10, 0, -400, 0)).kind).toBe("none")
  })

  it("MW-8g: конец a лежит на оси другой стены (T-примыкание), продолжение у a — слияния нет", () => {
    const g = w(0, -100, 0, 100, "G")
    expect(mergeContinuation(sceneOf([E(), g]), N(-10, 0, -400, 0)).kind).toBe("none")
  })

  it("MW-8h: стена начинается в пределах допуска стыка от конца b (оси не совпадают) — конец занят, слияния нет", () => {
    const f = w(508, 0, 578.7, 70.7, "F", 10)
    expect(mergeContinuation(sceneOf([E(), f]), N(510, 0, 900, 0)).kind).toBe("none")
  })

  it("MW-8i: то же у конца a", () => {
    const f = w(-8, 0, -78.7, 70.7, "F", 10)
    expect(mergeContinuation(sceneOf([E(), f]), N(-10, 0, -400, 0)).kind).toBe("none")
  })

  it("MW-8j: чужой конец в 9.9 см от конца E — стык в допуске, слияния нет; в 11 см — слияние", () => {
    const near = w(509.9, 0, 509.9, 300, "F", 10)
    expect(mergeContinuation(sceneOf([E(), near]), N(510, 0, 900, 0)).kind).toBe("none")
    const far = w(511, 0, 511, 300, "F", 10)
    expect(mergeContinuation(sceneOf([E(), far]), N(510, 0, 900, 0)).kind).toBe("merged")
  })
  it("MW-9: возврат назад на тело E — слияния нет", () => {
    const scene = sceneOf([E()])
    expect(mergeContinuation(scene, N(510, 0, 300, 0)).kind).toBe("none")
    expect(mergeContinuation(scene, N(-10, 0, 300, 0)).kind).toBe("none")
    expect(mergeContinuation(scene, N(490, 0, 300, 0)).kind).toBe("none")
  })

  it("MW-10: угол к оси — слияния нет", () => {
    const scene = sceneOf([E()])
    expect(mergeContinuation(scene, N(510, 0, 510, 300)).kind).toBe("none")
    expect(mergeContinuation(scene, N(510, 0, 510 + 212, 212)).kind).toBe("none")
    expect(mergeContinuation(scene, N(510, 0, 900, 40)).kind).toBe("none")
  })

  it("MW-10b: стена возле конца, но не у него — слияния нет", () => {
    expect(mergeContinuation(sceneOf([E()]), N(700, 0, 900, 0)).kind).toBe("none")
    expect(mergeContinuation(sceneOf([E()]), N(250, 0, 300, 0)).kind).toBe("none")
  })

  it("MW-10c: пустая сцена и сцена без подходящих стен — слияния нет", () => {
    expect(mergeContinuation(sceneOf([]), N(510, 0, 900, 0)).kind).toBe("none")
    expect(mergeContinuation(sceneOf([w(0, 200, 500, 200, "X")]), N(510, 0, 900, 0)).kind).toBe("none")
  })

  it("MW-10d: комната, нарисованная цепочкой, не сливается ни на одном шаге", () => {
    const sides = [w(0, 0, 500, 0, "A"), w(510, 0, 510, 400, "B"), w(500, 410, 0, 410, "C"), w(-10, 400, -10, 0, "D")]
    let scene = sceneOf([])
    sides.forEach((s, i) => {
      if (i > 0) expect(mergeContinuation(scene, s).kind).toBe("none")
      scene = sceneOf([...scene.walls, s])
    })
  })
})

describe("слияние: порядок и мост", () => {
  it("MW-15: удлинённая стена остаётся на своём месте в массиве, прочие стены не меняются", () => {
    const x = w(0, 300, 500, 300, "X")
    const y = w(0, -300, 500, -300, "Y")
    const after = merged(sceneOf([x, E(), y]), N(510, 0, 900, 0))
    expect(after.walls.map((s) => s.id)).toEqual(["X", "E", "Y"])
    expect(after.walls[0]).toEqual(x)
    expect(after.walls[2]).toEqual(y)
  })

  it("MW-15b: при слиянии у a конец b и направление оси остаются прежними", () => {
    const e = w(0, 0, 300, 400, "E")
    const u = { x: 0.6, y: 0.8 }
    const a = { x: -6, y: -8 }
    const after = merged(sceneOf([e]), { ...N(0, 0, 0, 0), a, b: { x: a.x - 240, y: a.y - 320 } })
    const r = wallOf(after, "E")
    expectPoint(r.b, 300, 400)
    expectPoint(r.a, -246, -328, 6)
    expect((r.b.x - r.a.x) * u.x + (r.b.y - r.a.y) * u.y).toBeGreaterThan(0)
  })

  it("MW-14: мост между двумя свободными концами — удлиняется E1, E2 не меняется", () => {
    const e1 = w(0, 0, 300, 0, "E1")
    const e2 = w(700, 0, 1000, 0, "E2")
    const after = merged(sceneOf([e1, e2]), N(310, 0, 700, 0))
    expect(after.walls).toHaveLength(2)
    expectPoint(wallOf(after, "E1").b, 700, 0)
    expect(wallOf(after, "E2")).toEqual(e2)
  })

  it("MW-26: стена выбирается по свободному концу, у которого лежит начало, а не по прочим", () => {
    const e1 = w(0, 0, 300, 0, "E1")
    const e2 = w(0, 200, 300, 200, "E2")
    const after = merged(sceneOf([e1, e2]), N(310, 200, 600, 200))
    expectPoint(wallOf(after, "E2").b, 600, 200)
    expect(wallOf(after, "E1")).toEqual(e1)
  })
})

describe("слияние: проёмы и размеры", () => {
  it("MW-11: на E стоит проём — слияние выполнено, откосы на прежних местах, инвариант проёма сохранён", () => {
    const d = door("E", "a", 100)
    const scene = sceneOf([E()], [d])
    const after = merged(scene, N(510, 0, 900, 0))
    expectSameJambs(scene, after, "d0")
    expect(doorwayHolds(after.doorways?.[0] ?? d, after.walls, after.doorways ?? [])).toBe(true)
  })

  it("MW-12: продолжение нарушает проём другой стены — результат blocked, вход не изменён", () => {
    const v = w(700, -200, 700, 200, "V")
    const d = door("V", "a", 150)
    const scene = sceneOf([E(), v], [d])
    const before = snapshot(scene)
    const r = mergeContinuation(scene, N(510, 0, 690, 0))
    expect(r.kind).toBe("blocked")
    expect(snapshot(scene)).toBe(before)
  })

  it("MW-11b: проверка проёмов идёт по переприкреплённым элементам — дверь у b не «приезжает» на соседнюю стену, слияние допустимо", () => {
    const v = w(750, -200, 750, 200, "V")
    const scene = sceneOf([E(), v], [door("E", "b", 100)])
    const r = mergeContinuation(scene, N(510, 0, 900, 0))
    expect(r.kind).toBe("merged")
    if (r.kind !== "merged") return
    expect(r.scene.doorways?.[0].anchor).toBe("a")
    expect(r.scene.doorways?.[0].offsetCm).toBeCloseTo(310, 6)
  })

  it("MW-12b: то же продолжение вне проёма (проём V выше) — слияние допустимо", () => {
    const v = w(700, -200, 700, 200, "V")
    const d = door("V", "a", 10, 90)
    const scene = sceneOf([E(), v], [d])
    expect(mergeContinuation(scene, N(510, 0, 690, 0)).kind).toBe("merged")
  })

  it("MW-18: элемент у удлиняемого конца b — привязка a, расстояние 310, откосы на x = 310 и 400", () => {
    const d = door("E", "b", 100)
    const scene = sceneOf([E()], [d])
    const after = merged(scene, N(510, 0, 900, 0))
    const el = after.doorways?.[0]
    expect(el?.anchor).toBe("a")
    expect(el?.offsetCm).toBeCloseTo(310, 6)
    expect(el?.widthCm).toBe(90)
    expectSameJambs(scene, after, "d0")
    const e = wallOf(after, "E")
    const [t1, t2] = jambsT(after.doorways?.[0] ?? d, e)
    expect(t1).toBeCloseTo(310, 6)
    expect(t2).toBeCloseTo(400, 6)
  })

  it("MW-19: элемент у конца, оставшегося на месте, не меняется", () => {
    const d = door("E", "a", 100)
    const scene = sceneOf([E()], [d])
    const after = merged(scene, N(510, 0, 900, 0))
    expect(after.doorways?.[0]).toEqual(d)
  })

  it("MW-20: слияние у конца a — элемент с привязкой a получает привязку b и расстояние 310, откосы x = 100 и 190", () => {
    const d = door("E", "a", 100)
    const scene = sceneOf([E()], [d])
    const after = merged(scene, N(-10, 0, -400, 0))
    const el = after.doorways?.[0]
    expect(el?.anchor).toBe("b")
    expect(el?.offsetCm).toBeCloseTo(310, 6)
    expectSameJambs(scene, after, "d0")
  })

  it("MW-20b: слияние у конца a — элемент с привязкой b не меняется", () => {
    const d = door("E", "b", 100)
    const scene = sceneOf([E()], [d])
    const after = merged(scene, N(-10, 0, -400, 0))
    expect(after.doorways?.[0]).toEqual(d)
  })

  it("MW-27: несколько элементов у обоих концов — каждый остаётся на месте; элементы других стен не трогаются", () => {
    const x = w(0, 300, 500, 300, "X")
    const els: WallElement[] = [door("E", "a", 50, 80, 210, "p"), door("E", "b", 40, 60, 210, "q"), win("E", "b", 200, 100, 150, 85, "r"), door("X", "b", 100, 90, 210, "s")]
    const scene = sceneOf([E(), x], els)
    const after = merged(scene, N(510, 0, 900, 0))
    for (const id of ["p", "q", "r", "s"]) expectSameJambs(scene, after, id)
    expect((after.doorways ?? []).find((d) => d.id === "s")).toEqual(els[3])
    expect(after.doorways).toHaveLength(4)
    for (const d of after.doorways ?? []) expect(doorwayHolds(d, after.walls, after.doorways ?? [])).toBe(true)
  })

  it("MW-27b: те же элементы при слиянии у конца a", () => {
    const els: WallElement[] = [door("E", "a", 50, 80, 210, "p"), door("E", "b", 40, 60, 210, "q"), win("E", "a", 200, 100, 150, 85, "r")]
    const scene = sceneOf([E()], els)
    const after = merged(scene, N(-10, 0, -400, 0))
    for (const id of ["p", "q", "r"]) expectSameJambs(scene, after, id)
    for (const d of after.doorways ?? []) expect(doorwayHolds(d, after.walls, after.doorways ?? [])).toBe(true)
  })

  it("MW-21: дверь у удлиняемого конца — петли и сторона открывания сохраняются, полотно на прежнем месте", () => {
    const d = dr("E", "b", 100, "b", "right")
    const scene = sceneOf([E()], [d])
    const after = merged(scene, N(510, 0, 900, 0))
    const el = after.doorways?.[0]
    if (!el || el.kind !== "door") throw new Error("ожидалась дверь")
    expect(el.hinge).toBe("b")
    expect(el.swing).toBe("right")
    expectSameJambs(scene, after, "dr0")
    const leaf0 = doorLeaf(d, scene.walls)
    const leaf1 = doorLeaf(el, after.walls)
    expect(leaf0).not.toBeNull()
    expectClose(leaf1, leaf0)
  })

  it("MW-21b: то же у конца a и со второй парой петель", () => {
    const d = dr("E", "a", 100, "a", "left")
    const scene = sceneOf([E()], [d])
    const after = merged(scene, N(-10, 0, -400, 0))
    const el = after.doorways?.[0]
    if (!el || el.kind !== "door") throw new Error("ожидалась дверь")
    expect(el.hinge).toBe("a")
    expect(el.swing).toBe("left")
    expectClose(doorLeaf(el, after.walls), doorLeaf(d, scene.walls))
  })

  it("MW-22: окно у удлиняемого конца — ширина, высота и подоконник те же, положение то же", () => {
    const wnd = win("E", "b", 100, 120, 150, 85)
    const scene = sceneOf([E()], [wnd])
    const after = merged(scene, N(510, 0, 900, 0))
    const el = after.doorways?.[0]
    if (!el || el.kind !== "window") throw new Error("ожидалось окно")
    expect(el.sillCm).toBe(85)
    expect(el.heightCm).toBe(150)
    expectSameJambs(scene, after, "w0")
  })

  it("MW-23: размер, привязанный к торцу b, после слияния измеряет стену до нового конца", () => {
    const dim: Dimension = { from: { a: { wallId: "E", edge: 0 }, b: { wallId: "E", edge: 3 } }, to: { a: { wallId: "E", edge: 1 }, b: { wallId: "E", edge: 3 } }, offset: 40 }
    const scene = sceneOf([E()], [], [dim])
    const after = merged(scene, N(510, 0, 900, 0))
    expect(after.dimensions).toEqual([dim])
    const p = dimPointPoint(after.dimensions[0].from, after.walls)
    const q = dimPointPoint(after.dimensions[0].to, after.walls)
    expect(p?.x).toBeCloseTo(900, 6)
    expect(q?.x).toBeCloseTo(900, 6)
    expect(Math.abs((p?.y ?? 0) - (q?.y ?? 0))).toBeCloseTo(20, 6)
  })

  it("MW-23b: размеры других стен и размер длины до торца a при слиянии у b не меняются", () => {
    const dim: Dimension = { from: { a: { wallId: "E", edge: 0 }, b: { wallId: "E", edge: 2 } }, to: { a: { wallId: "E", edge: 1 }, b: { wallId: "E", edge: 2 } }, offset: 40 }
    const scene = sceneOf([E()], [], [dim])
    const after = merged(scene, N(510, 0, 900, 0))
    const p = dimPointPoint(after.dimensions[0].from, after.walls)
    expect(p?.x).toBeCloseTo(0, 6)
  })
})

describe("слияние: чистота и история", () => {
  it("MW-17: вход не мутируется ни при none, ни при blocked, ни при merged", () => {
    const v = w(700, -200, 700, 200, "V")
    const cases: Array<[Scene, Wall]> = [
      [sceneOf([E()], [door("E", "b", 100)]), N(510, 0, 900, 0)],
      [sceneOf([E()]), N(510, 0, 900, 40)],
      [sceneOf([E(), v], [door("V", "a", 150)]), N(510, 0, 690, 0)],
    ]
    for (const [scene, wall] of cases) {
      const s0 = snapshot(scene)
      const w0 = JSON.stringify(wall)
      mergeContinuation(scene, wall)
      expect(snapshot(scene)).toBe(s0)
      expect(JSON.stringify(wall)).toBe(w0)
    }
  })

  it("MW-17b: после merged стена в результате — не тот же объект, что во входе", () => {
    const scene = sceneOf([E()])
    const after = merged(scene, N(510, 0, 900, 0))
    expect(after.walls[0]).not.toBe(scene.walls[0])
    expectPoint(scene.walls[0].b, 500, 0)
  })

  it("MW-13: слияние — одна запись истории: «Отменить» возвращает прежнюю E и элементы, «Повторить» — удлинённую", () => {
    const d = door("E", "b", 100)
    const scene = sceneOf([E()], [d])
    const history = drawingHistory(emptyHistory(), "x")
    record(history, scene)
    const after = merged(scene, N(510, 0, 900, 0))
    expect(history.past).toHaveLength(1)
    const entry = undoEntry(history, after)
    expect(entry?.kind).toBe("walls")
    if (entry?.kind !== "walls") throw new Error("ожидалась запись walls")
    expect(entry.walls).toEqual(scene.walls)
    expect(entry.doorways).toEqual(scene.doorways)
    expect(history.past).toHaveLength(0)
    expect(history.future).toHaveLength(1)
    const redo = history.future[0]
    if (redo.kind !== "walls") throw new Error("ожидалась запись walls")
    expectPoint(redo.walls[0].b, 900, 0)
    expect(redo.doorways?.[0].anchor).toBe("a")
  })

  it("MW-28: слияние в сцене без списка проёмов (старый документ) работает", () => {
    const scene: Scene = { walls: [E()], dimensions: [] }
    const r = mergeContinuation(scene, N(510, 0, 900, 0))
    expect(r.kind).toBe("merged")
    if (r.kind === "merged") expectPoint(r.scene.walls[0].b, 900, 0)
  })
})



// раунд 3 валидации: симметрия по концам, видам элементов, наклону и толщине
function expectSameElement(before: Scene, after: Scene, id: string): void {
  const el0 = (before.doorways ?? []).find((d) => d.id === id)
  const el1 = (after.doorways ?? []).find((d) => d.id === id)
  if (!el0 || !el1) throw new Error(`нет элемента ${id}`)
  const key = (p: Point): number => p.x * 1e6 + p.y
  const s0 = [...jambsWorld(el0, wallOf(before, el0.wallId))].sort((p, q) => key(p) - key(q))
  const s1 = [...jambsWorld(el1, wallOf(after, el1.wallId))].sort((p, q) => key(p) - key(q))
  expectPoint(s1[0], s0[0].x, s0[0].y)
  expectPoint(s1[1], s0[1].x, s0[1].y)
  const { anchor: _a0, offsetCm: _o0, ...rest0 } = el0
  const { anchor: _a1, offsetCm: _o1, ...rest1 } = el1
  expect(rest1).toEqual(rest0)
}

describe("слияние: симметрия и разные толщины", () => {
  it("MW-29: элементы у оставшегося на месте конца не меняются (окно, дверь с обоими открываниями и петлями)", () => {
    const stayAtA: WallElement[] = [win("E", "a", 100, 120, 150, 85, "w"), dr("E", "a", 300, "a", "right", 90, 210, "dl"), dr("E", "a", 200, "b", "left", 90, 210, "dr")]
    expect(merged(sceneOf([E()], stayAtA), N(510, 0, 900, 0)).doorways).toEqual(stayAtA)
    const stayAtB: WallElement[] = [win("E", "b", 100, 120, 150, 85, "w"), dr("E", "b", 300, "a", "right", 90, 210, "dl"), dr("E", "b", 200, "b", "left", 90, 210, "dr")]
    expect(merged(sceneOf([E()], stayAtB), N(-10, 0, -400, 0)).doorways).toEqual(stayAtB)
  })
  
  it("MW-29b: переприкреплённые элементы сохраняют все поля, кроме привязки и расстояния (оба конца, все виды)", () => {
    const at = (anchor: "a" | "b"): WallElement[] => [
      win("E", anchor, 100, 120, 150, 85, "w"),
      dr("E", anchor, 250, "a", "right", 90, 210, "d1"),
      dr("E", anchor, 350, "b", "left", 90, 210, "d2"),
      door("E", anchor, 20, 70, 200, "p"),
    ]
    const sB = sceneOf([E()], at("b"))
    const aB = merged(sB, N(510, 0, 900, 0))
    for (const id of ["w", "d1", "d2", "p"]) expectSameElement(sB, aB, id)
    const sA = sceneOf([E()], at("a"))
    const aA = merged(sA, N(-10, 0, -400, 0))
    for (const id of ["w", "d1", "d2", "p"]) expectSameElement(sA, aA, id)
  })
  
  it("MW-30: элементы остаются на месте на наклонной, горизонтальной «справа налево» и вертикальной стенах, у обоих концов и при обеих привязках", () => {
    const tail = (a: Point, b: Point): Wall => ({ ...N(0, 0, 0, 0), a, b })
    const cases: Array<[Wall, Wall, Wall]> = [
      // E, продолжение у конца b, продолжение у конца a
      [w(0, 0, 300, 400, "E"), tail({ x: 306, y: 408 }, { x: 546, y: 728 }), tail({ x: -6, y: -8 }, { x: -246, y: -328 })],
      [w(500, 0, 0, 0, "E"), N(-10, 0, -400, 0), N(510, 0, 900, 0)],
      [w(0, 500, 0, 0, "E"), N(0, -10, 0, -400), N(0, 510, 0, 900)],
      [w(300, 400, 0, 0, "E"), tail({ x: -6, y: -8 }, { x: -246, y: -328 }), tail({ x: 306, y: 408 }, { x: 546, y: 728 })],
    ]
    for (const [e, atB, atA] of cases) {
      const els = (anchor: "a" | "b"): WallElement[] => [win("E", anchor, 100, 120, 150, 85, "w"), dr("E", anchor, 250, "a", "right", 90, 210, "d1"), door("E", anchor, 20, 70, 200, "p")]
      for (const [n, anchor, end] of [[atB, "b", "b"], [atA, "a", "a"], [atB, "a", "b"], [atA, "b", "a"]] as const) {
        const scene = sceneOf([e], els(anchor))
        const after = merged(scene, n)
        for (const id of ["w", "d1", "p"]) expectSameElement(scene, after, id)
        const r = wallOf(after, "E")
        const keep = end === "b" ? "a" : "b"
        expect(r[keep]).toEqual(e[keep])
        expect((e.b.x - e.a.x) * (r.b.x - r.a.x) + (e.b.y - e.a.y) * (r.b.y - r.a.y)).toBeGreaterThan(0)
      }
    }
  })
  
  it("MW-31: размеры не переписываются; торец a следует за удлинённым концом a, размер между E и другой стеной сохраняется", () => {
    const x = w(0, 300, 500, 300, "X")
    const dimA: Dimension = { from: { a: { wallId: "E", edge: 0 }, b: { wallId: "E", edge: 2 } }, to: { a: { wallId: "E", edge: 1 }, b: { wallId: "E", edge: 2 } }, offset: 40 }
    const dimMix: Dimension = { from: { a: { wallId: "E", edge: 0 }, b: { wallId: "E", edge: 3 } }, to: { a: { wallId: "X", edge: 0 }, b: { wallId: "X", edge: 3 } }, offset: 40 }
    const dimX: Dimension = { from: { a: { wallId: "X", edge: 0 }, b: { wallId: "X", edge: 2 } }, to: { a: { wallId: "X", edge: 1 }, b: { wallId: "X", edge: 2 } }, offset: 40 }
    const scene = sceneOf([E(), x], [], [dimA, dimMix, dimX])
    const atA = merged(scene, N(-10, 0, -400, 0))
    expect(atA.dimensions).toEqual([dimA, dimMix, dimX])
    expect(dimPointPoint(atA.dimensions[0].from, atA.walls)?.x).toBeCloseTo(-400, 6)
    expect(dimPointPoint(atA.dimensions[0].to, atA.walls)?.x).toBeCloseTo(-400, 6)
    const atB = merged(scene, N(510, 0, 900, 0))
    expect(atB.dimensions).toEqual([dimA, dimMix, dimX])
    expect(dimPointPoint(atB.dimensions[0].from, atB.walls)?.x).toBeCloseTo(0, 6)
  })
  
  it("MW-32: продолжение нарушает проём другой стены — blocked у обоих концов для проёма, окна и двери", () => {
    for (const el of [door("V", "a", 150), win("V", "a", 150, 90, 150, 85, "w"), dr("V", "a", 150, "a", "left", 90, 210, "d")]) {
      const vLeft = w(-700, -200, -700, 200, "V")
      expect(mergeContinuation(sceneOf([E(), vLeft], [el]), N(-10, 0, -690, 0)).kind).toBe("blocked")
      const vRight = w(700, -200, 700, 200, "V")
      expect(mergeContinuation(sceneOf([E(), vRight], [el]), N(510, 0, 690, 0)).kind).toBe("blocked")
    }
  })
  
  it("MW-33: конец a внутри тела другой стены (не на оси, не на грани) — слияния нет; то же у конца b", () => {
    expect(mergeContinuation(sceneOf([E(), w(-5, -100, -5, 100, "H")]), N(-10, 0, -400, 0)).kind).toBe("none")
    expect(mergeContinuation(sceneOf([E(), w(505, -100, 505, 100, "H")]), N(510, 0, 900, 0)).kind).toBe("none")
  })
  
  it("MW-34: допуск начала = половина толщины, допуск прямой 0.5 см — для толщин 10 и 40, у обоих концов и с обеих сторон", () => {
    for (const th of [10, 40]) {
      const tol = th / 2
      const sc = sceneOf([w(0, 0, 500, 0, "E", th)])
      const n = (ax: number, ay: number, bx: number, by: number): Wall => w(ax, ay, bx, by, "N", th)
      expect(mergeContinuation(sc, n(500 + tol, 0, 900, 0)).kind).toBe("merged")
      expect(mergeContinuation(sc, n(500 + tol + 0.01, 0, 900, 0)).kind).toBe("none")
      expect(mergeContinuation(sc, n(499.99, 0, 900, 0)).kind).toBe("none")
      expect(mergeContinuation(sc, n(-tol, 0, -400, 0)).kind).toBe("merged")
      expect(mergeContinuation(sc, n(-tol - 0.01, 0, -400, 0)).kind).toBe("none")
      expect(mergeContinuation(sc, n(0.01, 0, -400, 0)).kind).toBe("none")
      for (const sg of [1, -1]) {
        expect(mergeContinuation(sc, n(500 + tol, 0.5 * sg, 900, 0)).kind).toBe("merged")
        expect(mergeContinuation(sc, n(500 + tol, 0, 900, 0.5 * sg)).kind).toBe("merged")
        expect(mergeContinuation(sc, n(500 + tol, 0.51 * sg, 900, 0)).kind).toBe("none")
        expect(mergeContinuation(sc, n(500 + tol, 0, 900, 0.51 * sg)).kind).toBe("none")
        expect(mergeContinuation(sc, n(-tol, 0.5 * sg, -400, 0)).kind).toBe("merged")
        expect(mergeContinuation(sc, n(-tol, 0, -400, 0.5 * sg)).kind).toBe("merged")
        expect(mergeContinuation(sc, n(-tol, 0.51 * sg, -400, 0)).kind).toBe("none")
        expect(mergeContinuation(sc, n(-tol, 0, -400, 0.51 * sg)).kind).toBe("none")
      }
    }
  })
  
  it("MW-35: наклонная E — допуск вдоль оси и отклонение от прямой с обеих сторон у обоих концов", () => {
    const sc = sceneOf([w(0, 0, 300, 400, "E")])
    const u = { x: 0.6, y: 0.8 }
    const nrm = { x: -0.8, y: 0.6 }
    const at = (base: Point, s: number, l: number): Point => ({ x: base.x + u.x * s + nrm.x * l, y: base.y + u.y * s + nrm.y * l })
    const mk = (a: Point, b: Point): Wall => ({ ...N(0, 0, 0, 0), a, b })
    const A = { x: 0, y: 0 }
    const B = { x: 300, y: 400 }
    expect(mergeContinuation(sc, mk(at(B, 10, 0), at(B, 300, 0))).kind).toBe("merged")
    expect(mergeContinuation(sc, mk(at(B, 10.02, 0), at(B, 300, 0))).kind).toBe("none")
    expect(mergeContinuation(sc, mk(at(B, -0.02, 0), at(B, 300, 0))).kind).toBe("none")
    expect(mergeContinuation(sc, mk(at(A, -10, 0), at(A, -300, 0))).kind).toBe("merged")
    expect(mergeContinuation(sc, mk(at(A, -10.02, 0), at(A, -300, 0))).kind).toBe("none")
    expect(mergeContinuation(sc, mk(at(A, 0.02, 0), at(A, -300, 0))).kind).toBe("none")
    for (const sg of [1, -1]) {
      expect(mergeContinuation(sc, mk(at(B, 9.9, 0.49 * sg), at(B, 300, 0))).kind).toBe("merged")
      expect(mergeContinuation(sc, mk(at(B, 9.9, 0), at(B, 300, 0.49 * sg))).kind).toBe("merged")
      expect(mergeContinuation(sc, mk(at(B, 9.9, 0.51 * sg), at(B, 300, 0))).kind).toBe("none")
      expect(mergeContinuation(sc, mk(at(B, 9.9, 0), at(B, 300, 0.51 * sg))).kind).toBe("none")
      expect(mergeContinuation(sc, mk(at(A, -9.9, 0.49 * sg), at(A, -300, 0))).kind).toBe("merged")
      expect(mergeContinuation(sc, mk(at(A, -9.9, 0), at(A, -300, 0.49 * sg))).kind).toBe("merged")
      expect(mergeContinuation(sc, mk(at(A, -9.9, 0.51 * sg), at(A, -300, 0))).kind).toBe("none")
      expect(mergeContinuation(sc, mk(at(A, -9.9, 0), at(A, -300, 0.51 * sg))).kind).toBe("none")
    }
    expect(mergeContinuation(sc, mk(at(B, 10, 0), at(B, -200, 0))).kind).toBe("none")
    expect(mergeContinuation(sc, mk(at(A, -10, 0), at(A, 200, 0))).kind).toBe("none")
  })

  it("MW-36: удлинённая стена врезается в проём наклонной стены, хотя отдельная стена не врезалась бы — blocked", () => {
    const c = Math.cos((75 * Math.PI) / 180)
    const s = Math.sin((75 * Math.PI) / 180)
    const f = w(-60 - c * 200, -s * 200, -60 + c * 200, s * 200, "F", 10)
    const el = door("F", "a", 130, 60)
    const scene: Scene = { walls: [w(0, 0, 500, 0, "E"), f], dimensions: [], doorways: [el] }
    expect(doorwayHolds(el, scene.walls, scene.doorways ?? [])).toBe(true)
    for (const tipX of [-67, -65, -60, -58]) {
      const before = snapshot(scene)
      expect(mergeContinuation(scene, w(-10, 0, tipX, 0, "N")).kind, `tipX=${tipX}`).toBe("blocked")
      expect(snapshot(scene)).toBe(before)
    }
  })

  it("MW-37: проверка проёмов покрывает и элементы самой удлиняемой стены — blocked, если удлинённая E упирается в её проём", () => {
    const f = w(515, 10, 645, 85, "F", 30)
    const scene = sceneOf([E(), f], [door("E", "b", 5, 90)])
    expect(doorwayHolds(scene.doorways?.[0] ?? door("E", "b", 5, 90), scene.walls, scene.doorways ?? [])).toBe(true)
    const before = snapshot(scene)
    expect(mergeContinuation(scene, w(501, 0, 602, 0, "N")).kind).toBe("blocked")
    expect(snapshot(scene)).toBe(before)
    expect(mergeContinuation(sceneOf([E(), f], [door("E", "b", 100, 90)]), w(501, 0, 602, 0, "N")).kind).toBe("merged")
    const fA = w(-15, 10, -145, 85, "F", 30)
    expect(mergeContinuation(sceneOf([E(), fA], [door("E", "a", 5, 90)]), w(-1, 0, -102, 0, "N")).kind).toBe("blocked")
    expect(mergeContinuation(sceneOf([E(), fA], [door("E", "a", 100, 90)]), w(-1, 0, -102, 0, "N")).kind).toBe("merged")
  })

  it("MW-38: элементы на расстоянии привязки 0 у удлиняемого конца переприкрепляются (расстояние 410), у конца на месте не меняются", () => {
    const at = (anchor: "a" | "b"): WallElement[] => [
      door("E", anchor, 0, 90, 210, "p"),
      win("E", anchor, 0, 100, 150, 85, "q"),
      dr("E", anchor, 0, "a", "right", 90, 210, "r"),
    ]
    const sB = sceneOf([E()], at("b"))
    const aB = merged(sB, N(510, 0, 900, 0))
    for (const el of aB.doorways ?? []) {
      expect(el.anchor).toBe("a")
      expect(el.offsetCm).toBeCloseTo(el.widthCm === 100 ? 400 : 410, 6)
    }
    for (const id of ["p", "q", "r"]) expectSameElement(sB, aB, id)
    const sA = sceneOf([E()], at("a"))
    const aA = merged(sA, N(-10, 0, -400, 0))
    for (const el of aA.doorways ?? []) {
      expect(el.anchor).toBe("b")
      expect(el.offsetCm).toBeCloseTo(el.widthCm === 100 ? 400 : 410, 6)
    }
    for (const id of ["p", "q", "r"]) expectSameElement(sA, aA, id)
    expect(merged(sceneOf([E()], at("a")), N(510, 0, 900, 0)).doorways).toEqual(at("a"))
    expect(merged(sceneOf([E()], at("b")), N(-10, 0, -400, 0)).doorways).toEqual(at("b"))
  })

  it("MW-8k: конец занят стеной другого материала (стык, тройник, конец a) — слияния нет", () => {
    expect(mergeContinuation(sceneOf([E(), { ...w(500, 0, 500, 300, "F"), type: "concrete" }]), N(510, 0, 900, 0)).kind).toBe("none")
    expect(mergeContinuation(sceneOf([E(), { ...w(500, -100, 500, 100, "G"), type: "concrete" }]), N(510, 0, 900, 0)).kind).toBe("none")
    expect(mergeContinuation(sceneOf([E(), { ...w(0, 0, 0, 300, "F"), type: "concrete" }]), N(-10, 0, -400, 0)).kind).toBe("none")
  })})

