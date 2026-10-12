import { describe, expect, it } from "vitest"
import { communicationGuard, limitNewWall, squareAllowed, thicknessAllowedForCommunications, violatesCommunications } from "./guard"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "../wall-edit"
import { ORTHO, expectWall, sceneCR, sceneTS } from "../wall-edit.test-utils"
import type { Wall } from "../types"
import { wallOverlapDepth } from "./geometry"
import { duct, expectPoint, riser, w } from "./communications.test-utils"

// change add-communications: стены не налагаются на коммуникации
// (spec wall-collision «Стены не налагаются на коммуникации»; test-plan WC-*).

const FREE = { ortho: false } as const
const moved = (wall: Wall, ax: number, ay: number, bx: number, by: number): Wall => ({ ...wall, a: { x: ax, y: ay }, b: { x: bx, y: by } })

describe("violatesCommunications", () => {
  const V = w(0, 0, 0, 300, "V") // тело x -10…10
  const r = riser(15, 100) // левый край 10: касание

  it("WV-01: касание допустимо, наложение — нет", () => {
    expect(violatesCommunications([V], [V], [r])).toBe(false)
    expect(violatesCommunications([V], [moved(V, 2, 0, 2, 300)], [r])).toBe(true)
  })

  it("WV-02: граница допуска: 0,009 см — допустимо, 0,011 см — нарушение", () => {
    expect(violatesCommunications([V], [moved(V, 0.009, 0, 0.009, 300)], [r])).toBe(false)
    expect(violatesCommunications([V], [moved(V, 0.011, 0, 0.011, 300)], [r])).toBe(true)
  })

  it("WV-03: без коммуникаций нарушения нет", () => {
    expect(violatesCommunications([V], [moved(V, 5, 0, 5, 300)], [])).toBe(false)
  })

  it("WV-06: наложение из документа не углубляется: 3 → 2 допустимо, 3 → 3 допустимо, 3 → 4 — нарушение", () => {
    const base = moved(V, 3, 0, 3, 300) // глубина 3
    expect(violatesCommunications([base], [moved(V, 2, 0, 2, 300)], [r])).toBe(false)
    expect(violatesCommunications([base], [moved(V, 3, 0, 3, 300)], [r])).toBe(false)
    expect(violatesCommunications([base], [moved(V, 4, 0, 4, 300)], [r])).toBe(true)
  })

  it("WV-04: стена, ушедшая в коммуникацию с другой стороны, — нарушение (стена проходит насквозь)", () => {
    expect(violatesCommunications([V], [moved(V, 17, 0, 17, 300)], [r])).toBe(true)
  })

  it("WV-05: проверяются все коммуникации списка", () => {
    const far = duct(500, 500, 30, 20, "d9")
    expect(violatesCommunications([V], [moved(V, 2, 0, 2, 300)], [far, r])).toBe(true)
    expect(violatesCommunications([V], [moved(V, 2, 0, 2, 300)], [r, far])).toBe(true)
  })
})

describe("communicationGuard", () => {
  const M = w(0, 200, 100, 200, "M", 10)
  const d = duct(215, 200) // x 200…230, y 190…210

  it("WC-05a: без коммуникаций охранника нет", () => {
    expect(communicationGuard([M], [])).toBeNull()
  })

  it("WC-05b: положение с касанием допустимо, с наложением — нет", () => {
    const g = communicationGuard([M], [d])
    expect(g).not.toBeNull()
    expect(g?.holds(new Map([[M, { a: { x: 100, y: 200 }, b: { x: 200, y: 200 } }]]))).toBe(true)
    expect(g?.holds(new Map([[M, { a: { x: 100.5, y: 200 }, b: { x: 200.5, y: 200 } }]]))).toBe(false)
  })

  it("WC-05c: пустой набор позиций допустим", () => {
    expect(communicationGuard([M], [d])?.holds(new Map())).toBe(true)
  })

  it("WC-05d: стена, ушедшая в сторону от коммуникации, допустима", () => {
    const g = communicationGuard([M], [d])
    expect(g?.holds(new Map([[M, { a: { x: 0, y: 300 }, b: { x: 100, y: 300 } }]]))).toBe(true)
  })

  it("WC-05e: две коммуникации: мешает вторая в списке — положение недопустимо; порядок списка не важен", () => {
    const far = duct(500, 500, 30, 20, "far")
    const blocked = new Map([[M, { a: { x: 100.5, y: 200 }, b: { x: 200.5, y: 200 } }]])
    const touching = new Map([[M, { a: { x: 100, y: 200 }, b: { x: 200, y: 200 } }]])
    for (const list of [[far, d], [d, far]]) {
      const g = communicationGuard([M], list)
      expect(g?.holds(blocked)).toBe(false)
      expect(g?.holds(touching)).toBe(true)
    }
  })

  it("WC-05f: две стены в позициях: препятствие у второй по порядку карты — недопустимо в обоих порядках", () => {
    const N = w(0, 300, 100, 300, "N", 10)
    const dN = duct(215, 300) // x 200…230, y 290…310 — мешает только N
    const free = { a: { x: 100, y: 200 }, b: { x: 200, y: 200 } }
    const blockedN = { a: { x: 100.5, y: 300 }, b: { x: 200.5, y: 300 } }
    const g = communicationGuard([M, N], [dN])
    expect(g?.holds(new Map([[M, free], [N, blockedN]]))).toBe(false)
    expect(g?.holds(new Map([[N, blockedN], [M, free]]))).toBe(false)
    expect(g?.holds(new Map([[M, free], [N, { a: { x: 100, y: 300 }, b: { x: 200, y: 300 } }]]))).toBe(true)
  })
})

