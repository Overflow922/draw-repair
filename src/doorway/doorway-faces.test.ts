import { describe, expect, it } from "vitest"
import { doorwayDistances, doorwayHolds, faceRuns, jambsT } from "./doorway-faces"
import { D0, UO, door, expectedJambsT, near, sceneF, sceneR, sceneRP, w } from "./doorway.test-utils"

// change add-doorway: стыки граней, расстояния и инвариант проёма
// (spec doorway «Проём и опорная стена», «Стыки грани и расстояния проёма», «Инвариант размещения проёма»; design D1, D3).
// Сторона грани: plus — сторона нормали n = (−d.y, d.x) к оси a → b (у W (0,0)-(500,0) — грань y = +10),
// minus — противоположная. Расстояние a/b — от откоса до ближайшего стыка в сторону конца a/b.

describe("откосы по привязке", () => {
  it("DF-01: привязка a, 100 см, ширина 90 — откосы на t = 100 и 190", () => {
    const { W } = sceneF()
    expect(jambsT(D0(), W)).toEqual([100, 190])
    expect(jambsT(D0(), W)).toEqual(expectedJambsT(D0(), W))
  })

  it("DF-02: привязка b, 100 см, ширина 90 — откосы на t = 310 и 400", () => {
    const { W } = sceneF()
    expect(jambsT(door("W", "b", 100), W)).toEqual([310, 400])
  })

  it("DF-02b: наклонная стена — t измеряется вдоль оси от конца a", () => {
    const S = w(0, 0, 300, 400, "W") // длина 500
    expect(jambsT(door("W", "b", 50, 100), S)).toEqual([350, 450])
  })
})

describe("свободные участки граней", () => {
  it("DF-RUNS-1: в комнате R грань plus W — от грани L до грани R, minus — между наружными углами", () => {
    const { walls, W } = sceneR()
    const plus = faceRuns(W, walls, 1)
    const minus = faceRuns(W, walls, -1)
    expect(plus).toHaveLength(1)
    expect(plus[0][0]).toBeCloseTo(10, 1)
    expect(plus[0][1]).toBeCloseTo(490, 1)
    expect(minus).toHaveLength(1)
    expect(minus[0][0]).toBeCloseTo(-10, 1)
    expect(minus[0][1]).toBeCloseTo(510, 1)
  })

  it("DF-RUNS-2: T-примыкание делит грань plus на два участка, minus не трогает", () => {
    const { walls, W } = sceneRP()
    const plus = faceRuns(W, walls, 1)
    expect(plus).toHaveLength(2)
    expect(plus[0][0]).toBeCloseTo(10, 1)
    expect(plus[0][1]).toBeCloseTo(295, 1)
    expect(plus[1][0]).toBeCloseTo(305, 1)
    expect(plus[1][1]).toBeCloseTo(490, 1)
    expect(faceRuns(W, walls, -1)).toHaveLength(1)
  })
})

describe("расстояния по граням", () => {
  it("DF-03: прямые углы — plus 90 / 300, minus 110 / 320", () => {
    const { walls } = sceneR()
    const d = doorwayDistances(D0(), walls)
    expect(d).not.toBeNull()
    expect(d?.plus.a).toBeCloseTo(90, 1)
    expect(d?.plus.b).toBeCloseTo(300, 1)
    expect(d?.minus.a).toBeCloseTo(110, 1)
    expect(d?.minus.b).toBeCloseTo(320, 1)
  })

  it("DF-04: T-примыкание делит грань — plus 90 / 105, minus прежние 110 / 320", () => {
    const { walls } = sceneRP()
    const d = doorwayDistances(D0(), walls)
    expect(d?.plus.a).toBeCloseTo(90, 1)
    expect(d?.plus.b).toBeCloseTo(105, 1)
    expect(d?.minus.a).toBeCloseTo(110, 1)
    expect(d?.minus.b).toBeCloseTo(320, 1)
  })

  it("DF-05: свободная стена — стыки на торцах, 100 / 310 на обеих гранях", () => {
    const { walls } = sceneF()
    const d = doorwayDistances(D0(), walls)
    expect(d?.plus.a).toBeCloseTo(100, 1)
    expect(d?.plus.b).toBeCloseTo(310, 1)
    expect(d?.minus.a).toBeCloseTo(100, 1)
    expect(d?.minus.b).toBeCloseTo(310, 1)
  })

  it("DF-05b: привязка b — расстояния считаются от откосов, а не от привязки", () => {
    const { walls } = sceneR()
    const d = doorwayDistances(door("W", "b", 100), walls) // откосы x = 310 и 400
    expect(d?.plus.a).toBeCloseTo(300, 1)
    expect(d?.plus.b).toBeCloseTo(90, 1)
    expect(d?.minus.a).toBeCloseTo(320, 1)
    expect(d?.minus.b).toBeCloseTo(110, 1)
  })

  it("DF-06: непрямой угол 135° — граница по пересечению граней (≈ 95.86 внутри, ≈ 104.14 снаружи)", () => {
    const W = w(0, 0, 500, 0, "W")
    const N = w(0, 0, -200, 200, "N")
    const d = doorwayDistances(D0(), [W, N])
    // внутренняя грань N: x + y = 10√2 → на y = 10 x = 4.142; наружная: x + y = −10√2 → на y = −10 x = −4.142
    expect(near(d?.plus.a ?? NaN, 100 - 4.142, 0.1)).toBe(true)
    expect(near(d?.minus.a ?? NaN, 100 + 4.142, 0.1)).toBe(true)
    expect(d?.plus.b).toBeCloseTo(310, 1)
  })

  it("DF-07: углы стыком на грани (без общей вершины) — те же правила граней", () => {
    // W (0,0)-(420,0); V (410,10)-(410,310) и L (10,310)-(10,10) примыкают концами к внутренней грани W
    const W = w(0, 0, 420, 0, "W")
    const walls = [W, w(410, 10, 410, 310, "V"), w(420, 320, 0, 320, "B"), w(10, 310, 10, 10, "L")]
    const d = doorwayDistances(D0(), walls)
    expect(d?.plus.a).toBeCloseTo(80, 1)
    expect(d?.plus.b).toBeCloseTo(210, 1)
    expect(d?.minus.a).toBeCloseTo(100, 1)
    expect(d?.minus.b).toBeCloseTo(230, 1)
  })

  it("DF-SUM: на каждой грани расстояние a + ширина + расстояние b = длина участка", () => {
    const { walls } = sceneR()
    const d = doorwayDistances(D0(), walls)
    expect((d?.plus.a ?? 0) + 90 + (d?.plus.b ?? 0)).toBeCloseTo(480, 1)
    expect((d?.minus.a ?? 0) + 90 + (d?.minus.b ?? 0)).toBeCloseTo(520, 1)
  })

  it("DF-NULL: проём на отсутствующей стене — расстояний нет", () => {
    const { walls } = sceneR()
    expect(doorwayDistances(door("nope", "a", 100), walls)).toBeNull()
  })
})

