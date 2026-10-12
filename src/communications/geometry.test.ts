import { describe, expect, it } from "vitest"
import { communicationViolation, overlapDepth, slideReach, wallOverlapDepth } from "./geometry"
import type { Direction } from "./geometry"
import { duct, expectPoint, riser, room, w } from "./communications.test-utils"

// change add-communications: модель, расстояния до ближайших стен и инвариант размещения
// (spec communications «Стояк и воздуховод», «Расстояния до ближайших стен», «Инвариант размещения коммуникации»;
// test-plan CM-*, CD-*, CI-*). Ожидания — по геометрии сцен.

const DIRS: Direction[] = ["left", "right", "up", "down"]
const reach = (c: ReturnType<typeof riser> | ReturnType<typeof duct>, dir: Direction, walls: ReturnType<typeof room>["walls"]): number | null =>
  slideReach(c, dir, walls)?.distanceCm ?? null

describe("расстояния до ближайших стен", () => {
  it("CD-01: стояк Ø10 в комнате — влево 85, вправо 185, вверх 85, вниз 285", () => {
    const { walls } = room()
    const r = riser(100, 100)
    expect(reach(r, "left", walls)).toBeCloseTo(85, 6)
    expect(reach(r, "right", walls)).toBeCloseTo(185, 6)
    expect(reach(r, "up", walls)).toBeCloseTo(85, 6)
    expect(reach(r, "down", walls)).toBeCloseTo(285, 6)
  })

  it("CD-01: точка касания — на грани стены на линии центра", () => {
    const { walls } = room()
    const r = riser(100, 100)
    expectPoint(slideReach(r, "left", walls)?.contact ?? { x: NaN, y: NaN }, 10, 100)
    expectPoint(slideReach(r, "right", walls)?.contact ?? { x: NaN, y: NaN }, 290, 100)
    expectPoint(slideReach(r, "up", walls)?.contact ?? { x: NaN, y: NaN }, 100, 10)
    expectPoint(slideReach(r, "down", walls)?.contact ?? { x: NaN, y: NaN }, 100, 390)
  })

  it("CD-01b: воздуховод 30×20 в комнате — расстояния считаются от краёв, не от центра", () => {
    const { walls } = room()
    const d = duct(100, 100)
    expect(reach(d, "left", walls)).toBeCloseTo(75, 6)
    expect(reach(d, "right", walls)).toBeCloseTo(175, 6)
    expect(reach(d, "up", walls)).toBeCloseTo(80, 6)
    expect(reach(d, "down", walls)).toBeCloseTo(280, 6)
  })

  it("CD-02: стена перед частью стороны воздуховода — вверх 40, остальных направлений нет", () => {
    const F = w(120, 0, 120, 50, "F")
    const d = duct(100, 100, 40, 20)
    expect(reach(d, "up", [F])).toBeCloseTo(40, 6)
    const contact = slideReach(d, "up", [F])?.contact
    expect(contact?.y).toBeCloseTo(50, 6)
    expect(contact?.x).toBeGreaterThanOrEqual(110 - 1e-6)
    expect(contact?.x).toBeLessThanOrEqual(120 + 1e-6)
    expect(slideReach(d, "left", [F])).toBeNull()
    expect(slideReach(d, "right", [F])).toBeNull()
    expect(slideReach(d, "down", [F])).toBeNull()
  })

  it("CD-02b: стена, не перекрывающая сторону воздуховода по ширине, расстояния не даёт", () => {
    const F = w(140, 0, 140, 50, "F") // тело x 130…150, правее стороны 80…120
    expect(slideReach(duct(100, 100, 40, 20), "up", [F])).toBeNull()
  })

  it("CD-03: нет стен в направлении — расстояния нет", () => {
    expect(slideReach(riser(100, 100), "right", [])).toBeNull()
    const L = w(0, 0, 0, 400, "L")
    expect(slideReach(riser(100, 100), "right", [L])).toBeNull()
    expect(reach(riser(100, 100), "left", [L])).toBeCloseTo(85, 6)
  })

  it("CD-03b: стена за коммуникацией (в противоположной стороне) не считается", () => {
    const { walls } = room()
    for (const dir of DIRS) expect(slideReach(riser(100, 100), dir, walls)).not.toBeNull()
    expect(reach(riser(100, 100), "right", [w(0, 0, 0, 400, "L")])).toBeNull()
  })

  it("CD-04: касание — расстояние 0", () => {
    const { walls } = room()
    expect(reach(riser(15, 100), "left", walls)).toBeCloseTo(0, 6)
    expect(reach(duct(100, 20), "up", walls)).toBeCloseTo(0, 6)
  })

  it("CD-05: круг касается угла стены, а не описанного квадрата — расстояние вправо 41,3397", () => {
    const K = w(60, 5, 60, 60, "K") // тело x 50…70, y 5…60
    const r = riser(0, 0, 20)
    expect(reach(r, "right", [K])).toBeCloseTo(50 - Math.sqrt(75), 4)
    expectPoint(slideReach(r, "right", [K])?.contact ?? { x: NaN, y: NaN }, 50, 5, 3)
  })

  it("CD-05b: круг не задевает стену, угол которой лежит вне полосы сдвига", () => {
    const K = w(60, 12, 60, 60, "K") // угол (50, 12) на 2 см вне полосы |y| ≤ 10
    expect(slideReach(riser(0, 0, 20), "right", [K])).toBeNull()
  })

  it("CD-06: расстояние берётся до тела стены целиком — стена, у которой есть проём в этом месте, даёт то же расстояние", () => {
    // расчёт зависит только от стен (элементы стен ему не передаются): L с проёмом против стояка — всё равно 85
    const { walls } = room()
    expect(reach(riser(100, 100), "left", walls)).toBeCloseTo(85, 6)
    expect(slideReach(riser(100, 100), "left", walls)?.contact.x).toBeCloseTo(10, 6)
  })

  it("CD-07: направления не перепутаны — стена только слева даёт только «влево»", () => {
    const L = w(0, 0, 0, 400, "L")
    const r = riser(100, 100)
    expect(reach(r, "left", [L])).toBeCloseTo(85, 6)
    expect(reach(r, "up", [L])).toBeNull()
    expect(reach(r, "down", [L])).toBeNull()
    expect(reach(r, "right", [L])).toBeNull()
  })

  it("CD-08: ближайшая из нескольких стен в направлении", () => {
    const near = w(0, 0, 0, 400, "near") // грань x = 10
    const far = w(-100, 0, -100, 400, "far")
    expect(reach(riser(100, 100), "left", [far, near])).toBeCloseTo(85, 6)
    expect(reach(riser(100, 100), "left", [near, far])).toBeCloseTo(85, 6)
  })
})

