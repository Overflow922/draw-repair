import { describe, expect, it } from "vitest"
import type { LightSwitch, Point } from "../types"
import { keyGeometry, switchExtent, switchHit, switchLabelBox, SWITCH_HIT_PX } from "./switch-symbol"

// change add-light-switch: знак выключателя (spec light-switch «Знак выключателя»; design D4, образец — references/lines.png).
// Единицы: u — единиц носителя на мм бумаги; на холсте u = 4 (12 px = 3 мм), в PDF u = 1 (мм). Экранные оси: y вниз.

const block = (angle: number, keys: string[][] = [[]]): LightSwitch => ({ id: "s", at: { x: 0, y: 0 }, angle, keys: keys.map((lines) => ({ lines })) })
const AT: Point = { x: 100, y: 100 }

const near = (p: Point, x: number, y: number): void => {
  expect(p.x).toBeCloseTo(x, 6)
  expect(p.y).toBeCloseTo(y, 6)
}

describe("положения частей знака", () => {
  it("SW-S1: северная стена (нормаль вверх), u = 4 — кружок 12 px касается грани, стойка 12 px, штрих 10 px влево", () => {
    const g = keyGeometry(block(-90), 0, AT, 4)
    near(g.circle.c, 100, 94)
    expect(g.circle.r).toBeCloseTo(6, 6)
    near(g.stalk[0], 100, 88)
    near(g.stalk[1], 100, 76)
    near(g.dash[0], 100, 76)
    near(g.dash[1], 90, 76) // штрих влево: образец references/lines.png
    near(g.label, 100, 72) // центр подписи на 28 px от грани
  })

  it("SW-S2: те же размеры в миллиметрах бумаги (u = 1): 3 мм, 3 мм, 2,5 мм, подпись на 7 мм", () => {
    const g = keyGeometry(block(-90), 0, { x: 50, y: 50 }, 1)
    near(g.circle.c, 50, 48.5)
    expect(g.circle.r).toBeCloseTo(1.5, 6)
    near(g.stalk[1], 50, 44)
    near(g.dash[1], 47.5, 44)
    near(g.label, 50, 43)
  })

  it("SW-S3: южная стена (нормаль вниз) — штрих вправо; нормаль вправо — штрих вверх; нормаль влево — штрих вниз", () => {
    near(keyGeometry(block(90), 0, AT, 4).dash[1], 110, 124)
    near(keyGeometry(block(0), 0, AT, 4).dash[1], 124, 90)
    near(keyGeometry(block(180), 0, AT, 4).dash[1], 76, 110)
  })

  it("SW-S4: у вертикальной грани стойка идёт вдоль нормали, подпись горизонтальна и стоит на 28 px от грани", () => {
    const g = keyGeometry(block(0), 0, AT, 4)
    near(g.circle.c, 106, 100)
    near(g.stalk[1], 124, 100)
    near(g.label, 128, 100)
  })

  it("SW-S5: три клавиши — шаг 48 px вдоль грани, блок центрирован на центре", () => {
    const sw = block(-90, [["L2", "LV1"], ["L3"], ["L4", "L5"]])
    const xs = [0, 1, 2].map((i) => keyGeometry(sw, i, AT, 4).circle.c.x)
    expect(xs[0]).toBeCloseTo(52, 6)
    expect(xs[1]).toBeCloseTo(100, 6)
    expect(xs[2]).toBeCloseTo(148, 6)
  })

  it("SW-S6: две клавиши центрированы на центре: ±24 px", () => {
    const sw = block(-90, [[], []])
    expect(keyGeometry(sw, 0, AT, 4).circle.c.x).toBeCloseTo(76, 6)
    expect(keyGeometry(sw, 1, AT, 4).circle.c.x).toBeCloseTo(124, 6)
  })

  it("SW-S7: вертикальная грань — клавиши идут вдоль неё (по Y)", () => {
    const sw = block(0, [[], [], []])
    // касательная (−n.y, n.x) = (0, 1): порядок клавиш — сверху вниз
    expect(keyGeometry(sw, 0, AT, 4).circle.c.y).toBeCloseTo(52, 6)
    expect(keyGeometry(sw, 2, AT, 4).circle.c.y).toBeCloseTo(148, 6)
  })
})

describe("габарит выключателя", () => {
  it("SW-E1: охватывает кружки, штрихи и подписи клавиш, в см чертежа", () => {
    const sw = block(-90, [["L2", "LV1"], ["L3"]])
    const pts = switchExtent({ ...sw, at: { x: 100, y: 100 } }, 1, 1) // kMm = 1: мм листа равны см чертежа
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    expect(Math.min(...ys)).toBeCloseTo(100 - 7 - 1.25, 6) // верх подписи: центр на 7 мм от грани, кегль 2,5 мм
    expect(Math.max(...ys)).toBeCloseTo(100, 6) // грань
    expect(Math.min(...xs)).toBeLessThan(100 - 6 - 1.5) // левая клавиша ушла влево на 6 мм, подпись шире кружка
    expect(Math.max(...xs)).toBeGreaterThan(100 + 6)
  })

  it("SW-E2: высота знака на бумаге не зависит от масштаба чертежа", () => {
    const sw = { ...block(-90, [["L2"]]), at: { x: 10, y: 10 } }
    const heightMm = (kMm: number): number => {
      const ys = switchExtent(sw, kMm, 1).map((p) => p.y)
      return (Math.max(...ys) - Math.min(...ys)) * kMm
    }
    expect(heightMm(2)).toBeCloseTo(heightMm(1), 6)
  })
})

describe("зоны клика", () => {
  const sw = block(-90, [["L2"], []])
  const key1 = keyGeometry(sw, 1, AT, 4)

  it("SW-H1: кружок, стойка и штрих попадают, далеко — нет", () => {
    expect(switchHit(sw, AT, key1.circle.c, 4)?.keyIndex).toBe(1)
    expect(switchHit(sw, AT, { x: key1.stalk[1].x, y: key1.stalk[1].y + 3 }, 4)).toMatchObject({ keyIndex: 1, part: "stalk" })
    expect(switchHit(sw, AT, { x: key1.dash[1].x, y: key1.dash[1].y }, 4)).not.toBeNull()
    expect(switchHit(sw, AT, { x: 300, y: 300 }, 4)).toBeNull()
  })

  it("SW-H2: зона не меньше 8 px вокруг каждой части", () => {
    expect(switchHit(sw, AT, { x: key1.circle.c.x + key1.circle.r + SWITCH_HIT_PX - 0.5, y: key1.circle.c.y }, 4)).not.toBeNull()
    expect(switchHit(sw, AT, { x: key1.stalk[1].x + SWITCH_HIT_PX - 0.5, y: key1.stalk[1].y }, 4)).not.toBeNull()
  })

  it("SW-H3: подпись клавиши попадает как подпись, у клавиши без линий подписи нет", () => {
    const labelled = keyGeometry(sw, 0, AT, 4)
    expect(switchHit(sw, AT, labelled.label, 4)).toMatchObject({ keyIndex: 0, part: "label" })
    const empty = switchLabelBox(sw, 1, AT, 4)
    expect(empty).toBeNull()
  })

  it("SW-H4: кружок отдаёт часть «кружок»", () => {
    expect(switchHit(sw, AT, key1.circle.c, 4)).toMatchObject({ part: "circle" })
  })
})
