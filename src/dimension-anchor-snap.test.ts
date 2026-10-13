import { describe, expect, it } from "vitest"
import { nearestDimAnchor, nearestEdgeIntersection } from "./geometry"
import type { DimPoint } from "./types"
import { expectAt, sceneF, sceneF2, sceneR, win, door } from "./dimension-anchor.test-utils"

// change add-opening-dimension-anchors: снап точки замера к откосам и вершинам контура
// (spec dimension-tool «Инструмент «Размер»» — точка замера, отметка, резинка; «Точки замера на откосах элементов
// стены»; design D5, D8). Результат nearestDimAnchor — {point, anchor}: point — место отметки снапа и клика.

const kindOf = (a: DimPoint): unknown => (a as { kind?: unknown }).kind

describe("снап к откосам", () => {
  it("DA-4: к каждому из четырёх откосных углов окна снап даёт именно этот откос и грань", () => {
    const { walls, elements } = sceneF2()
    const corners: [number, number, "a" | "b", 1 | -1][] = [
      [100, 10, "a", 1],
      [100, -10, "a", -1],
      [220, 10, "b", 1],
      [220, -10, "b", -1],
    ]
    for (const [x, y, jamb, face] of corners) {
      const hit = nearestDimAnchor({ x: x + 1, y: y + (face === 1 ? 1 : -1) }, walls, elements, 3)
      expect(hit, `угол (${x}, ${y})`).not.toBeNull()
      expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb, face })
      expectAt(hit?.point ?? null, x, y)
    }
  })

  it("DA-4b: второе окно различается по идентификатору элемента", () => {
    const { walls, elements } = sceneF2()
    const hit = nearestDimAnchor({ x: 301, y: 11 }, walls, elements, 3)
    expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "e2", jamb: "a", face: 1 })
    expectAt(hit?.point ?? null, 300, 10)
  })

  it("DA-4c: откос двери с привязкой b — откос a у меньшей координаты", () => {
    const { walls } = sceneF()
    const d = door("W", "b", 100, 90, 210, "d1")
    const hit = nearestDimAnchor({ x: 311, y: -11 }, walls, [d], 3)
    expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "d1", jamb: "a", face: -1 })
    expectAt(hit?.point ?? null, 310, -10)
  })

  it("DA-7c: у откоса на грани +1 соседняя грань −1 того же откоса не выбирается", () => {
    const { walls, elements } = sceneF2()
    const hit = nearestDimAnchor({ x: 220, y: 10 }, walls, elements, 3)
    expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "b", face: 1 })
  })
})

