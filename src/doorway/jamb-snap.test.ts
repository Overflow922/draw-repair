import { describe, expect, it } from "vitest"
import type { Point, WallElement } from "../types"
import { door, w } from "./doorway.test-utils"
import { win } from "./window.test-utils"
import { alignAlongFace, jambLines, snapToJambs } from "./jamb-snap"
import type { JambCandidate, JambLine } from "./jamb-snap"

// change snap-wall-to-opening-jambs: линии откосов и прилипание квадрата стороной к линии
// (spec wall-drawing «Привязка к плоскости откоса проёма»). Эталоны — из спецификации и геометрии сцен.

const RADIUS = 12
const STEP = 10
const T = 20
const ANY = (): boolean => true

const W0 = w(0, 0, 500, 0, "W")
const DOOR = door("W", "a", 100) // откосы x = 100 и x = 190
const lines = (...elements: WallElement[]): JambLine[] => jambLines([W0], elements)
const snap = (p: Point, ls: JambLine[], accept: (c: { point: Point; base: Point; normal: Point }) => boolean = ANY) =>
  snapToJambs(p, ls, T, RADIUS, STEP, accept)

const near = (p: Point, x: number, y: number): void => {
  expect(p.x).toBeCloseTo(x, 6)
  expect(p.y).toBeCloseTo(y, 6)
}

describe("jambLines", () => {
  it("JL-1: у проёма две линии — по откосам, перпендикулярно оси стены", () => {
    const ls = lines(DOOR)
    expect(ls).toHaveLength(2)
    const xs = ls.map((l) => l.origin.x).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(100, 6)
    expect(xs[1]).toBeCloseTo(190, 6)
    for (const l of ls) {
      expect(Math.abs(l.dir.x)).toBeCloseTo(0, 9)
      expect(Math.abs(l.dir.y)).toBeCloseTo(1, 9)
    }
  })

  it("JL-2: окно задаёт такие же линии", () => {
    const ls = lines(win("W", "a", 100, 90))
    expect(ls.map((l) => l.origin.x).sort((a, b) => a - b)).toEqual([100, 190])
  })

  it("JL-3: элемент без опорной стены линий не задаёт", () => {
    expect(lines(door("ghost", "a", 100))).toHaveLength(0)
  })

  it("JL-4: проём с привязкой b — те же откосы по положению", () => {
    // длина 500, привязка b, 310 см, ширина 90: откосы 100 и 190
    expect(lines(door("W", "b", 310)).map((l) => l.origin.x).sort((a, b) => a - b)).toEqual([100, 190])
  })
})

describe("snapToJambs", () => {
  it("JS-1: курсор справа от линии x = 100 — левая сторона квадрата на линии, вершина (110, −60)", () => {
    const r = snap({ x: 104, y: -60 }, lines(DOOR))
    expect(r).not.toBeNull()
    near(r!.point, 110, -60)
    near(r!.base, 100, -60)
    expect(r!.normal.x).toBeCloseTo(1, 9)
    expect(r!.normal.y).toBeCloseTo(0, 9)
  })

  it("JS-2: ближайшая из двух сторон — слева, вершина (90, −60)", () => {
    const r = snap({ x: 96, y: -60 }, lines(DOOR))
    near(r!.point, 90, -60)
    expect(r!.normal.x).toBeCloseTo(-1, 9)
  })

  it("JS-3: вне радиуса привязки — null", () => {
    expect(snap({ x: 130, y: -60 }, lines(DOOR))).toBeNull()
  })

  it("JS-4: граница радиуса включительно: сторона квадрата в 12 см от линии — привязка есть", () => {
    // сторона квадрата курсора — x − 10 = 112 → до линии 12
    expect(snap({ x: 122, y: -60 }, lines(DOOR))).not.toBeNull()
    expect(snap({ x: 122.01, y: -60 }, lines(DOOR))).toBeNull()
  })

  it("JS-5: на самой линии — позиция снаружи проёма (x = 90 у откоса 100)", () => {
    const r = snap({ x: 100, y: -60 }, lines(DOOR))
    near(r!.point, 90, -60)
  })

  it("JS-6: положение вдоль вертикальной линии — по мировой сетке", () => {
    near(snap({ x: 104, y: -63 }, lines(DOOR))!.point, 110, -60)
    near(snap({ x: 104, y: -67 }, lines(DOOR))!.point, 110, -70)
  })

  it("JS-7: у горизонтальной линии положение вдоль неё — по сетке, вершина на 10 от линии", () => {
    // стена V вертикальная, проём откосы y = −200 и −110
    const v = w(-300, -400, -300, 400, "V")
    const ls = jambLines([v], [door("V", "a", 200, 90, 210, "dv")])
    near(snap({ x: 104, y: -204 }, ls)!.point, 100, -210)
  })

  it("JS-8: две перпендикулярные линии — вершина в пересечении со сдвигом от обеих", () => {
    const v = w(-300, -400, -300, 400, "V")
    const ls = jambLines([W0, v], [DOOR, door("V", "a", 200, 90, 210, "dv")])
    const r = snap({ x: 104, y: -204 }, ls)
    near(r!.point, 110, -210)
    expect(r!.tracks).toHaveLength(2)
  })

  it("JS-9: отклонённая позиция — пробуется вторая сторона той же линии", () => {
    // правая позиция (x 100…120) запрещена, левая (x 80…100) — нет; курсор на линии
    const r = snap({ x: 100, y: -60 }, lines(DOOR), (c) => c.normal.x < 0)
    near(r!.point, 90, -60)
    const none = snap({ x: 100, y: -60 }, lines(DOOR), () => false)
    expect(none).toBeNull()
  })

  it("JS-10: линия — от откоса на грани стены до дальнего края квадрата", () => {
    const r = snap({ x: 104, y: -60 }, lines(DOOR))
    expect(r!.tracks).toHaveLength(1)
    const [t] = r!.tracks
    near(t.from, 100, -10)
    near(t.to, 100, -70)
  })

  it("JS-11: квадрат под стеной — линия от грани y = 10", () => {
    const r = snap({ x: 104, y: 60 }, lines(DOOR))
    const [t] = r!.tracks
    near(t.from, 100, 10)
    near(t.to, 100, 70)
  })

  it("JS-12: наклонная опорная стена — вершина на 10 от линии, квадрат стороной вдоль неё, вдоль линии кратно шагу", () => {
    const s = Math.SQRT1_2
    const host = w(0, 0, 300, 300, "D")
    const d = { x: s, y: s } // ось
    const u = { x: -s, y: s } // направление линии (перпендикуляр к оси)
    const j = { x: 100 * s, y: 100 * s } // откос на t = 100
    const ls = jambLines([host], [door("D", "a", 100)])
    const cursor = { x: j.x + u.x * 80 + d.x * 4, y: j.y + u.y * 80 + d.y * 4 }
    const r = snap(cursor, ls)
    expect(r).not.toBeNull()
    const rel = { x: r!.point.x - j.x, y: r!.point.y - j.y }
    expect(rel.x * d.x + rel.y * d.y).toBeCloseTo(10, 6)
    expect(rel.x * u.x + rel.y * u.y).toBeCloseTo(80, 6)
    expect(Math.abs(r!.normal.x * d.x + r!.normal.y * d.y)).toBeCloseTo(1, 9)
  })

  it("JS-13: входные линии не изменяются", () => {
    const ls = lines(DOOR)
    const copy = JSON.parse(JSON.stringify(ls))
    snap({ x: 104, y: -60 }, ls)
    expect(JSON.parse(JSON.stringify(ls))).toEqual(copy)
  })

  it("JS-15: линия — бесконечная в обе стороны (участок за стеной вне квадрата не отсекается)", () => {
    near(snap({ x: 104, y: 400 }, lines(DOOR))!.point, 110, 400)
  })

  it("JS-14: из параллельных линий берётся ближайшая — откос x = 190", () => {
    const r = snap({ x: 186, y: -60 }, lines(DOOR))
    // стороны квадрата курсора x = 176 и 196: до линии 190 — 14 и 6; ближайшая — правая, квадрат уходит влево от линии
    near(r!.base, 190, -60)
    near(r!.point, 180, -60)
  })
})

