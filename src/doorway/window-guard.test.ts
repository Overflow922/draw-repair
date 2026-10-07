import { describe, expect, it } from "vitest"
import type { Wall, WallElement } from "../types"
import { chainSegment } from "../wall-chain"
import type { ChainInput } from "../wall-chain"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "../wall-edit"
import { doorwayHolds, jambsT } from "./doorway-faces"
import { thicknessAllowed, violatesDoorways } from "./doorway-guard"
import { D0, axisPoint, expectPoint, sceneF, sceneR, sceneRP, w } from "./doorway.test-utils"
import { sceneFN, win } from "./window.test-utils"

// change add-window: правки и рисование стен не нарушают окна и не сводят элементы до наложения
// (spec wall-collision «Правки стен не нарушают проёмы»; doorway «Элементы стены»;
// window «Окно — элемент стены»; design D2, D8).

const FREE = (doorways: WallElement[]): { ortho: false; doorways: WallElement[] } => ({ ortho: false, doorways })

function allHold(elements: WallElement[], walls: Wall[]): void {
  for (const e of elements) expect(doorwayHolds(e, walls, elements)).toBe(true)
}

describe("укорочение стены не сводит элементы с разными привязками", () => {
  it("WG-01: конец b в (300, 0) останавливается в (410, 0): окно касается проёма", () => {
    const { walls, W, elements } = sceneFN()
    moveEndpointBounded(walls, W, "b", { x: 300, y: 0 }, FREE(elements))
    expectPoint(W.b, 410, 0)
    expect(jambsT(elements[1], W)[0]).toBeCloseTo(190, 3)
    allHold(elements, walls)
  })

  it("WG-02: ввод длины 300 даёт 410", () => {
    const { walls, W, elements } = sceneFN()
    const r = resizeWallBounded(walls, W, 300, FREE(elements))
    expect(r.kind).toBe("applied")
    if (r.kind === "applied") expect(r.lengthCm).toBeCloseTo(410, 3)
    expect(W.b.x).toBeCloseTo(410, 3)
    allHold(elements, walls)
  })

  it("WG-02b: длина, не сводящая элементы, применяется полностью", () => {
    const { walls, W, elements } = sceneFN()
    expect(resizeWallBounded(walls, W, 450, FREE(elements))).toEqual({ kind: "applied", lengthCm: 450 })
  })

  it("WG-03: после касания конец сразу отходит назад", () => {
    const { walls, W, elements } = sceneFN()
    moveEndpointBounded(walls, W, "b", { x: 300, y: 0 }, FREE(elements))
    moveEndpointBounded(walls, W, "b", { x: 420, y: 0 }, FREE(elements))
    expectPoint(W.b, 420, 0)
  })

  it("WG-03b: без списка элементов (контроль) укорочение до 300 проходит", () => {
    const { walls, W } = sceneFN()
    moveEndpointBounded(walls, W, "b", { x: 300, y: 0 }, FREE([D0()]))
    expectPoint(W.b, 300, 0)
  })
})