describe("откос и вершина контура", () => {
  it("DA-5: откос вплотную к углу совпадает с вершиной — побеждает вершина контура", () => {
    const walls = sceneR().walls
    // проём привязка a, 10, ширина 90 на W: откос a на грани +1 в (10, 10) — внутренний угол с L
    const e = [door("W", "a", 10, 90, 210, "d0")]
    const hit = nearestDimAnchor({ x: 10, y: 10 }, walls, e, 3)
    expect(hit).not.toBeNull()
    expect(kindOf(hit?.anchor as DimPoint)).not.toBe("jamb")
    expect(hit?.anchor).toHaveProperty("a")
    expect(hit?.anchor).toHaveProperty("b")
    expectAt(hit?.point ?? null, 10, 10)
  })

  it("DA-5b: курсор рядом с совпавшими точками — по-прежнему вершина, точка отметки та же", () => {
    const walls = sceneR().walls
    const e = [door("W", "a", 10, 90, 210, "d0")]
    for (const cursor of [{ x: 12, y: 10 }, { x: 10, y: 12 }, { x: 11, y: 11 }]) {
      const hit = nearestDimAnchor(cursor, walls, e, 3)
      expect(kindOf(hit?.anchor as DimPoint)).not.toBe("jamb")
      expectAt(hit?.point ?? null, 10, 10)
    }
  })

  it("DA-5c: окно на всю длину стены — у торцов побеждают вершины, а не откосы", () => {
    const { walls } = sceneF()
    const whole = [win("W", "a", 0, 500, 150, 85, "e1")]
    const atA = nearestDimAnchor({ x: 1, y: 11 }, walls, whole, 3)
    const atB = nearestDimAnchor({ x: 499, y: -11 }, walls, whole, 3)
    expect(kindOf(atA?.anchor as DimPoint)).not.toBe("jamb")
    expect(kindOf(atB?.anchor as DimPoint)).not.toBe("jamb")
    expectAt(atA?.point ?? null, 0, 10)
    expectAt(atB?.point ?? null, 500, -10)
  })

  it("DA-5d: свободная стена, откос в 10 см от торца — вершины рядом нет, побеждает откос на обеих гранях", () => {
    const { walls } = sceneF()
    // торцевые вершины (0, ±10) лежат в 10 см от откоса (10, ±10) — вне радиуса 3
    const e = [door("W", "a", 10, 90, 210, "d0")]
    for (const face of [1, -1] as const) {
      const hit = nearestDimAnchor({ x: 10, y: face * 10 }, walls, e, 3)
      expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "d0", jamb: "a", face })
      expectAt(hit?.point ?? null, 10, face * 10)
    }
  })

  it("DA-6: откос ближе вершины — побеждает откос", () => {
    const { walls } = sceneF()
    // откос a на грани +1 в (3, 10); вершина (0, 10) в 3 см от него
    const e = [win("W", "a", 3, 90, 150, 85, "e1")]
    const hit = nearestDimAnchor({ x: 2.5, y: 10 }, walls, e, 5)
    expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "a", face: 1 })
    expectAt(hit?.point ?? null, 3, 10)
  })

  it("DA-19: между вершиной и откосом выбирается ближайший к курсору", () => {
    const { walls } = sceneF()
    const e = [win("W", "a", 20, 90, 150, 85, "e1")]
    // вершина (0, 10), откос (20, 10), радиус 15
    const nearVertex = nearestDimAnchor({ x: 8, y: 10 }, walls, e, 15)
    expect(kindOf(nearVertex?.anchor as DimPoint)).not.toBe("jamb")
    expectAt(nearVertex?.point ?? null, 0, 10)
    const nearJamb = nearestDimAnchor({ x: 14, y: 10 }, walls, e, 15)
    expect(nearJamb?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "a", face: 1 })
    expectAt(nearJamb?.point ?? null, 20, 10)
  })

  it("DA-19b: вершина без элементов находится как прежде и совпадает с nearestEdgeIntersection", () => {
    const walls = sceneR().walls
    const old = nearestEdgeIntersection({ x: 12, y: 11 }, walls, 4)
    const hit = nearestDimAnchor({ x: 12, y: 11 }, walls, [], 4)
    expect(old).not.toBeNull()
    expect(hit?.anchor).toMatchObject({ a: old?.a, b: old?.b })
    expect(kindOf(hit?.anchor as DimPoint)).not.toBe("jamb")
    expect(hit?.point).toEqual(old?.point)
  })
})

describe("радиус и промахи", () => {
  it("DA-7b: ровно на радиусе от откоса точка находится, дальше на 0.01 — нет", () => {
    const { walls, elements } = sceneF2()
    expect(nearestDimAnchor({ x: 220, y: 13 }, walls, elements, 3)?.anchor).toEqual({
      kind: "jamb",
      elementId: "e1",
      jamb: "b",
      face: 1,
    })
    expect(nearestDimAnchor({ x: 220, y: 13.01 }, walls, elements, 3)).toBeNull()
  })

  it("DA-7: клик на грани вне радиуса от откосов и вершин не задаёт точку", () => {
    const { walls, elements } = sceneF2()
    expect(nearestDimAnchor({ x: 160, y: 10 }, walls, elements, 3)).toBeNull()
    expect(nearestDimAnchor({ x: 260, y: -10 }, walls, elements, 3)).toBeNull()
  })

  it("DA-8: середина грани, ось и продолжение грани за торцом — точки нет", () => {
    const { walls, elements } = sceneF2()
    expect(nearestDimAnchor({ x: 160, y: 0 }, walls, elements, 3)).toBeNull()
    expect(nearestDimAnchor({ x: 510, y: 10 }, walls, elements, 3)).toBeNull()
    expect(nearestDimAnchor({ x: -10, y: -10 }, walls, elements, 3)).toBeNull()
  })

  it("DA-20: пересечения продолжений граней за торцом (середина торца) точек замера не дают", () => {
    const { walls, elements } = sceneF2()
    expect(nearestDimAnchor({ x: 500, y: 0 }, walls, elements, 6)).toBeNull()
    expect(nearestDimAnchor({ x: 0, y: 0 }, walls, elements, 6)).toBeNull()
  })

  it("DA-40: элементы не переданы — откос не предлагается", () => {
    const { walls } = sceneF2()
    expect(nearestDimAnchor({ x: 220, y: 10 }, walls, [], 3)).toBeNull()
  })

  it("DA-40b: элемент на отсутствующей стене откосов не даёт", () => {
    const { walls } = sceneF2()
    const orphan = [win("nope", "a", 100, 120, 150, 85, "x1")]
    expect(nearestDimAnchor({ x: 100, y: 10 }, walls, orphan, 3)).toBeNull()
  })
})
