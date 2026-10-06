import { describe, expect, it } from "vitest"
import type { Doorway, Wall } from "../types"
import { chainSegment } from "../wall-chain"
import type { ChainInput } from "../wall-chain"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "../wall-edit"
import { snapStartVertex } from "../wall-snap"
import { doorwayDistances, doorwayHolds, jambsT } from "./doorway-faces"
import { thicknessAllowed, violatesDoorways } from "./doorway-guard"
import { D0, UO, axisPoint, door, expectPoint, sceneF, sceneR, sceneRP, w } from "./doorway.test-utils"

// change add-doorway: правки и рисование стен не нарушают проёмы, проём следует за опорной стеной
// (spec wall-collision «Правки стен не нарушают проёмы», wall-drawing «Стык не создаётся внутри проёма»,
// doorway «Проём следует за опорной стеной»; design D1, D5, D6).
// Проёмы передаются ограничителю через EditMode.doorways; данные проёма правки стен не меняют.

const FREE = (doorways: Doorway[]): { ortho: false; doorways: Doorway[] } => ({ ortho: false, doorways })
const ORTHO = (doorways: Doorway[]): { ortho: true; doorways: Doorway[] } => ({ ortho: true, doorways })

const jambPoint = (d: Doorway, host: Wall, i: 0 | 1) => axisPoint(host, jambsT(d, host)[i])

function allHold(doorways: Doorway[], walls: Wall[]): void {
  for (const d of doorways) expect(doorwayHolds(d, walls)).toBe(true)
}

describe("проём следует за опорной стеной", () => {
  it("DG-01: перемещение стены на (0, 100) — проём на прежнем расстоянии", () => {
    const { walls, W } = sceneF()
    const d = D0()
    moveWallsBounded(walls, [W], { x: 0, y: 100 }, FREE([d]))
    expect(d).toEqual(D0())
    expectPoint(jambPoint(d, W, 0), 100, 100)
    expectPoint(jambPoint(d, W, 1), 190, 100)
  })

  it("DG-02: перемещение конца привязки a — откос сдвигается вместе с ним", () => {
    const { walls, W } = sceneF()
    const d = D0()
    moveEndpointBounded(walls, W, "a", { x: -50, y: 0 }, FREE([d]))
    expectPoint(W.a, -50, 0)
    expectPoint(jambPoint(d, W, 0), 50, 0)
  })

  it("DG-03: перемещение второго конца — откос на месте", () => {
    const { walls, W } = sceneF()
    const d = D0()
    moveEndpointBounded(walls, W, "b", { x: 600, y: 0 }, FREE([d]))
    expectPoint(W.b, 600, 0)
    expectPoint(jambPoint(d, W, 0), 100, 0)
  })

  it("DG-08: расстояние, заданное от b, сохраняется при правке конца a вместе с углом", () => {
    const { walls, L, W } = sceneR()
    const d: Doorway = { ...D0(), anchor: "b", offsetCm: 241 } // plus.b = 231 (см. DE-06)
    expect(doorwayDistances(d, walls)?.plus.b).toBeCloseTo(231, 3)
    moveWallsBounded(walls, [L], { x: -50, y: 0 }, FREE([d]))
    expectPoint(W.a, -50, 0)
    expect(doorwayDistances(d, walls)?.plus.b).toBeCloseTo(231, 3)
    allHold([d], walls)
  })

  it("DG-14: стрелка по стене с проёмом — стена сдвинута, проём на прежнем расстоянии привязки", () => {
    const { walls, W } = sceneR()
    const d = D0()
    moveWallsBounded(walls, [W], { x: 10, y: 0 }, FREE([d]))
    expect(d).toEqual(D0())
    expectPoint(jambPoint(d, W, 0), 110, 0)
    allHold([d], walls)
  })
})

