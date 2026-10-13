import { describe, expect, it } from "vitest"
import { drawScene } from "../render"
import { findRooms } from "../room-area"
import { PX_PER_CM } from "../types"
import type { Wall, WallElement } from "../types"
import { doorwayHolds } from "./doorway-faces"
import { editableNumbers, numberAt } from "./editable-numbers"
import { D0, VIEW, recorder, sceneF, sceneR, texts, w } from "./doorway.test-utils"
import { LABEL_PX } from "./selection-editing.test-utils"
import { win } from "./window.test-utils"
import { WN, distancesFor, elementOf, made, sceneCB, sceneCF, sceneCK, sceneCKb, sceneCM, sceneCR, sceneCT } from "./collinear-distance.test-utils"

// change fix-opening-distance-collinear: расстояния проёма до конца грани сквозь коллинеарные стены
// (spec doorway «Расстояния проёма сквозь коллинеарные стены»; design D1–D3). Тесты CD-1…CD-6, CD-11, CD-15…CD-18,
// CD-20, CD-21 test-plan.md. Эталоны — из спецификации и геометрии сцен.

const near = (actual: number[], expected: number[]): void => {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((v, i) => expect(v, `#${i}: ${actual.join(", ")}`).toBeCloseTo(expected[i], 3))
}

describe("расстояния сквозь стену того же материала", () => {
  it("CD-1: окно на W в CK — слева до угла (390 по внутренней, 410 по наружной грани), справа до торца 180", () => {
    const { walls } = sceneCK()
    near(distancesFor(WN(), walls), [390, 180, 410, 180])
  })

  it("CD-2: замкнутая комната с верхней стеной из двух кирпичных — расстояния до обоих углов не зависят от порядка стен", () => {
    for (const order of ["natural", "reversed", "walls-first-last"] as const) {
      const { walls } = sceneCR(order)
      near(distancesFor(WN(), walls), [390, 170, 410, 190])
    }
  })

  it("CD-3: число слева в цепочке окна в CK — 390 и 410, число доступно для клика по центру", () => {
    const { walls } = sceneCK()
    const e = WN()
    const list = editableNumbers(e, walls, [e], findRooms(walls), "cm", PX_PER_CM, LABEL_PX)
    const left = list.filter((n) => n.target.kind === "distance" && n.target.part === "a")
    expect(left.map((n) => `${(n.target as { side: number }).side}:${n.text}:${Math.round(n.valueCm)}`).sort()).toEqual(["-1:410:410", "1:390:390"])
    for (const n of left) {
      const hit = numberAt(n.center, list, 0)
      expect(hit?.target).toEqual(n.target)
      expect(hit?.text).toBe(n.text)
    }
  })

  it("CD-20: цепочка свободных коллинеарных стен — слева до свободного торца W0 (400 см)", () => {
    const { walls } = sceneCF()
    near(distancesFor(WN(), walls), [400, 180, 400, 180])
  })
})

describe("расстояния до начала стены другого материала", () => {
  it("CD-4: W бетонная — слева 150 до плоскости стыка на обеих гранях, справа 180", () => {
    const { walls } = sceneCB()
    near(distancesFor(WN(), walls), [150, 180, 150, 180])
  })

  it("CD-4b: один и тот же сценарий с кирпичной и бетонной W даёт разные ответы (материал — критерий)", () => {
    const same = distancesFor(WN(), sceneCK().walls)
    const other = distancesFor(WN(), sceneCB().walls)
    expect(same[0]).not.toBeCloseTo(other[0], 1)
    expect(same[2]).not.toBeCloseTo(other[2], 1)
  })

  it("CD-5: цепочка W1, W2 (кирпич) и W3 (бетон), окно на W2 — слева до свободного торца W1 (200), справа до стыка с W3 (40)", () => {
    const { walls } = sceneCM()
    near(distancesFor(win("W2", "a", 50, 60, 150, 85, "e0"), walls), [200, 40, 200, 40])
  })

  it("CD-6: W0 толщиной 10 и W толщиной 20 одного материала — слева 150 до ступени на плоскости стыка", () => {
    const { walls } = sceneCT()
    near(distancesFor(WN(), walls), [150, 180, 150, 180])
  })

  it("CD-6b: W0 повёрнута на 2.4° от оси W (почти коллинеарный стык) — сквозь не считается", () => {
    const y0 = 250 * Math.tan((2.4 * Math.PI) / 180)
    const W0: Wall = { ...w(0, y0, 250, 0, "W0"), type: "brick" }
    const W = w(250, 0, 700, 0, "W")
    const [plusA, , minusA] = distancesFor(WN(), [W0, W])
    expect(plusA).toBeLessThan(200)
    expect(minusA).toBeLessThan(200)
  })

  it("CD-6c: стык с зазором 5 см между кирпичной W0 и бетонной W — граница по стыку, а не сквозь", () => {
    const W0 = w(0, 0, 245, 0, "W0")
    const W = made(w(250, 0, 700, 0, "W"), "concrete")
    const [plusA, , minusA] = distancesFor(WN(), [W0, W])
    for (const v of [plusA, minusA]) {
      expect(v).toBeGreaterThanOrEqual(150 - 1e-6)
      expect(v).toBeLessThanOrEqual(155 + 1e-6)
    }
  })

  it("CD-6d: стык с зазором 5 см между кирпичными стенами — сквозь до свободного торца W0", () => {
    const W0 = w(0, 0, 245, 0, "W0")
    const W = w(250, 0, 700, 0, "W")
    const [plusA, , minusA] = distancesFor(WN(), [W0, W])
    for (const v of [plusA, minusA]) expect(v).toBeGreaterThan(390)
  })
})