describe("толщина", () => {
  const V = w(0, 0, 0, 300, "V")
  const r = riser(15, 100) // касается грани x = 10

  it("WC-06: увеличение толщины, при котором тело налагается на стояк, не применяется", () => {
    expect(thicknessAllowedForCommunications([V], V, 22, [r])).toBe(false)
  })

  it("WC-06b: прежняя и меньшая толщина допустимы", () => {
    expect(thicknessAllowedForCommunications([V], V, 20, [r])).toBe(true)
    expect(thicknessAllowedForCommunications([V], V, 10, [r])).toBe(true)
  })

  it("WC-06c: граница допуска: прибавка 0,009 см допустима, 0,011 — нет (по 0,0045 с каждой стороны)", () => {
    expect(thicknessAllowedForCommunications([V], V, 20.018, [r])).toBe(true)
    expect(thicknessAllowedForCommunications([V], V, 20.022, [r])).toBe(false)
  })

  it("WC-06d: коммуникация вдали не мешает", () => {
    expect(thicknessAllowedForCommunications([V], V, 60, [riser(300, 100)])).toBe(true)
  })
})

describe("рисование стены", () => {
  it("WC-01: конец стены (0,0)→(300,0) толщиной 20 останавливается в (95, 0) у стояка Ø10 в (100, 0)", () => {
    const end = limitNewWall({ x: 0, y: 0 }, { x: 300, y: 0 }, 20, [riser(100, 0)])
    expect(end).not.toBeNull()
    expectPoint(end ?? { x: NaN, y: NaN }, 95, 0, 4)
  })

  it("WC-01b: учитывается тело (толщина), а не ось: ось на 14 см выше центра, тело 4…24 задевает круг", () => {
    // тело y 4…24 пересекает круг Ø10 (y −5…5) на хорде полуширины 3: касание при конце x = 97
    const end = limitNewWall({ x: 0, y: 14 }, { x: 300, y: 14 }, 20, [riser(100, 0)])
    expectPoint(end ?? { x: NaN, y: NaN }, 97, 14, 4)
  })

  it("WC-01c: стена мимо коммуникации не ограничивается", () => {
    const end = limitNewWall({ x: 0, y: 50 }, { x: 300, y: 50 }, 20, [riser(100, 0)])
    expect(end).toEqual({ x: 300, y: 50 })
  })

  it("WC-01d: без коммуникаций конец прежний", () => {
    expect(limitNewWall({ x: 0, y: 0 }, { x: 300, y: 0 }, 20, [])).toEqual({ x: 300, y: 0 })
  })

  it("WC-01e: воздуховод: конец останавливается у его грани x = 200", () => {
    const end = limitNewWall({ x: 0, y: 200 }, { x: 300, y: 200 }, 10, [duct(215, 200)])
    expectPoint(end ?? { x: NaN, y: NaN }, 200, 200, 4)
  })

  it("WC-01f: направление не важно: справа налево упирается в правую грань стояка", () => {
    const end = limitNewWall({ x: 300, y: 0 }, { x: 0, y: 0 }, 20, [riser(100, 0)])
    expectPoint(end ?? { x: NaN, y: NaN }, 105, 0, 4)
  })

  it("WC-03: начало вплотную к стояку и цель за ним — нулевая длина: null (допуск 0,01 см не даёт «обрубок» длиннее допуска)", () => {
    const end = limitNewWall({ x: 95, y: 0 }, { x: 300, y: 0 }, 20, [riser(100, 0)])
    expect(end === null || Math.hypot(end.x - 95, end.y) <= 0.011).toBe(true)
    expect(end).not.toEqual({ x: 300, y: 0 })
  })

  it("WC-03b: начало вплотную к стояку, стена уходит от него — не ограничивается", () => {
    const end = limitNewWall({ x: 95, y: 0 }, { x: -100, y: 0 }, 20, [riser(100, 0)])
    expect(end).toEqual({ x: -100, y: 0 })
  })

  it("WC-01g: диагональная стена останавливается в касании, а не проходит насквозь", () => {
    const end = limitNewWall({ x: 0, y: 0 }, { x: 300, y: 300 }, 10, [riser(150, 150, 20)])
    expect(end).not.toBeNull()
    const e = end ?? { x: NaN, y: NaN }
    // остановка раньше центра коммуникации и на прямой от начала
    expect(e.x).toBeLessThan(150)
    expect(e.x).toBeCloseTo(e.y, 6)
    // дальше по прямой тело уже налагается: небольшой запас не нарушает
    const before = [w(0, 0, 10, 10, "n", 10)]
    expect(violatesCommunications(before, [w(0, 0, e.x, e.y, "n", 10)], [riser(150, 150, 20)])).toBe(false)
    expect(violatesCommunications(before, [w(0, 0, e.x + 1, e.y + 1, "n", 10)], [riser(150, 150, 20)])).toBe(true)
  })
})