describe("правки стен ограничиваются проёмами", () => {
  it("DG-04: укорочение стены останавливается у откоса", () => {
    const { walls, W } = sceneF()
    const d = D0()
    moveEndpointBounded(walls, W, "b", { x: 150, y: 0 }, FREE([d]))
    expect(W.b.x).toBeCloseTo(190, 3)
    expect(W.b.y).toBeCloseTo(0, 6)
    expect(doorwayDistances(d, walls)?.plus.b).toBeCloseTo(0, 3)
  })

  it("DG-05: ввод длины 120 укорачивается до 190", () => {
    const { walls, W } = sceneF()
    const r = resizeWallBounded(walls, W, 120, FREE([D0()]))
    expect(r.kind).toBe("applied")
    if (r.kind === "applied") expect(r.lengthCm).toBeCloseTo(190, 3)
    expect(W.b.x).toBeCloseTo(190, 3)
  })

  it("DG-05b: ввод длины, не задевающий проём, применяется полностью", () => {
    const { walls, W } = sceneF()
    expect(resizeWallBounded(walls, W, 300, FREE([D0()]))).toEqual({ kind: "applied", lengthCm: 300 })
  })

  it("DG-06: перегородка не заходит в проём — останавливается гранью у откоса", () => {
    const { walls, P } = sceneRP()
    const d = D0()
    const v = moveWallsBounded(walls, [P], { x: -200, y: 0 }, FREE([d]))
    expect(P.a.x).toBeCloseTo(195, 3)
    expect(P.b.x).toBeCloseTo(195, 3)
    expect(v.x).toBeCloseTo(-105, 3)
    allHold([d], walls)
  })

  it("DG-15: правка не перепрыгивает проём — допустимое конечное положение за проёмом не достигается", () => {
    const control = sceneRP()
    moveWallsBounded(control.walls, [control.P], { x: -280, y: 0 }, FREE([]))
    expect(control.P.a.x).toBeCloseTo(20, 3) // без проёма путь свободен до x = 20
    const { walls, P } = sceneRP()
    const d = D0()
    const v = moveWallsBounded(walls, [P], { x: -280, y: 0 }, FREE([d]))
    expect(P.a.x).toBeCloseTo(195, 3)
    expect(v.x).toBeCloseTo(-105, 3)
    allHold([d], walls)
  })

  it("DG-04b: укорочение до откоса и при орто", () => {
    const { walls, W } = sceneF()
    moveEndpointBounded(walls, W, "b", { x: 150, y: 0 }, ORTHO([D0()]))
    expect(W.b.x).toBeCloseTo(190, 3)
  })

  it("DG-07b: утолщение перегородки, касающейся откоса, не допускается", () => {
    const { walls, P } = sceneRP()
    const touching = door("W", "a", 205) // [205, 295], грань P на 295
    expect(thicknessAllowed(walls, P, 12, [touching])).toBe(false)
    expect(thicknessAllowed(walls, P, 8, [touching])).toBe(true)
  })

  it("DG-07c: уже нарушенный проём не блокирует несвязанную толщину, но не даёт углубить нарушение", () => {
    const { walls, L, R } = sceneR()
    const broken = door("W", "a", 450) // откосы 450 … 540: plus.b = −50, minus.b = −30
    expect(thicknessAllowed(walls, L, 30, [broken])).toBe(true)
    expect(thicknessAllowed(walls, R, 30, [broken])).toBe(false) // грань R к x = 485: plus.b = −55
    expect(thicknessAllowed(walls, R, 10, [broken])).toBe(true) // нарушение уменьшается
  })

  it("DG-09: от касания перегородка сразу отходит назад; без касания — смещается полностью", () => {
    const fresh = sceneRP()
    moveWallsBounded(fresh.walls, [fresh.P], { x: -50, y: 0 }, FREE([D0()]))
    expect(fresh.P.a.x).toBeCloseTo(250, 3)
    const { walls, P } = sceneRP()
    moveWallsBounded(walls, [P], { x: -200, y: 0 }, FREE([D0()]))
    moveWallsBounded(walls, [P], { x: 30, y: 0 }, FREE([D0()]))
    expect(P.a.x).toBeCloseTo(225, 3)
  })

  it("DG-07: толщина угловой стены, заводящая её грань в проём, не допускается", () => {
    const { walls, L, W } = sceneR()
    expect(thicknessAllowed(walls, L, 40, [UO()])).toBe(false)
    expect(thicknessAllowed(walls, L, 30, [UO()])).toBe(false)
    expect(thicknessAllowed(walls, L, 10, [UO()])).toBe(true)
    expect(thicknessAllowed(walls, L, 20, [UO()])).toBe(true)
    // толщина опорной стены не двигает стыки её граней
    expect(thicknessAllowed(walls, W, 40, [UO()])).toBe(true)
    // проверка не меняет стену
    expect(L.thicknessCm).toBe(20)
  })

  it("DG-10: орто-растяжение ограничено проёмом в боковой стене", () => {
    const { walls, B, L } = sceneR()
    // проём на L (0,400)-(0,0) у верхнего угла: откосы y = 100 … 10
    const d = door("L", "b", 10)
    // у L (направление (0, −1)) сторона plus — x > 0, внутренняя: до грани W 0, до грани B 290
    expect(doorwayDistances(d, walls)?.plus.b).toBeCloseTo(0, 3)
    expect(doorwayDistances(d, walls)?.plus.a).toBeCloseTo(290, 3)
    moveWallsBounded(walls, [B], { x: 0, y: -350 }, ORTHO([d]))
    expect(B.a.y).toBeCloseTo(110, 2)
    expect(B.b.y).toBeCloseTo(110, 2)
    expect(L.a.y).toBeCloseTo(110, 2)
    allHold([d], walls)
  })

  it("DG-11: групповое перемещение останавливается целиком", () => {
    const { walls, P } = sceneRP()
    const X = w(1000, 1000, 1100, 1000, "X")
    walls.push(X)
    moveWallsBounded(walls, [P, X], { x: -200, y: 0 }, FREE([D0()]))
    expect(P.a.x).toBeCloseTo(195, 3)
    expect(X.a.x).toBeCloseTo(895, 3)
  })

  it("DG-12: уже нарушенный проём не блокирует правки, но нарушение не углубляется", () => {
    const d = door("W", "a", 450) // откосы 450 … 540 при длине 500: b = −40
    const deeper = sceneF()
    moveEndpointBounded(deeper.walls, deeper.W, "b", { x: 480, y: 0 }, FREE([d]))
    expect(deeper.W.b.x).toBeGreaterThanOrEqual(500 - 1e-3)
    const better = sceneF()
    moveEndpointBounded(better.walls, better.W, "b", { x: 520, y: 0 }, FREE([d]))
    expect(better.W.b.x).toBeCloseTo(520, 3)
    const other = sceneF()
    moveWallsBounded(other.walls, [other.W], { x: 0, y: 50 }, FREE([d]))
    expect(other.W.a.y).toBeCloseTo(50, 3)
  })

  it("DG-13: без проёмов перегородка проходит прежнее расстояние (контроль причины ограничения)", () => {
    const { walls, P } = sceneRP()
    moveWallsBounded(walls, [P], { x: -200, y: 0 }, FREE([]))
    expect(P.a.x).toBeCloseTo(100, 3)
  })

  it("DG-13b: проём на другой стене не ограничивает несвязанную правку", () => {
    const { walls, P } = sceneRP()
    const onB = door("B", "a", 300) // B (500,400)-(0,400): откосы x = 200 … 110
    moveWallsBounded(walls, [P], { x: 50, y: 0 }, FREE([onB]))
    expect(P.a.x).toBeCloseTo(350, 3)
  })
})