describe("окно ограничивает правки стен, как проём", () => {
  it("WG-04: перегородка не заходит в окно — грань касается откоса", () => {
    const { walls, P } = sceneRP()
    const x = win("W", "a", 100, 90)
    moveWallsBounded(walls, [P], { x: -200, y: 0 }, FREE([x]))
    expect(P.a.x).toBeCloseTo(195, 3)
    expect(P.b.x).toBeCloseTo(195, 3)
  })

  it("WG-05: толщина угловой стены у окна вплотную к углу не увеличивается", () => {
    const { walls, L } = sceneR()
    const x = win("W", "a", 10, 90)
    expect(thicknessAllowed(walls, L, 40, [x])).toBe(false)
    expect(thicknessAllowed(walls, L, 20, [x])).toBe(true)
    expect(thicknessAllowed(walls, L, 10, [x])).toBe(true)
  })

  it("WG-06: стена, примкнутая внутри окна, нарушает; в стороне — нет; рисование не прилипает к грани в окне", () => {
    const { walls } = sceneR()
    const x = win("W", "a", 100, 90)
    expect(violatesDoorways(walls, [...walls, w(150, 10, 150, 200, "n", 10)], [x])).toBe(true)
    expect(violatesDoorways(walls, [...walls, w(250, 10, 250, 200, "n", 10)], [x])).toBe(false)
    const input = (doorways?: WallElement[]): ChainInput => ({
      start: { x: 145, y: 200 },
      ref: null,
      raw: { x: 145, y: 14 },
      walls,
      radiusCm: 6,
      gridStepCm: 10,
      thicknessCm: 10,
      ortho: false,
      typedAngleDeg: null,
      typedLengthCm: null,
      ...(doorways ? { doorways } : {}),
    })
    expect(chainSegment(input()).snap.source).toBe("wall")
    const guarded = chainSegment(input([x]))
    expect(guarded.snap.source === "wall" && guarded.end.x > 95 && guarded.end.x < 195).toBe(false)
  })

  it("WG-06b: стена, примкнутая на участке между двумя элементами, допустима", () => {
    const { walls } = sceneR()
    const els: WallElement[] = [D0(), win("W", "b", 100)]
    expect(violatesDoorways(walls, [...walls, w(235, 10, 235, 200, "n", 10)], els)).toBe(false)
    expect(violatesDoorways(walls, [...walls, w(285, 10, 285, 200, "n", 10)], els)).toBe(true)
  })

  it("WG-08: окно следует за концом привязки", () => {
    const { walls, W } = sceneF()
    const x = win("W", "a", 100)
    moveEndpointBounded(walls, W, "a", { x: -50, y: 0 }, FREE([x]))
    expectPoint(W.a, -50, 0)
    expectPoint(axisPoint(W, jambsT(x, W)[0]), 50, 0)
    expect(x).toEqual(win("W", "a", 100))
  })
})

describe("наложение из документа не углубляется правками стен", () => {
  // проём 100…190 (привязка a), окно 170…290 (привязка b, 210) — наложение 20
  const scene = () => {
    const { walls, W } = sceneF()
    const els: WallElement[] = [D0(), win("W", "b", 210)]
    return { walls, W, els }
  }

  it("WG-07: укорочение, углубляющее наложение, ограничено; удлинение, снимающее его, проходит", () => {
    const deeper = scene()
    moveEndpointBounded(deeper.walls, deeper.W, "b", { x: 480, y: 0 }, FREE(deeper.els))
    expectPoint(deeper.W.b, 500, 0)
    const better = scene()
    moveEndpointBounded(better.walls, better.W, "b", { x: 520, y: 0 }, FREE(better.els))
    expectPoint(better.W.b, 520, 0)
  })

  it("WG-07c: правки самой стены с наложением, не углубляющие его, не блокируются", () => {
    const moved = scene()
    moveWallsBounded(moved.walls, [moved.W], { x: 0, y: 50 }, FREE(moved.els))
    expectPoint(moved.W.a, 0, 50)
    expectPoint(moved.W.b, 500, 50)
    const thick = scene()
    expect(thicknessAllowed(thick.walls, thick.W, 30, thick.els)).toBe(true)
    // удлинение до 510 уменьшает наложение до 10, но не снимает его
    const partly = scene()
    moveEndpointBounded(partly.walls, partly.W, "b", { x: 510, y: 0 }, FREE(partly.els))
    expectPoint(partly.W.b, 510, 0)
    const typed = scene()
    expect(resizeWallBounded(typed.walls, typed.W, 505, FREE(typed.els))).toEqual({ kind: "applied", lengthCm: 505 })
  })

  it("WG-07b: несвязанная правка при наложении не блокируется", () => {
    const { walls, els } = scene()
    const other = w(0, 300, 400, 300, "O")
    const all = [...walls, other]
    moveWallsBounded(all, [other], { x: 0, y: 50 }, FREE(els))
    expectPoint(other.a, 0, 350)
  })
})
