import { describe, expect, it } from "vitest"
import { rectWalls, wall } from "../rough/rough.test-utils"
import { hostChains } from "./collinear-chain"
import { chainFaceRuns, openingFaceRuns } from "./doorway-faces"

// change plaster-click-whole-face: участки грани «от угла до угла» сквозь коллинеарные стены любого материала
// (spec rough-works-plan «Постановка штукатурки кликом по грани»; design D2–D3).
// Сторона +1 — сторона нормали (−d.y, d.x) к оси a → b: у стены (0,0)-(500,0) это y > 0.

const close = (runs: [number, number][], expected: [number, number][]): void => {
  expect(runs).toHaveLength(expected.length)
  runs.forEach(([a, b], i) => {
    expect(a).toBeCloseTo(expected[i]?.[0] ?? NaN, 1)
    expect(b).toBeCloseTo(expected[i]?.[1] ?? NaN, 1)
  })
}

describe("участки грани сквозь цепочку", () => {
  it("CFR-1: свободная стена — обе грани идут по всей длине", () => {
    const W = wall("W", 0, 0, 500, 0)
    close(chainFaceRuns(W, [W], 1), [[0, 500]])
    close(chainFaceRuns(W, [W], -1), [[0, 500]])
  })

  it("CFR-2: в комнате внутренняя грань — от внутреннего угла до внутреннего, внешняя — между наружными углами", () => {
    const walls = rectWalls("R", 0, 0, 500, 300)
    const top = walls[0]!
    close(chainFaceRuns(top, walls, 1), [[10, 490]])
    close(chainFaceRuns(top, walls, -1), [[-10, 510]])
  })

  it("CFR-3: примыкание торцом режет грань, с другой стороны грань целая", () => {
    const W = wall("W", 0, 0, 500, 0)
    const T = wall("T", 250, 0, 250, 300)
    close(chainFaceRuns(W, [W, T], 1), [
      [0, 240],
      [260, 500],
    ])
    close(chainFaceRuns(W, [W, T], -1), [[0, 500]])
  })

  it("CFR-5: коллинеарные отрезки одного материала дают один участок", () => {
    const W1 = wall("W1", 0, 0, 300, 0)
    const W2 = wall("W2", 300, 0, 600, 0)
    close(chainFaceRuns(W1, [W1, W2], 1), [[0, 600]])
  })

  it("CFR-6: коллинеарные отрезки разных материалов тоже дают один участок; для проёмов граница материала остаётся", () => {
    const W1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const W2 = wall("W2", 300, 0, 600, 0, 20, "gkl")
    const walls = [W1, W2]
    close(chainFaceRuns(W1, walls, 1), [[0, 600]])
    expect(openingFaceRuns(W1, walls, 1).at(-1)?.[1]).toBeLessThan(600)
  })

  it("CFR-7: цепочка собирает продолжения за обоими концами по порядку", () => {
    const W1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const W2 = wall("W2", 300, 0, 600, 0, 20, "gkl")
    const W0 = wall("W0", -200, 0, 0, 0, 20, "concrete")
    const chains = hostChains(W1, [W0, W1, W2], { ignoreMaterial: true })
    expect(chains.a.walls).toEqual([W0])
    expect(chains.b.walls).toEqual([W2])
    expect(chains.a.limitT).toBeNull()
    expect(chains.b.limitT).toBeNull()
  })

  it("CFR-8: без режима материала цепочка обрывается на смене материала, как раньше", () => {
    const W1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const W2 = wall("W2", 300, 0, 600, 0, 20, "gkl")
    const chains = hostChains(W1, [W1, W2])
    expect(chains.b.walls).toEqual([])
    expect(chains.b.limitT).not.toBeNull()
  })
})
