import { describe, expect, it } from "vitest"
import type { Point, Wall } from "../types"
import { plasterTarget } from "./plaster-face"
import type { PlasterTarget } from "./plaster-face"
import { roughScene } from "./rough-scene"
import { demolitionMark, drawing, rectWalls, wall } from "./rough.test-utils"

// change plaster-click-whole-face: цель клика — участок грани «от угла до угла»
// (spec rough-works-plan «Постановка штукатурки кликом по грани»; design D1–D4)

const R = 5
const at = (x: number, y: number): Point => ({ x, y })
const summary = (t: PlasterTarget | null) => t?.pieces.map((x) => [x.wall.id, x.face, Math.round(x.from * 10) / 10, Math.round(x.to * 10) / 10])

describe("цель клика", () => {
  it("PF-1: свободная стена, курсор со стороны y > 0 — грань +1 на всю длину", () => {
    const W = wall("W", 0, 0, 500, 0)
    expect(summary(plasterTarget(at(200, 15), [W], R))).toEqual([["W", 1, 0, 500]])
  })

  it("PF-2: курсор со стороны y < 0 — грань −1", () => {
    const W = wall("W", 0, 0, 500, 0)
    expect(summary(plasterTarget(at(200, -15), [W], R))).toEqual([["W", -1, 0, 500]])
  })

  it("PF-3: курсор на теле стены — грань по стороне оси", () => {
    const W = wall("W", 0, 0, 500, 0)
    expect(summary(plasterTarget(at(200, 4), [W], R))?.[0]?.[1]).toBe(1)
    expect(summary(plasterTarget(at(200, -4), [W], R))?.[0]?.[1]).toBe(-1)
  })

  it("PF-4: в комнате внутренняя грань — от угла до угла (внутренние углы), клик не зависит от места вдоль стены", () => {
    const walls = rectWalls("R", 0, 0, 500, 300)
    const near = summary(plasterTarget(at(50, 13), walls, R))
    const far = summary(plasterTarget(at(450, 13), walls, R))
    expect(near).toEqual(far)
    expect(near).toEqual([["R1", 1, 10, 490]])
  })

  it("PF-5: внешняя грань в комнате идёт от внешнего угла до внешнего угла (change plaster-face-to-corners)", () => {
    const walls = rectWalls("R", 0, 0, 500, 300)
    expect(summary(plasterTarget(at(250, -15), walls, R))).toEqual([["R1", -1, -10, 510]])
  })

  it("PF-6: примыкание торцом режет участок: цель — только часть до примыкания", () => {
    const W = wall("W", 0, 0, 500, 0)
    const T = wall("T", 250, 0, 250, 300)
    expect(summary(plasterTarget(at(100, 15), [W, T], R))).toEqual([["W", 1, 0, 240]])
    expect(summary(plasterTarget(at(400, 15), [W, T], R))).toEqual([["W", 1, 260, 500]])
    expect(summary(plasterTarget(at(100, -15), [W, T], R))).toEqual([["W", -1, 0, 500]])
  })

  it("PF-7: коллинеарные отрезки одной стороны (в том числе разных материалов) — одна цель из двух кусков", () => {
    const W1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const W2 = wall("W2", 300, 0, 600, 0, 20, "gkl")
    const target = plasterTarget(at(100, 15), [W1, W2], R)
    expect(summary(target)).toEqual([
      ["W1", 1, 0, 300],
      ["W2", 1, 0, 300],
    ])
    expect(target?.focusWallId).toBe("W1")
    expect(summary(plasterTarget(at(450, 15), [W1, W2], R))).toEqual(summary(plasterTarget(at(100, 15), [W1, W2], R)))
    expect(plasterTarget(at(450, 15), [W1, W2], R)?.focusWallId).toBe("W2")
  })

  it("PF-8: встречное направление отрезка меняет знак грани и отражает границы", () => {
    const W1 = wall("W1", 0, 0, 300, 0)
    const W2 = wall("W2", 600, 0, 300, 0) // ось направлена навстречу
    expect(summary(plasterTarget(at(100, 15), [W1, W2], R))).toEqual([
      ["W1", 1, 0, 300],
      ["W2", -1, 0, 300],
    ])
  })

  it("PF-9: кусок короче 1 см не входит в цель", () => {
    const W1 = wall("W1", 0, 0, 300, 0)
    const T = wall("T", 150, 0, 150, 300)
    const walls: Wall[] = [W1, T]
    expect(summary(plasterTarget(at(50, 15), walls, R))).toEqual([["W1", 1, 0, 140]])
  })

  it("PF-10: вдали от стен и у места, закрытого другой стеной, цели нет", () => {
    const W = wall("W", 0, 0, 500, 0)
    const T = wall("T", 250, 0, 250, 300)
    expect(plasterTarget(at(250, 150), [W], R)).toBeNull()
    // внутри тела примыкающей стены цель — грань самой T, а не грань W за ней
    expect(summary(plasterTarget(at(250, 150), [W, T], R))?.[0]?.[0]).toBe("T")
  })

  it("PF-11: на подложке участок заканчивается у края снесённой части", () => {
    const d = drawing({ demolition: [demolitionMark("m", "W", "a", 200, 300)] })
    const base = roughScene(d).base.walls
    const left = summary(plasterTarget(at(100, 15), base, R))
    const right = summary(plasterTarget(at(400, 15), base, R))
    expect(left).toHaveLength(1)
    expect(left?.[0]?.slice(1)).toEqual([1, 0, 200])
    expect(right).toHaveLength(1)
    expect(right?.[0]?.slice(1)).toEqual([1, 0, 200])
  })
})
