import { describe, expect, it } from "vitest"
import type { Point, Wall } from "../types"
import { plasterTarget } from "./plaster-face"
import type { PlasterTarget } from "./plaster-face"
import { rectWalls, wall } from "./rough.test-utils"

// change plaster-face-to-corners: цель клика — плоскость от угла до угла, раскладка по всем стенам плоскости
// (spec rough-works-plan «Постановка штукатурки кликом по грани», «Пометка штукатурки», «Штукатурка не прерывается на стыке коллинеарных стен»)

const R = 5
const at = (x: number, y: number): Point => ({ x, y })
const summary = (t: PlasterTarget | null) => t?.pieces.map((x) => [x.wall.id, x.face, Math.round(x.from * 10) / 10, Math.round(x.to * 10) / 10])

describe("выступ тела за ось", () => {
  it("PP-1: внешняя грань комнаты идёт от внешнего угла до внешнего угла (−10…510)", () => {
    const walls = rectWalls("R", 0, 0, 500, 300)
    expect(summary(plasterTarget(at(250, -15), walls, R))).toEqual([["R1", -1, -10, 510]])
  })

  it("PP-2: внешний угол только с одной стороны — грань −10…500, ширина 510 см", () => {
    const W = wall("W", 0, 0, 500, 0)
    const V = wall("V", 0, -300, 0, 0)
    const piece = plasterTarget(at(250, 15), [W, V], R)?.pieces[0]
    expect(piece && [piece.wall.id, piece.face, piece.from, piece.to]).toEqual(["W", 1, -10, 500])
    expect(piece && piece.to - piece.from).toBeCloseTo(510, 6)
  })

  it("PP-3: внутренняя грань комнаты выступа не имеет и остаётся 10…490", () => {
    const walls = rectWalls("R", 0, 0, 500, 300)
    expect(summary(plasterTarget(at(250, 15), walls, R))).toEqual([["R1", 1, 10, 490]])
  })

  it("PP-4: свободный торец стены выступа не имеет", () => {
    const W = wall("W", 0, 0, 500, 0)
    expect(summary(plasterTarget(at(250, 15), [W], R))).toEqual([["W", 1, 0, 500]])
  })
})

describe("плоскость из нескольких стен", () => {
  it("PP-5: стены разной толщины и материала заподлицо, одна из них разбита примыканием, — один клик на всю плоскость", () => {
    const W1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const W2a = wall("W2a", 300, 0, 437, 0, 20, "gkl")
    const W2b = wall("W2b", 437, 0, 600, 0, 20, "gkl")
    const W3 = wall("W3", 600, 10, 900, 10, 40, "concrete") // грань −1 заподлицо: y = −10
    const S = wall("S", 437, 10, 437, 300, 20, "brick") // примыкание к грани +1
    const target = plasterTarget(at(100, -15), [W1, W2a, W2b, W3, S], R)
    expect(summary(target)).toEqual([
      ["W1", -1, 0, 300],
      ["W2a", -1, 0, 137],
      ["W2b", -1, 0, 163],
      ["W3", -1, 0, 300],
    ])
    expect(target?.focusWallId).toBe("W1")
  })

  it("PP-6: клик по любой стене плоскости даёт ту же цель", () => {
    const W1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const W2 = wall("W2", 300, 0, 600, 0, 20, "gkl")
    const W3 = wall("W3", 600, 10, 900, 10, 40, "concrete")
    const walls = [W1, W2, W3]
    const first = summary(plasterTarget(at(100, -15), walls, R))
    expect(summary(plasterTarget(at(450, -15), walls, R))).toEqual(first)
    expect(summary(plasterTarget(at(800, -15), walls, R))).toEqual(first)
  })

  it("PP-7: стыковка не по осям — следующая стена начинается дальше допуска стыка, но грань сплошная", () => {
    const W1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const W2 = wall("W2", 300, 0, 600, 0, 20, "gkl")
    // третья стена той же плоскости лежит со сдвигом оси на 4 см внутрь и начинается внахлёст на W2
    const W3 = wall("W3", 580, 4, 900, 4, 28, "concrete")
    const target = plasterTarget(at(100, -15), [W1, W2, W3], R)
    expect(target?.pieces.map((p) => p.wall.id)).toEqual(["W1", "W2", "W3"])
  })
})

describe("примыкание и проём", () => {
  it("PP-8: сторона, противоположная примыканию, сплошная — через место примыкания", () => {
    const W = wall("W", 0, 0, 500, 0)
    const S = wall("S", 200, 10, 200, 300)
    expect(summary(plasterTarget(at(100, -15), [W, S], R))).toEqual([["W", -1, 0, 500]])
  })

  it("PP-9: сторона со стержнем рвётся у его грани", () => {
    const W = wall("W", 0, 0, 500, 0)
    const S = wall("S", 200, 10, 200, 300)
    expect(summary(plasterTarget(at(100, 15), [W, S], R))).toEqual([["W", 1, 0, 190]])
    expect(summary(plasterTarget(at(400, 15), [W, S], R))).toEqual([["W", 1, 210, 500]])
  })

  it("PP-10: стена другого типа и толщины с осью, сдвинутой на 5 см, — плоскость сплошная", () => {
    const W1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const W2 = wall("W2", 300, -5, 600, -5, 30, "gkl") // грань +1 заподлицо: y = 10
    const walls: Wall[] = [W1, W2]
    expect(summary(plasterTarget(at(450, 15), walls, R))).toEqual([
      ["W1", 1, 0, 300],
      ["W2", 1, 0, 300],
    ])
  })
})

describe("короткая стена", () => {
  it("PP-11: простенок между двумя проёмами имеет цель на своей грани", () => {
    // стена W с двумя «проёмами» из разрывов: левый и правый куски разделены простенком 30 см между перпендикулярными стенами
    const V1 = wall("V1", 100, 0, 100, 300, 20)
    const P = wall("P", 100, 0, 130, 0, 20)
    const V2 = wall("V2", 130, 0, 130, 300, 20)
    const target = plasterTarget(at(115, -15), [V1, P, V2], R)
    expect(target?.pieces.some((p) => p.wall.id === "P" && p.face === -1)).toBe(true)
  })

  it("PP-12: стена короче своей толщины с открытой гранью имеет цель, а грань идёт до внешнего угла", () => {
    const V1 = wall("V1", 0, -300, 0, 0, 20)
    const S = wall("S", 0, 0, 15, 0, 20)
    const V2 = wall("V2", 15, 0, 15, 300, 20)
    const target = plasterTarget(at(-5, 13), [V1, S, V2], R)
    expect(summary(target)).toEqual([["S", 1, -10, 5]])
  })
})