describe("начальный квадрат установки", () => {
  const sq = (x1: number, y1: number, x2: number, y2: number) => [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]

  it("WC-02: квадрат поверх воздуховода недопустим", () => {
    expect(squareAllowed(sq(190, 190, 210, 210), [duct(215, 200)])).toBe(false)
  })

  it("WC-02b: квадрат вдали и квадрат в касании допустимы", () => {
    expect(squareAllowed(sq(0, 0, 20, 20), [duct(215, 200)])).toBe(true)
    expect(squareAllowed(sq(180, 190, 200, 210), [duct(215, 200)])).toBe(true)
  })

  it("WC-02c: граница допуска 0,009 / 0,011", () => {
    expect(squareAllowed(sq(180.009, 190, 200.009, 210), [duct(215, 200)])).toBe(true)
    expect(squareAllowed(sq(180.011, 190, 200.011, 210), [duct(215, 200)])).toBe(false)
  })

  it("WC-02d: без коммуникаций допустим", () => {
    expect(squareAllowed(sq(0, 0, 20, 20), [])).toBe(true)
  })

  it("WC-02e: квадрат, повёрнутый к осям (по грани диагональной стены), проверяется по своим вершинам", () => {
    const rotated = [
      { x: 100, y: 90 },
      { x: 110, y: 100 },
      { x: 100, y: 110 },
      { x: 90, y: 100 },
    ]
    expect(squareAllowed(rotated, [riser(100, 100, 4)])).toBe(false)
    expect(squareAllowed(rotated, [riser(130, 100, 4)])).toBe(true)
  })
})

