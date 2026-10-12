import { describe, expect, it } from "vitest"
import { DEFAULT_DUCT_CM, DEFAULT_RISER_DIAMETER_CM, ghostPosition, moveLimited } from "./placement"
import { communicationViolation } from "./geometry"
import { duct, expectPoint, riser, room, w } from "./communications.test-utils"

// change add-communications: параметры новых коммуникаций, призрак установки, перемещение
// (spec communications «Группа «Коммуникации» и инструменты…», «Установка коммуникации»,
// «Выделение, перемещение и удаление коммуникации»; test-plan CT-*, CP-*, CS-04).

describe("параметры новых коммуникаций", () => {
  it("CT-01: по умолчанию стояк Ø 11 см, воздуховод 30 × 20 см (ширина × глубина)", () => {
    expect(DEFAULT_RISER_DIAMETER_CM).toBe(11)
    expect(DEFAULT_DUCT_CM).toEqual({ width: 30, depth: 20 })
  })
})

describe("призрак установки", () => {
  it("CP-01: центр — курсор, округлённый до сантиметра по каждой оси", () => {
    const g = ghostPosition(riser(0, 0, 11), { x: 203.4, y: 117.6 }, [], [])
    expect(g).not.toBeNull()
    expectPoint({ x: g?.x ?? NaN, y: g?.y ?? NaN }, 203, 118, 9)
    expect(g?.kind).toBe("riser")
  })

  it("CP-01b: размер призрака — размер прототипа; воздуховод не теряет ширину и глубину", () => {
    const g = ghostPosition(duct(0, 0, 40, 25), { x: 50, y: 60 }, [], [])
    expect(g?.kind).toBe("duct")
    if (g?.kind === "duct") {
      expect(g.widthCm).toBe(40)
      expect(g.depthCm).toBe(25)
    }
    expect(g?.x).toBe(50)
    expect(g?.y).toBe(60)
  })

  it("CP-01c: округление .5 и отрицательные координаты — к ближайшему целому", () => {
    const g = ghostPosition(riser(0, 0, 10), { x: -20.4, y: 99.6 }, [], [])
    expect(g?.x).toBe(-20)
    expect(g?.y).toBe(100)
  })

  it("CP-02: наложение на левую стену на 3 см — призрак сдвинут вправо на 3 см до касания", () => {
    const { walls } = room()
    const g = ghostPosition(riser(0, 0, 10), { x: 12, y: 100 }, walls, [])
    expectPoint({ x: g?.x ?? NaN, y: g?.y ?? NaN }, 15, 100, 4)
  })

  it("CP-02b: без наложения призрак стоит там, где курсор (в том числе в касании)", () => {
    const { walls } = room()
    const g = ghostPosition(riser(0, 0, 10), { x: 15, y: 100 }, walls, [])
    expectPoint({ x: g?.x ?? NaN, y: g?.y ?? NaN }, 15, 100, 9)
  })

  it("CP-02c: наложение на верхнюю стену — сдвиг вниз; на нижнюю — вверх; на правую — влево", () => {
    const { walls } = room()
    const down = ghostPosition(riser(0, 0, 10), { x: 100, y: 12 }, walls, [])
    expectPoint({ x: down?.x ?? NaN, y: down?.y ?? NaN }, 100, 15, 4)
    const up = ghostPosition(riser(0, 0, 10), { x: 100, y: 387 }, walls, [])
    expectPoint({ x: up?.x ?? NaN, y: up?.y ?? NaN }, 100, 385, 4)
    const left = ghostPosition(riser(0, 0, 10), { x: 288, y: 100 }, walls, [])
    expectPoint({ x: left?.x ?? NaN, y: left?.y ?? NaN }, 285, 100, 4)
  })

  it("CP-03: нет места — призрака нет (комната внутри 8×8 меньше стояка Ø10)", () => {
    // тела: T y -10…10, B y 18…38, L x -10…10, R x 18…38 — свободный квадрат 8×8
    const walls = [w(0, 0, 28, 0, "T"), w(0, 28, 28, 28, "B"), w(0, 0, 0, 28, "L"), w(28, 0, 28, 28, "R")]
    expect(ghostPosition(riser(0, 0, 10), { x: 14, y: 14 }, walls, [])).toBeNull()
  })

  it("CP-04: наложение на другую коммуникацию — призрак сдвинут до касания по ближайшей оси", () => {
    const others = [riser(100, 100, 10, "r9")]
    const g = ghostPosition(riser(0, 0, 10), { x: 103, y: 100 }, [], others)
    expectPoint({ x: g?.x ?? NaN, y: g?.y ?? NaN }, 110, 100, 4)
  })

  it("CP-05: призрак никогда не налагается на стены и коммуникации сверх допуска", () => {
    const { walls } = room()
    const others = [duct(150, 200, 40, 40, "d9")]
    for (let x = 0; x <= 300; x += 7)
      for (let y = 0; y <= 400; y += 9) {
        const g = ghostPosition(riser(0, 0, 11), { x, y }, walls, others)
        if (g) expect(communicationViolation(g, walls, others), `${x},${y}`).toBeLessThanOrEqual(0.01)
      }
  })
})

