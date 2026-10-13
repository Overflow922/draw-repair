import { describe, expect, it } from "vitest"
import { erasePick, pressPick } from "./doorway/doorway-scene"
import { dimGeometry, dimLevelSnap, nearestDimAnchor } from "./geometry"
import type { Dimension, DimPoint } from "./types"
import { door, expectAt, jambDimension, jambPoint, sceneF, sceneF2, w, win } from "./dimension-anchor.test-utils"

// change add-opening-dimension-anchors: размер с откосами выбирается, стирается, привязывает уровень нового размера;
// снап выбирает ближайший из нескольких откосов (spec dimension-tool «Инструмент «Размер»» — привязка третьего
// клика к уровню соседа, «Отметка точки замера»; wall-deletion «Инструмент «Ластик»»; design D5, D8).

const kindOf = (a: DimPoint): unknown => (a as { kind?: unknown }).kind

// размер между откосами e1.b и e2.a: размерная линия на y = 10 + 30 = 40 между x = 220 и x = 300
const gap = (): Dimension => jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", 1), 30)

describe("ластик и нажатие по размеру с откосами", () => {
  it("DA-45: erasePick на размерной линии даёт размер, а не элемент и не стену", () => {
    const { walls, elements } = sceneF2()
    const dimension = gap()
    const pick = erasePick({ x: 260, y: 40 }, { walls, dimensions: [dimension], doorways: elements }, 3, 1)
    expect(pick).toEqual({ kind: "dimension", dimension })
  })

  it("DA-45b: erasePick на теле окна без размера рядом даёт элемент", () => {
    const { walls, e1, elements } = sceneF2()
    const pick = erasePick({ x: 160, y: 0 }, { walls, dimensions: [gap()], doorways: elements }, 3, 1)
    expect(pick).toEqual({ kind: "doorway", doorway: e1 })
  })

  it("DA-45c: erasePick мимо размера в 10 см — размер не выбирается", () => {
    const { walls, elements } = sceneF2()
    const pick = erasePick({ x: 260, y: 55 }, { walls, dimensions: [gap()], doorways: elements }, 3, 1)
    expect(pick).toBeNull()
  })

  it("DA-46: pressPick с включёнными размерами на размерной линии даёт размер", () => {
    const { walls, elements } = sceneF2()
    const dimension = gap()
    const pick = pressPick({ x: 260, y: 40 }, { walls, dimensions: [dimension], doorways: elements }, 3, 1, {
      selectedWall: null,
      middleMarker: false,
      dimensions: true,
      elements: true,
    })
    expect(pick).toEqual({ kind: "dimension", dimension })
  })

  it("DA-46b: pressPick при выключенных размерах размер не выбирает", () => {
    const { walls, elements } = sceneF2()
    const pick = pressPick({ x: 260, y: 40 }, { walls, dimensions: [gap()], doorways: elements }, 3, 1, {
      selectedWall: null,
      middleMarker: false,
      dimensions: false,
      elements: true,
    })
    expect(pick).toBeNull()
  })
})

describe("привязка третьего клика к уровню размера с откосами", () => {
  const walls = () => sceneF2().walls
  const elements = () => sceneF2().elements
  // новая горизонтальная ось: нормаль (0, 1), уровень смещения = y − 10
  const axis = () => dimGeometry({ x: 100, y: 10 }, { x: 180, y: 10 }, 0)

  it("DA-47: курсор в 2 см от уровня соседа с откосами — уровень соседа (смещение 30, точка на линии)", () => {
    const a = axis()
    expect(a).not.toBeNull()
    if (!a) return
    const snap = dimLevelSnap({ x: 140, y: 42 }, a, [gap()], walls(), 3, elements())
    expect(snap?.offset).toBeCloseTo(30, 6)
    expectAt(snap?.point ?? null, 140, 40)
  })

  it("DA-47b: вне радиуса привязки уровень не предлагается", () => {
    const a = axis()
    if (!a) throw new Error("предусловие: ось")
    expect(dimLevelSnap({ x: 140, y: 45 }, a, [gap()], walls(), 3, elements())).toBeNull()
  })

  it("DA-47c: размер с откосами, непараллельный новой оси, уровня не даёт", () => {
    const vertical = dimGeometry({ x: 100, y: 10 }, { x: 100, y: 90 }, 0)
    if (!vertical) throw new Error("предусловие: ось")
    // нормаль вертикальной оси (−1, 0): смещение = 100 − x. Курсор (220, 50) стоит ровно на уровне линии соседа
    // (его линия проходит через (220, 40): смещение −120), поэтому без проверки параллельности привязка сработала бы
    const snap = dimLevelSnap({ x: 220, y: 50 }, vertical, [gap()], walls(), 3, elements())
    expect(snap).toBeNull()
  })

  it("DA-47f: ровно на радиусе от уровня соседа привязка есть, дальше на 0.01 — нет", () => {
    const a = axis()
    if (!a) throw new Error("предусловие: ось")
    expect(dimLevelSnap({ x: 140, y: 43 }, a, [gap()], walls(), 3, elements())?.offset).toBeCloseTo(30, 6)
    expect(dimLevelSnap({ x: 140, y: 43.01 }, a, [gap()], walls(), 3, elements())).toBeNull()
  })

  it("DA-47d: элементы не переданы — сосед с откосами не разрешается, уровня нет", () => {
    const a = axis()
    if (!a) throw new Error("предусловие: ось")
    expect(dimLevelSnap({ x: 140, y: 42 }, a, [gap()], walls(), 3)).toBeNull()
  })

  it("DA-47e: из двух соседей выбирается ближайший по уровню", () => {
    const a = axis()
    if (!a) throw new Error("предусловие: ось")
    const far = jambDimension(jambPoint("e1", "a", 1), jambPoint("e2", "b", 1), 31.5)
    const snap = dimLevelSnap({ x: 140, y: 41.4 }, a, [gap(), far], walls(), 3, elements())
    expect(snap?.offset).toBeCloseTo(31.5, 6)
  })
})