describe("правки существующих стен (EditMode.communications)", () => {
  const duct0 = duct(215, 200) // x 200…230, y 190…210

  it("WC-04: перемещение стены M (0,200)–(100,200) на (150,0) останавливается: ось (100,200)–(200,200)", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const v = moveWallsBounded([M], [M], { x: 150, y: 0 }, { ...FREE, communications: [duct0] })
    expectPoint(v, 100, 0, 4)
    expectPoint(M.a, 100, 200, 4)
    expectPoint(M.b, 200, 200, 4)
  })

  it("WC-04b: большой шаг не проносит стену сквозь воздуховод", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const v = moveWallsBounded([M], [M], { x: 400, y: 0 }, { ...FREE, communications: [duct0] })
    expectPoint(v, 100, 0, 4)
    expectPoint(M.b, 200, 200, 4)
  })

  it("WC-04c: скольжение вдоль препятствия: запрос (150, 5) — составляющая по y применена", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const v = moveWallsBounded([M], [M], { x: 150, y: 5 }, { ...FREE, communications: [duct0] })
    expectPoint(v, 100, 5, 4)
    expectPoint(M.b, 200, 205, 4)
  })

  it("WC-04d: без коммуникаций в режиме стена проходит (регрессия)", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const v = moveWallsBounded([M], [M], { x: 150, y: 0 }, FREE)
    expectPoint(v, 150, 0, 4)
  })

  it("WC-07: групповое перетаскивание ограничено по наименее свободной стене", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const N = w(0, 300, 100, 300, "N", 10)
    const v = moveWallsBounded([M, N], [M, N], { x: 150, y: 0 }, { ...FREE, communications: [duct0] })
    expectPoint(v, 100, 0, 4)
    expectPoint(N.a, 100, 300, 4)
    expectPoint(N.b, 200, 300, 4)
  })

  it("WC-08: перетаскивание конца останавливается в касании: (300,200) → (200,200)", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const end = moveEndpointBounded([M], M, "b", { x: 300, y: 200 }, { ...FREE, communications: [duct0] })
    expectPoint(end, 200, 200, 4)
    expectPoint(M.b, 200, 200, 4)
  })

  it("WC-09: ввод длины 300 укорачивается до касания: 200, поле показывает фактическую длину", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const r = resizeWallBounded([M], M, 300, { ...FREE, communications: [duct0] })
    expect(r).toEqual({ kind: "applied", lengthCm: expect.closeTo(200, 4) })
    expectPoint(M.b, 200, 200, 4)
  })

  it("WC-09b: ввод длины, при которой нет наложения, применяется полностью", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const r = resizeWallBounded([M], M, 150, { ...FREE, communications: [duct0] })
    expect(r).toEqual({ kind: "applied", lengthCm: 150 })
  })

  it("WC-09c: ввод длины у стены, уже стоящей в касании, — отказ без изменения", () => {
    const M = w(0, 200, 200, 200, "M", 10)
    const r = resizeWallBounded([M], M, 300, { ...FREE, communications: [duct0] })
    expect(r.kind).toBe("rejected")
    expectPoint(M.b, 200, 200, 4)
  })

  it("WC-10: собственная стена «Монтажа» среди остатков — тот же предел (остаток и собственная стена вместе)", () => {
    const remnant = w(0, 0, 0, 300, "w1~0", 20)
    const own = w(50, 100, 150, 100, "n1", 10)
    const r = riser(180, 100, 20) // левый край 170
    const v = moveWallsBounded([remnant, own], [own], { x: 100, y: 0 }, { ...FREE, communications: [r] })
    expectPoint(v, 20, 0, 4)
    expectPoint(own.b, 170, 100, 4)
    expectPoint(remnant.a, 0, 0, 9)
  })

  it("WC-11: наложение из документа не углубляется: вглубь — остановка, из наложения — свободно", () => {
    // M заходит в воздуховод на 5 см (конец b = 205)
    const M = w(150, 200, 205, 200, "M", 10)
    const deeper = moveWallsBounded([M], [M], { x: 30, y: 0 }, { ...FREE, communications: [duct0] })
    expectPoint(deeper, 0, 0, 4)
    expectPoint(M.b, 205, 200, 4)
    const out = moveWallsBounded([M], [M], { x: -30, y: 0 }, { ...FREE, communications: [duct0] })
    expectPoint(out, -30, 0, 4)
  })

  it("WC-12: ограничения проёмов и коммуникаций действуют вместе", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const v = moveWallsBounded([M], [M], { x: 150, y: 0 }, { ...FREE, communications: [duct(215, 200)], doorways: [] })
    expectPoint(v, 100, 0, 4)
  })

  it("WC-13: групповое перетаскивание: препятствие у второй по порядку стены ограничивает всю группу — в обоих порядках", () => {
    const dN = duct(215, 300) // мешает только N (y 290…310)
    for (const order of ["MN", "NM"]) {
      const M = w(0, 200, 100, 200, "M", 10)
      const N = w(0, 300, 100, 300, "N", 10)
      const group = order === "MN" ? [M, N] : [N, M]
      const v = moveWallsBounded([M, N], group, { x: 150, y: 0 }, { ...FREE, communications: [dN] })
      expectPoint(v, 100, 0, 4)
      expectPoint(M.b, 200, 200, 4)
      expectPoint(N.b, 200, 300, 4)
    }
  })

  it("WC-14: стена, увлекаемая перемещаемой (ножка на грани), упирается в коммуникацию: перемещаемая стена свободна, правка ограничена", () => {
    // H (0,0)–(0,400) двигают вправо; ножка S (10,200)–(110,200) следует целиком; воздуховод x 160…190 стоит на пути конца S,
    // сама H (x −10…10 → дальше) его не задевает (y ножки 195…205, воздуховод 190…210)
    const { walls, H, S } = sceneTS()
    const v = moveWallsBounded(walls, [H], { x: 100, y: 0 }, { ...FREE, communications: [duct(175, 200)] })
    expectPoint(v, 50, 0, 4)
    expectWall(H, 50, 0, 50, 400, 4)
    expectWall(S, 60, 200, 160, 200, 4)
  })

  it("WC-14b: то же без коммуникации — правка не ограничена (ножка следует на весь вектор)", () => {
    const { walls, H, S } = sceneTS()
    const v = moveWallsBounded(walls, [H], { x: 100, y: 0 }, FREE)
    expectPoint(v, 100, 0, 6)
    expectWall(S, 110, 200, 210, 200, 6)
    expectWall(H, 100, 0, 100, 400, 6)
  })

  it("WC-15: орто-растяжение: боковая стена комнаты, чей конец растягивается следом за верхней, упирается в коммуникацию — верхняя свободна", () => {
    // воздуховод x 301…320, y −40…−20: тело верхней стены (x 0…300) его не задевает, правая стена (x 290…310) — задевает при выходе её конца выше y = −20
    const d = duct(310.5, -30, 19, 20)
    for (const mode of [ORTHO, FREE]) {
      const { walls, top, right, left } = sceneCR()
      const v = moveWallsBounded(walls, [top], { x: 0, y: -50 }, { ...mode, communications: [d] })
      expectPoint(v, 0, -20, 4)
      expectWall(top, 0, -20, 300, -20, 4)
      expectWall(right, 300, -20, 300, 200, 4)
      expectWall(left, 0, 200, 0, -20, 4)
    }
  })

  it("WC-15b: без коммуникации верхняя стена уходит на весь вектор (регрессия сцены)", () => {
    const { walls, top, right } = sceneCR()
    expectPoint(moveWallsBounded(walls, [top], { x: 0, y: -50 }, { ...ORTHO }), 0, -50, 6)
    expectWall(right, 300, -50, 300, 200, 6)
  })

  it("WC-15c: орто и конец стены, увлекаемой растяжением: тот же предел при перетаскивании конца", () => {
    const { walls, right } = sceneCR()
    const d = duct(310.5, -30, 19, 20)
    const end = moveEndpointBounded(walls, right, "a", { x: 300, y: -50 }, { ...ORTHO, communications: [d] })
    expectPoint(end, 300, -20, 4)
  })

  it("WC-16: сдвиг стрелкой шагом 10 см: многократные шаги не накапливают наложение, в упоре стена стоит", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const d = duct(215, 200) // x 200…230
    const mode = { ...FREE, communications: [d] }
    const applied: number[] = []
    for (let i = 0; i < 14; i++) {
      const v = moveWallsBounded([M], [M], { x: 10, y: 0 }, mode)
      applied.push(v.x)
      expect(wallOverlapDepth(d, M)).toBeLessThanOrEqual(0.01)
    }
    expect(applied.slice(0, 10).every((x) => Math.abs(x - 10) <= 1e-4)).toBe(true)
    expect(applied.slice(10).every((x) => Math.abs(x) <= 1e-4)).toBe(true)
    expectPoint(M.b, 200, 200, 4)
  })

  it("WC-16b: шаг не по размеру зазора укорачивается до касания: 15 см × 7 → последний шаг 10", () => {
    const M = w(0, 200, 100, 200, "M", 10)
    const d = duct(215, 200)
    const mode = { ...FREE, communications: [d] }
    const steps = Array.from({ length: 8 }, () => moveWallsBounded([M], [M], { x: 15, y: 0 }, mode).x)
    expect(steps.slice(0, 6).every((x) => Math.abs(x - 15) <= 1e-4)).toBe(true) // 100 → 190
    expect(steps[6]).toBeCloseTo(10, 3) // 190 → 200
    expect(steps[7]).toBeCloseTo(0, 3) // в упоре
    expectPoint(M.b, 200, 200, 4)
  })
})
