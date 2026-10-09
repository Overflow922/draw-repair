import { describe, expect, it } from "vitest"
import type { Doorway } from "../types"
import { W, deepFreeze, door_, wall, window_ } from "./demolition.test-utils"
import { alongNodes, snapAlong } from "./mark-snap"

// change demolition-plan: узлы стены и привязка границ участка (spec demolition-plan «Привязка участка к узлам»;
// design D4). Стена W — (0,0)-(500,0), кирпич, 20 см; координаты узлов — расстояния вдоль оси от конца a.

describe("alongNodes", () => {
  it("ND-01: свободная стена без элементов — только концы 0 и длина", () => {
    expect(alongNodes(W(), [W()], [])).toEqual([0, 500])
  })

  it("ND-02: откосы проёма добавляют узлы 200 и 290", () => {
    const d: Doorway = { id: "d", wallId: "W", anchor: "a", offsetCm: 200, widthCm: 90, heightCm: 210 }
    expect(alongNodes(W(), [W()], [d])).toEqual([0, 200, 290, 500])
  })

  it("ND-02: откосы окна и двери, привязка b — те же координаты от конца a", () => {
    const win = window_("W", "b", 210, 90, "w1") // откосы 200–290
    const door = door_("W", "a", 350, 60, "d1") // 350–410
    expect(alongNodes(W(), [W()], [win, door])).toEqual([0, 200, 290, 350, 410, 500])
  })

  it("ND-02: элементы других стен не добавляют узлов", () => {
    const other = wall(0, 300, 500, 300, "V")
    const dv = door_("V", "a", 100)
    expect(alongNodes(W(), [W(), other], [dv])).toEqual([0, 500])
  })

  it("ND-03: примыкающая перпендикулярная стена шириной 20 с осью x = 300 даёт узлы 290 и 310", () => {
    const walls = [W(), wall(300, 300, 300, 10, "P")]
    expect(alongNodes(walls[0]!, walls, [])).toEqual([0, 290, 310, 500])
  })

  it("ND-03: пересекающая стена (сквозная) даёт те же узлы 290 и 310", () => {
    const walls = [W(), wall(300, -200, 300, 200, "P")]
    expect(alongNodes(walls[0]!, walls, [])).toEqual([0, 290, 310, 500])
  })

  it("ND-03: стена, не касающаяся W, узлов не даёт", () => {
    const walls = [W(), wall(300, 300, 300, 100, "P")]
    expect(alongNodes(walls[0]!, walls, [])).toEqual([0, 500])
  })

  it("ND-09: узлы за пределами [0, длина] не попадают в результат", () => {
    // стена P с телом x от 495 до 515 примыкает у конца W
    const walls = [W(), wall(505, 300, 505, 10, "P")]
    expect(alongNodes(walls[0]!, walls, [])).toEqual([0, 495, 500])
  })

  it("ND-08: результат упорядочен по возрастанию и без дублей: откос в конце стены совпадает с концом", () => {
    const d = door_("W", "a", 0, 90) // откосы 0–90
    expect(alongNodes(W(), [W()], [d])).toEqual([0, 90, 500])
  })

  it("ND-08: узлы разных источников в пределах 0,01 см сливаются в один", () => {
    const d = door_("W", "a", 290.005, 60) // откос 290,005 рядом с гранью стены P (290)
    const walls = [W(), wall(300, 300, 300, 10, "P")]
    const nodes = alongNodes(walls[0]!, walls, [d])
    expect(nodes.filter((n) => Math.abs(n - 290) < 0.02)).toHaveLength(1)
  })

  it("ND-10: вход не мутируется", () => {
    const walls = deepFreeze([W(), wall(300, 300, 300, 10, "P")])
    expect(() => alongNodes(walls[0]!, walls, deepFreeze([door_("W", "a", 100)]))).not.toThrow()
  })

  it("ND-11: наклонная стена — узлы считаются вдоль её оси", () => {
    // стена длиной 500 вдоль (1,1)/√2; конец и откос проёма на расстоянии 100 от a
    const diag = wall(0, 0, 353.5533905932738, 353.5533905932738, "D") // длина 500
    const d = door_("D", "a", 100, 50)
    const nodes = alongNodes(diag, [diag], [d])
    expect(nodes).toHaveLength(4)
    expect(nodes[0]).toBeCloseTo(0, 6)
    expect(nodes[1]).toBeCloseTo(100, 6)
    expect(nodes[2]).toBeCloseTo(150, 6)
    expect(nodes[3]).toBeCloseTo(500, 6)
  })
})

describe("snapAlong", () => {
  const nodes = [0, 200, 290, 500]

  it("ND-04: нет узла в радиусе — округление до целого сантиметра", () => {
    expect(snapAlong(123.4, nodes, 6, 500)).toBe(123)
    expect(snapAlong(123.6, nodes, 6, 500)).toBe(124)
  })

  it("ND-01: привязка к концу стены: 497 при радиусе 6 → 500", () => {
    expect(snapAlong(497, nodes, 6, 500)).toBe(500)
  })

  it("ND-02: привязка к откосу: 288 при радиусе 6 → 290", () => {
    expect(snapAlong(288, nodes, 6, 500)).toBe(290)
  })

  it("ND-05: расстояние ровно радиус — привязка; чуть больше — округление", () => {
    expect(snapAlong(206, nodes, 6, 500)).toBe(200)
    expect(snapAlong(206.01, nodes, 6, 500)).toBe(206)
  })

  it("ND-05: радиус 0 — привязка только к узлу точно в точке", () => {
    expect(snapAlong(200, nodes, 0, 500)).toBe(200)
    expect(snapAlong(200.4, nodes, 0, 500)).toBe(200)
    expect(snapAlong(200.6, nodes, 0, 500)).toBe(201)
  })

  it("ND-06: проекция за концами зажимается в [0, длина]", () => {
    expect(snapAlong(-5, [0, 500], 3, 500)).toBe(0)
    expect(snapAlong(520, [0, 500], 3, 500)).toBe(500)
    expect(snapAlong(-400, [], 6, 500)).toBe(0)
    expect(snapAlong(900, [], 6, 500)).toBe(500)
  })

  it("ND-07: из двух узлов в радиусе выбирается ближайший", () => {
    expect(snapAlong(248, [240, 250], 10, 500)).toBe(250)
    expect(snapAlong(243, [240, 250], 10, 500)).toBe(240)
  })

  it("ND-07: привязанная граница имеет ровно координату узла (без округления узла)", () => {
    expect(snapAlong(142, [140.5], 5, 500)).toBe(140.5)
  })

  it("ND-07: пустой список узлов — округление", () => {
    expect(snapAlong(77.7, [], 6, 500)).toBe(78)
  })
})