describe("конец b опорной стены", () => {
  it("CD-15: зеркальная раскладка — справа до угла R сквозь W0 (390 и 410), слева до свободного торца W (180)", () => {
    const { walls } = sceneCKb()
    const e: WallElement = { ...WN(), wallId: "W", anchor: "b", offsetCm: 150, widthCm: 120 }
    near(distancesFor(e, walls), [180, 390, 180, 410])
  })

  it("CD-15b: W0 бетонная — справа до начала W0 (150)", () => {
    const { walls, W0 } = sceneCKb()
    const concrete = [made(W0, "concrete"), ...walls.filter((x) => x !== W0)]
    const e: WallElement = { ...WN(), wallId: "W", anchor: "b", offsetCm: 150, widthCm: 120 }
    near(distancesFor(e, concrete), [180, 150, 180, 150])
  })
})

describe("независимость от запаса вокруг опорной стены", () => {
  it("CD-16: длинное продолжение (W0 длиной 2000) — расстояние до угла не обрезается запасом", () => {
    const W0 = w(-2000, 0, 250, 0, "W0")
    const Lfar = w(-2000, 400, -2000, 0, "Lfar")
    const W = w(250, 0, 700, 0, "W")
    near(distancesFor(WN(), [W0, W, Lfar]), [2390, 180, 2410, 180])
  })

  it("CD-16b: перегородка к грани W0 на x = 100 (толщина 20) — слева до грани перегородки (290), наружная грань сквозь (410)", () => {
    const { walls } = sceneCK()
    const P = w(100, 10, 100, 390, "P")
    const [plusA, , minusA] = distancesFor(WN(), [...walls, P])
    expect(plusA).toBeCloseTo(290, 3)
    expect(minusA).toBeCloseTo(410, 3)
  })

  it("CD-16c: совпадающая и обратная дублирующие стены — расстояния равны расстояниям сцены без дубля", () => {
    const { walls } = sceneCK()
    const expected = distancesFor(WN(), walls)
    const same = w(250, 0, 700, 0, "Wd")
    const reversed = w(700, 0, 250, 0, "Wr")
    near(distancesFor(WN(), [...walls, same]), expected)
    near(distancesFor(WN(), [...walls, reversed]), expected)
    near(distancesFor(WN(), [...walls, same, reversed]), expected)
  })

  it("CD-26: перегородка P к стыку W0/W со стороны помещения — слева 140 до грани P, наружная грань сквозь (410), справа 180", () => {
    const { walls } = sceneCK()
    const P = w(250, 0, 250, 400, "P")
    near(distancesFor(WN(), [...walls, P]), [140, 180, 410, 180])
  })

  it("CD-26b: перегородка P к стыку с противоположной стороны — слева 390 сквозь на внутренней грани, 140 до грани P на наружной", () => {
    const { walls } = sceneCK()
    const P = w(250, 0, 250, -400, "P")
    near(distancesFor(WN(), [...walls, P]), [390, 180, 140, 180])
  })
})

describe("проём, дверь и окно", () => {
  it.each(["doorway", "door", "window"] as const)("CD-17: %s в CK — 390 / 410 слева и 180 справа; в CB — 150 слева", (kind) => {
    const e = elementOf(kind)
    near(distancesFor(e, sceneCK().walls), [390, 180, 410, 180])
    near(distancesFor(e, sceneCB().walls), [150, 180, 150, 180])
  })

  it.each(["doorway", "door", "window"] as const)("CD-17b: %s в CK — инвариант размещения выполняется", (kind) => {
    const e = elementOf(kind)
    expect(doorwayHolds(e, sceneCK().walls, [e])).toBe(true)
    expect(doorwayHolds(e, sceneCB().walls, [e])).toBe(true)
  })
})

describe("отрисованные размеры выделенного элемента", () => {
  const numbersDrawn = (walls: Wall[], e: WallElement): string[] => {
    const { ctx, ops } = recorder()
    drawScene(ctx, 1600, 1200, walls, null, "cm", VIEW, [], { grid: false, doorways: [e], selectedDoorways: [e] })
    return texts(ops)
      .map((t) => t.text)
      .filter((t) => /^\d+$/.test(t))
      .sort()
  }

  it("CD-18: окно в CK — размеры 390, 410, 180, 180 и ширина 120 дважды", () => {
    expect(numbersDrawn(sceneCK().walls, WN())).toEqual(["120", "120", "180", "180", "390", "410"])
  })

  it("CD-18b: окно в CB — слева 150 на обеих гранях", () => {
    expect(numbersDrawn(sceneCB().walls, WN())).toEqual(["120", "120", "150", "150", "180", "180"])
  })
})

describe("сцены без коллинеарных стен", () => {
  it("CD-11: раскладка «Расстояния по граням у прямых углов» — 90/300 на грани y = 10, 110/320 на y = −10", () => {
    near(distancesFor(D0(), sceneR().walls), [90, 300, 110, 320])
  })

  it("CD-12: свободная стена W длиной 500 — расстояния до торцов 100 и 310 на обеих гранях", () => {
    near(distancesFor(D0(), sceneF().walls), [100, 310, 100, 310])
  })
})