describe("несколько кандидатов в радиусе", () => {
  // e1: откосы 100 и 104; e2: откосы 105 и 109 (оба на грани +1), радиус 5
  const narrow = () => {
    const e1 = win("W", "a", 100, 4, 150, 85, "e1")
    const e2 = win("W", "a", 105, 4, 150, 85, "e2")
    return { walls: sceneF().walls, e1, e2 }
  }

  it("DA-48: курсор между откосами соседних окон — ближайший, независимо от порядка элементов", () => {
    const { walls, e1, e2 } = narrow()
    for (const elements of [[e1, e2], [e2, e1]]) {
      const hit = nearestDimAnchor({ x: 104.6, y: 10 }, walls, elements, 5)
      expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "e2", jamb: "a", face: 1 })
      expectAt(hit?.point ?? null, 105, 10)
    }
  })

  it("DA-48b: два откоса одного окна в 4 см — каждый у своего курсора", () => {
    const { walls, e1 } = narrow()
    const nearA = nearestDimAnchor({ x: 101, y: 10 }, walls, [e1], 5)
    const nearB = nearestDimAnchor({ x: 103, y: 10 }, walls, [e1], 5)
    expect(nearA?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "a", face: 1 })
    expect(nearB?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "b", face: 1 })
  })

  it("DA-48c: ближайший из откосов разных граней одного элемента — по расстоянию, а не по грани", () => {
    const { walls, e1 } = narrow()
    const hit = nearestDimAnchor({ x: 100.4, y: -9 }, walls, [e1], 5)
    expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "a", face: -1 })
  })
})

describe("допуск равенства и вырожденные случаи", () => {
  it("DA-49: откос смещён от вершины на 1e-12 — это равенство, побеждает вершина", () => {
    const { walls } = sceneF()
    // откос a на грани +1 в (1e-12, 10); вершина (0, 10); курсор (5, 10): расстояния различаются на 1e-12 < 1e-9
    const e = [win("W", "a", 1e-12, 90, 150, 85, "e1")]
    const hit = nearestDimAnchor({ x: 5, y: 10 }, walls, e, 10)
    expect(hit).not.toBeNull()
    expect(kindOf(hit?.anchor as DimPoint)).not.toBe("jamb")
    expectAt(hit?.point ?? null, 0, 10)
  })

  it("DA-49b: откос ближе вершины на заметную величину (0.02 см) — побеждает откос", () => {
    const { walls } = sceneF()
    const e = [win("W", "a", 0.02, 90, 150, 85, "e1")]
    const hit = nearestDimAnchor({ x: 0.05, y: 10 }, walls, e, 10)
    expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "a", face: 1 })
  })

  it("DA-49c: откос ближе вершины на 1e-7 — это уже не равенство, побеждает откос (допуск именно 1e-9)", () => {
    const { walls } = sceneF()
    const e = [win("W", "a", 1e-7, 90, 150, 85, "e1")]
    const hit = nearestDimAnchor({ x: 5, y: 10 }, walls, e, 10)
    expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "a", face: 1 })
  })

  it("DA-50: вырожденная стена с элементом — снап ничего не предлагает", () => {
    const degenerate = [w(0, 0, 0, 0, "W")]
    const e = [door("W", "a", 0, 90, 210, "d1")]
    expect(nearestDimAnchor({ x: 0, y: 0 }, degenerate, e, 5)).toBeNull()
    expect(nearestDimAnchor({ x: 0, y: 10 }, degenerate, e, 15)).toBeNull()
  })
})