// квадрат, прилипший к грани горизонтальной стены F сверху (y = −110): нормаль (0, −1), вершина и опора — на грани
const onFaceF = (x: number): JambCandidate => ({ point: { x, y: -110 }, base: { x, y: -110 }, normal: { x: 0, y: -1 } })
const align = (c: JambCandidate, ls: JambLine[], accept: (c: JambCandidate) => boolean = ANY) => alignAlongFace(c, ls, T, RADIUS, accept)

describe("alignAlongFace", () => {
  it("AF-1: квадрат у грани сдвигается вдоль неё до линии откоса: (104, −110) → (110, −110), вершина остаётся на грани", () => {
    const r = align(onFaceF(104), lines(DOOR))
    expect(r).not.toBeNull()
    near(r!.point, 110, -110)
    near(r!.base, 110, -110)
    expect(r!.normal).toEqual({ x: 0, y: -1 })
  })

  it("AF-2: пунктир — от откоса на грани W до дальнего края стороны квадрата: (100, −10) — (100, −130)", () => {
    const [t] = align(onFaceF(104), lines(DOOR))!.tracks
    near(t.from, 100, -10)
    near(t.to, 100, -130)
  })

  it("AF-3: вне радиуса привязки — сдвига нет", () => {
    expect(align(onFaceF(130), lines(DOOR))).toBeNull()
  })

  it("AF-4: ближайшая из двух сторон — слева от линии: (96, −110) → (90, −110)", () => {
    near(align(onFaceF(96), lines(DOOR))!.point, 90, -110)
  })

  it("AF-5: на самой линии — позиция снаружи проёма: (100, −110) → (90, −110)", () => {
    near(align(onFaceF(100), lines(DOOR))!.point, 90, -110)
  })

  it("AF-6: позиция снаружи отклонена — берётся вторая сторона линии", () => {
    near(align(onFaceF(100), lines(DOOR), (c) => c.point.x > 100)!.point, 110, -110)
    expect(align(onFaceF(100), lines(DOOR), () => false)).toBeNull()
  })

  it("AF-7: линия, параллельная грани, вдоль грани не сдвигает: квадрат у вертикальной грани, линии x = 100 и 190 вертикальны", () => {
    const onVerticalFace: JambCandidate = { point: { x: 95, y: -60 }, base: { x: 95, y: -60 }, normal: { x: 1, y: 0 } }
    expect(align(onVerticalFace, lines(DOOR))).toBeNull()
  })

  it("AF-8: у вертикальной грани сдвиг идёт по вертикали к горизонтальной линии: (90, −204) → (90, −210)", () => {
    const v = w(-300, -400, -300, 400, "V")
    const ls = jambLines([v], [door("V", "a", 200, 90, 210, "dv")])
    const onVerticalFace: JambCandidate = { point: { x: 90, y: -204 }, base: { x: 90, y: -204 }, normal: { x: 1, y: 0 } }
    const r = align(onVerticalFace, ls)
    near(r!.point, 90, -210)
    near(r!.base, 90, -210)
  })

  it("AF-9: входные данные не изменяются", () => {
    const c = onFaceF(104)
    const copy = JSON.parse(JSON.stringify(c))
    align(c, lines(DOOR))
    expect(JSON.parse(JSON.stringify(c))).toEqual(copy)
  })
})