describe("перемещение", () => {
  it("CS-04: стояк тащат на (−200, 0) — остановка в касании с левой стеной, не по ту сторону", () => {
    const { walls } = room()
    const p = moveLimited(riser(100, 100), { x: -100, y: 100 }, walls, [])
    expectPoint(p, 15, 100, 4)
  })

  it("CS-04b: большой шаг не проносит сквозь стояк-препятствие и стену (вверх)", () => {
    const { walls } = room()
    expectPoint(moveLimited(riser(100, 100), { x: 100, y: -300 }, walls, []), 100, 15, 4)
    expectPoint(moveLimited(riser(100, 100), { x: 100, y: 900 }, walls, []), 100, 385, 4)
  })

  it("CS-04c: без скольжения — на косом запросе положение на прямой от начала к цели", () => {
    const { walls } = room()
    // от (100,100) к (−200,160): левый край касается x = 10 при центре x = 15, t = 85/300
    const p = moveLimited(riser(100, 100), { x: -200, y: 160 }, walls, [])
    expectPoint(p, 15, 100 + (85 / 300) * 60, 3)
  })

  it("CS-04d: свободное место — положение равно запрошенному", () => {
    const { walls } = room()
    expectPoint(moveLimited(riser(100, 100), { x: 200, y: 250 }, walls, []), 200, 250, 9)
  })

  it("CS-04e: остановка в касании с другой коммуникацией", () => {
    // воздуховод 30×20 в (50,100): правый край 65; стояк Ø10 слева от него остановится центром в 70
    const p = moveLimited(riser(100, 100), { x: 0, y: 100 }, [], [duct(50, 100, 30, 20, "d9")])
    expectPoint(p, 70, 100, 4)
  })

  it("CS-04f: коммуникация, уже стоящая в касании, при запросе вглубь стены не смещается", () => {
    const { walls } = room()
    expectPoint(moveLimited(riser(15, 100), { x: 0, y: 100 }, walls, []), 15, 100, 4)
  })

  it("CS-04g: отход от стены разрешён без задержки", () => {
    const { walls } = room()
    expectPoint(moveLimited(riser(15, 100), { x: 60, y: 100 }, walls, []), 60, 100, 9)
  })

  it("CS-04h: наложение из документа не углубляется, но можно выйти", () => {
    const walls = [w(87, 0, 87, 300, "V")] // тело x 77…97, стояк (100,100) налагается на 2 см
    const deeper = moveLimited(riser(100, 100), { x: 90, y: 100 }, walls, [])
    expect(communicationViolation({ ...riser(100, 100), x: deeper.x, y: deeper.y }, walls, [])).toBeLessThanOrEqual(2 + 1e-6)
    expect(deeper.x).toBeCloseTo(100, 6)
    const out = moveLimited(riser(100, 100), { x: 150, y: 100 }, walls, [])
    expectPoint(out, 150, 100, 9)
  })
})