describe("рисование стены не создаёт стык внутри проёма", () => {
  const input = (walls: Wall[], start: { x: number; y: number }, raw: { x: number; y: number }, doorways?: Doorway[]): ChainInput => ({
    start,
    ref: null,
    raw,
    walls,
    radiusCm: 6,
    gridStepCm: 10,
    thicknessCm: 10,
    ortho: false,
    typedAngleDeg: null,
    typedLengthCm: null,
    ...(doorways ? { doorways } : {}),
  })
  const drawn = (start: { x: number; y: number }, end: { x: number; y: number }): Wall => ({
    id: "new",
    a: start,
    b: end,
    thicknessCm: 10,
    type: "brick",
  })

  // привязка к стене на участке проёма: квадрат конца (толщина 10) налагается на [100, 190]
  const wallSnapInOpening = (seg: { snap: { source: string }; end: { x: number } }): boolean =>
    seg.snap.source === "wall" && seg.end.x > 95 + 1e-6 && seg.end.x < 195 - 1e-6

  it("DD-01: без проёмов конец прилипает к грани W внутри будущего проёма (контроль), с проёмом — нет", () => {
    const { walls } = sceneR()
    const start = { x: 145, y: 200 }
    const plain = chainSegment(input(walls, start, { x: 145, y: 14 }))
    expect(plain.snap.source).toBe("wall")
    expect(violatesDoorways(walls, [...walls, drawn(start, plain.end)], [D0()])).toBe(true)
    // остальные привязки (сетка) работают по прежним правилам и могут дать конец на грани — его отклоняет фиксация
    const guarded = chainSegment(input(walls, start, { x: 145, y: 14 }, [D0()]))
    expect(wallSnapInOpening(guarded)).toBe(false)
  })

  it("DD-01c: с проёмом курсор у грани, сетка которого мимо грани, даёт стену без нарушения", () => {
    const { walls } = sceneR()
    const start = { x: 145, y: 200 }
    const plain = chainSegment(input(walls, start, { x: 145, y: 16 }))
    expect(plain.snap.source).toBe("wall") // контроль: без проёма — прилипание к грани
    const guarded = chainSegment(input(walls, start, { x: 145, y: 16 }, [D0()]))
    expect(wallSnapInOpening(guarded)).toBe(false)
    expect(violatesDoorways(walls, [...walls, drawn(start, guarded.end)], [D0()])).toBe(false)
  })

  it("DD-05: орто (по умолчанию в приложении) — привязка по лучу к грани внутри проёма не выполняется", () => {
    const { walls } = sceneR()
    const start = { x: 145, y: 200 }
    const ortho = (doorways?: Doorway[]): ChainInput => ({ ...input(walls, start, { x: 145, y: 14 }, doorways), ortho: true })
    const plain = chainSegment(ortho())
    expect(plain.snap.source).toBe("wall")
    expect(plain.end.x).toBeCloseTo(145, 3)
    expect(wallSnapInOpening(chainSegment(ortho([D0()])))).toBe(false)
  })

  it("DD-05b: орто вне проёма — привязка по лучу работает как без проёма", () => {
    const { walls } = sceneR()
    const start = { x: 300, y: 200 }
    const at = (doorways?: Doorway[]): ChainInput => ({ ...input(walls, start, { x: 300, y: 14 }, doorways), ortho: true })
    const plain = chainSegment(at())
    const guarded = chainSegment(at([D0()]))
    expect(guarded.snap.source).toBe("wall")
    expectPoint(guarded.end, plain.end.x, plain.end.y, 6)
  })

  it("DD-01b: начало цепочки не прилипает к грани внутри проёма", () => {
    const { walls } = sceneR()
    const plain = snapStartVertex({ x: 145, y: 13 }, walls, 6, 10, 10)
    expect(plain.source).toBe("wall")
    const guarded = snapStartVertex({ x: 145, y: 13 }, walls, 6, 10, 10, [D0()])
    // квадрат установки шириной 10 не заходит на участок проёма (100 … 190)
    if (guarded.source === "wall") expect(guarded.point.x <= 95 + 1e-6 || guarded.point.x >= 195 - 1e-6).toBe(true)
  })

  it("DD-02: стена, примкнутая к грани внутри проёма, нарушает; в стороне — нет", () => {
    const { walls } = sceneR()
    expect(violatesDoorways(walls, [...walls, w(150, 10, 150, 200, "n", 10)], [D0()])).toBe(true)
    expect(violatesDoorways(walls, [...walls, w(150, 30, 150, 200, "n", 10)], [D0()])).toBe(false)
    expect(violatesDoorways(walls, [...walls, w(250, 10, 250, 200, "n", 10)], [D0()])).toBe(false)
    expect(violatesDoorways(walls, [...walls, w(195, 10, 195, 200, "n", 10)], [D0()])).toBe(false) // касание откоса
    expect(violatesDoorways(walls, walls, [D0()])).toBe(false)
  })

  it("DD-03: привязка вне проёма работает как без проёма", () => {
    const { walls } = sceneR()
    const start = { x: 300, y: 200 }
    const plain = chainSegment(input(walls, start, { x: 300, y: 14 }))
    const guarded = chainSegment(input(walls, start, { x: 300, y: 14 }, [D0()]))
    expect(guarded.snap.source).toBe("wall")
    expectPoint(guarded.end, plain.end.x, plain.end.y, 6)
  })

  it("DD-06: уже нарушенный проём не блокирует несвязанное рисование и привязку", () => {
    const { walls } = sceneF()
    const broken = door("W", "a", 450) // откосы 450 … 540 при длине 500: b = −40
    expect(violatesDoorways(walls, [...walls, w(100, 10, 100, 200, "n", 10)], [broken])).toBe(false)
    expect(violatesDoorways(walls, [...walls, w(1000, 0, 1000, 300, "n")], [broken])).toBe(false)
    const seg = chainSegment(input(walls, { x: 200, y: 200 }, { x: 200, y: 14 }, [broken]))
    expect(seg.snap.source).toBe("wall")
    expect(seg.end.x).toBeCloseTo(200, 3)
  })

  it("DD-06b: рисование, углубляющее нарушение уже нарушенного проёма, отклоняется", () => {
    const { walls } = sceneF()
    const broken = door("W", "a", 450)
    // угловая стена у конца b сдвигает конец внутренней грани к x = 490: b = −50
    expect(violatesDoorways(walls, [...walls, w(500, 0, 500, 300, "n")], [broken])).toBe(true)
  })

  it("DD-04: угловой стык у конца, к которому вплотную стоит проём, нарушает", () => {
    const { walls } = sceneF()
    const flush = door("W", "a", 0)
    expect(violatesDoorways(walls, [...walls, w(0, 0, 0, 300, "n")], [flush])).toBe(true)
    expect(violatesDoorways(walls, [...walls, w(500, 0, 500, 300, "n")], [flush])).toBe(false)
  })
})