describe("инвариант: глубина наложения", () => {
  it("CI-01: касание стены — нарушения нет", () => {
    const { walls } = room()
    expect(communicationViolation(riser(15, 100), walls, [])).toBeCloseTo(0, 9)
    expect(communicationViolation(duct(100, 20), walls, [])).toBeCloseTo(0, 9)
  })

  it("CI-02: воздуховод налагается на стену на 0,5 см — глубина 0,5", () => {
    const wall = w(75.5, 0, 75.5, 300, "V") // тело x 65,5…85,5; левый край воздуховода 85
    expect(wallOverlapDepth(duct(100, 100), wall)).toBeCloseTo(0.5, 6)
  })

  it("CI-02: касание грань к грани — глубина 0", () => {
    const wall = w(75, 0, 75, 300, "V") // тело x 65…85
    expect(wallOverlapDepth(duct(100, 100), wall)).toBeCloseTo(0, 9)
  })

  it("CI-02b: стояк Ø10, грань стены в 3 см от центра — глубина 2", () => {
    const wall = w(87, 0, 87, 300, "V") // тело x 77…97
    expect(wallOverlapDepth(riser(100, 100), wall)).toBeCloseTo(2, 6)
  })

  it("CI-02c: наложение на 0,009 и 0,011 см различимо: глубина совпадает с исходным значением", () => {
    expect(wallOverlapDepth(duct(100, 100), w(75.009, 0, 75.009, 300, "V"))).toBeCloseTo(0.009, 6)
    expect(wallOverlapDepth(duct(100, 100), w(75.011, 0, 75.011, 300, "V"))).toBeCloseTo(0.011, 6)
  })

  it("CI-02d: стена вне коммуникации — глубина 0", () => {
    expect(wallOverlapDepth(riser(100, 100), w(500, 0, 500, 300, "V"))).toBe(0)
  })

  it("CI-04: два стояка Ø10 с центрами в 8 см — наложение 2", () => {
    expect(overlapDepth(riser(0, 0), riser(8, 0, 10, "r1"))).toBeCloseTo(2, 6)
  })

  it("CI-04: два стояка в касании — 0, вдали — 0", () => {
    expect(overlapDepth(riser(0, 0), riser(10, 0, 10, "r1"))).toBeCloseTo(0, 9)
    expect(overlapDepth(riser(0, 0), riser(50, 0, 10, "r1"))).toBe(0)
  })

  it("CI-04b: стояк и воздуховод — глубина по ближайшей грани", () => {
    const d = duct(100, 100) // x 85…115
    expect(overlapDepth(riser(82, 100), d)).toBeCloseTo(2, 6)
    expect(overlapDepth(d, riser(82, 100))).toBeCloseTo(2, 6)
    expect(overlapDepth(riser(78, 100), d)).toBe(0)
  })

  it("CI-04c: два воздуховода 30×20 — наложение 10 по X, касание 0", () => {
    expect(overlapDepth(duct(100, 100), duct(120, 100, 30, 20, "d1"))).toBeCloseTo(10, 6)
    expect(overlapDepth(duct(100, 100), duct(130, 100, 30, 20, "d1"))).toBeCloseTo(0, 9)
  })

  it("CI-04d: два воздуховода со смещением по Y: перекрытие по Y 5 при полном по X → глубина 5; касание по Y — 0", () => {
    expect(overlapDepth(duct(100, 100), duct(100, 115, 30, 20, "d1"))).toBeCloseTo(5, 6) // y 90…110 и 105…125
    expect(overlapDepth(duct(100, 100), duct(100, 120, 30, 20, "d1"))).toBeCloseTo(0, 9)
    expect(overlapDepth(duct(100, 115, 30, 20, "d1"), duct(100, 100))).toBeCloseTo(5, 6)
  })

  it("CI-04e: диагональное перекрытие воздуховодов: по X 10, по Y 5 → глубина 5 (по меньшему), по X 5, по Y 10 → 5", () => {
    expect(overlapDepth(duct(100, 100), duct(120, 115, 30, 20, "d1"))).toBeCloseTo(5, 6)
    expect(overlapDepth(duct(100, 100), duct(125, 110, 30, 20, "d1"))).toBeCloseTo(5, 6)
  })

  it("CI-05: нарушение коммуникации — наибольшая глубина по стенам и другим коммуникациям", () => {
    const walls = [w(87, 0, 87, 300, "V")] // глубина 2 для стояка в (100,100)
    const others = [riser(106, 100, 10, "r1")] // центры в 6 см, глубина 4
    expect(communicationViolation(riser(100, 100), walls, [])).toBeCloseTo(2, 6)
    expect(communicationViolation(riser(100, 100), walls, others)).toBeCloseTo(4, 6)
    expect(communicationViolation(riser(100, 100), [], [])).toBe(0)
  })

  it("CI-05b: сама коммуникация среди others не считается наложением на себя", () => {
    const r = riser(100, 100)
    expect(communicationViolation(r, [], [r])).toBe(0)
  })
})