describe("инвариант размещения", () => {
  it("DF-08: вплотную к углу допустимо — plus.a = 0, minus.a = 20", () => {
    const { walls } = sceneR()
    const d = doorwayDistances(UO(), walls)
    expect(d?.plus.a).toBeCloseTo(0, 3)
    expect(d?.minus.a).toBeCloseTo(20, 1)
    expect(doorwayHolds(UO(), walls)).toBe(true)
  })

  it("DF-08b: d = 0 у торца свободной стены допустимо", () => {
    const { walls } = sceneF()
    expect(doorwayHolds(door("W", "a", 0), walls)).toBe(true)
    expect(doorwayHolds(door("W", "b", 0), walls)).toBe(true)
    const d = doorwayDistances(door("W", "a", 0), walls)
    expect(d?.plus.a).toBeCloseTo(0, 3)
    expect(d?.minus.a).toBeCloseTo(0, 3)
  })

  it("DF-08c: ширина ровно на весь участок допустима (оба внутренних расстояния 0)", () => {
    const { walls } = sceneR()
    expect(doorwayHolds(door("W", "a", 10, 480), walls)).toBe(true)
  })

  it("DF-09: заход за угол на 1 см нарушает инвариант", () => {
    const { walls } = sceneR()
    const d = door("W", "a", 9)
    expect(doorwayHolds(d, walls)).toBe(false)
    expect(doorwayDistances(d, walls)?.plus.a).toBeCloseTo(-1, 1)
  })

  it("DF-09b: проём за торцом стены нарушает инвариант на обеих гранях", () => {
    const { walls } = sceneF()
    const d = door("W", "a", 450)
    expect(doorwayHolds(d, walls)).toBe(false)
    expect(doorwayDistances(d, walls)?.plus.b).toBeCloseTo(-40, 1)
    expect(doorwayDistances(d, walls)?.minus.b).toBeCloseTo(-40, 1)
  })

  it("DF-09c: стена укоротилась на 0.001 у откоса — нарушение", () => {
    const W = w(0, 0, 189.999, 0, "W")
    expect(doorwayHolds(D0(), [W])).toBe(false)
  })

  it("DF-09d: ширина на 0.01 больше участка — нарушение", () => {
    const { walls } = sceneR()
    expect(doorwayHolds(door("W", "a", 10, 480.01), walls)).toBe(false)
  })

  it("DF-09e: проём, накрывающий перегородку, нарушает инвариант", () => {
    const { walls } = sceneRP()
    expect(doorwayHolds(door("W", "a", 250), walls)).toBe(false)
  })

  it("DF-10: касание откоса и грани перегородки допустимо, наложение 0.01 — нет", () => {
    const { walls } = sceneRP()
    expect(doorwayHolds(door("W", "a", 205), walls)).toBe(true) // [205, 295], грань P на 295
    expect(doorwayHolds(door("W", "a", 205.01), walls)).toBe(false)
    expect(doorwayHolds(door("W", "a", 305), walls)).toBe(true) // [305, 395], другая грань P
    expect(doorwayHolds(door("W", "a", 304.99), walls)).toBe(false)
  })

  it("DF-11: проём на отсутствующей стене инвариант не выполняет", () => {
    const { walls } = sceneR()
    expect(doorwayHolds(door("nope", "a", 100), walls)).toBe(false)
  })
})
