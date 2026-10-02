import { describe, expect, it } from "vitest"
import { moveEndpoint } from "./geometry"
import { rulerReading } from "./ruler"
import type { RulerReading } from "./ruler"
import type { Point, Wall } from "./types"
import { displayPolygons, pointInPolygon } from "./wall-geometry"
import { deepFreeze } from "./wall-snap.test-utils"
import {
  L_REGION,
  W,
  insidePolygon,
  orders,
  rect,
  sceneF,
  sceneL,
  sceneR,
  sceneRP,
  sceneRbox,
  sceneRisland,
  sceneRopen,
  sceneU,
  shiftWalls,
  transformWalls,
} from "./room-area.test-utils"
import {
  BEND_AXES,
  NEEDLE_AXES,
  Q_AXES,
  SHARP_AXES,
  expectPointNear,
  insetPolygon,
  intersectLines,
  interiorAngles,
  near,
  rot,
  SLANT_END,
  sceneCol,
  sceneLedge,
  sceneNeedle,
  sceneQ,
  sceneRbend,
  sceneRseam,
  sceneSharp,
  sceneSlant,
  sceneStep,
  sceneStepThin,
  sceneStub,
  sceneTee,
  sceneThin,
  sceneTwin,
  unitTo,
} from "./ruler.test-utils"

// Тесты change ruler-tool: чистый расчёт замеров линейки (spec ruler-tool,
// design D1–D4). Ожидания посчитаны аналитически по внутренним граням стен.

type Space = Extract<RulerReading, { kind: "space" }>
type WallReading = Extract<RulerReading, { kind: "wall" }>
type Span = NonNullable<Space["horizontal"]>
type RoomAngle = Space["angles"][number]

const TOL = 1e-6

function asWall(r: RulerReading): WallReading {
  expect(r.kind).toBe("wall")
  if (r.kind !== "wall") throw new Error("ожидался замер стены")
  return r
}

function asSpace(r: RulerReading): Space {
  expect(r.kind).toBe("space")
  if (r.kind !== "space") throw new Error("ожидался замер пролёта")
  return r
}

function expectSpan(span: Span | null, from: Point, to: Point, tol = TOL): void {
  expect(span).not.toBeNull()
  if (!span) return
  expectPointNear(span.from, from, tol)
  expectPointNear(span.to, to, tol)
  expect(Math.abs(span.lengthCm - Math.hypot(to.x - from.x, to.y - from.y))).toBeLessThanOrEqual(tol)
}

const rectRegion = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

// каждому ожидаемому углу соответствует ровно один найденный, лишних нет
function expectAngles(actual: RoomAngle[], expected: { at: Point; deg: number }[], tolAt = 0.01, tolDeg = 0.01): void {
  expect(actual, JSON.stringify(actual.map((a) => [a.at, a.deg]))).toHaveLength(expected.length)
  for (const e of expected) {
    const hits = actual.filter((a) => near(a.at, e.at, tolAt))
    expect(hits, `угол в ${JSON.stringify(e.at)}`).toHaveLength(1)
    expect(Math.abs(hits[0].deg - e.deg), `угол в ${JSON.stringify(e.at)}: ${hits[0].deg} ≈ ${e.deg}`).toBeLessThanOrEqual(tolDeg)
  }
}

// углы внутренней области region (вершины и значения — независимой геометрией)
const regionAngles = (region: Point[]): { at: Point; deg: number }[] => {
  const degs = interiorAngles(region)
  return region.map((at, i) => ({ at, deg: degs[i] }))
}

// дуга угла идёт от startDir через внутренность помещения к соседней вершине контура;
// dirTol — точность направлений: контур помещения проходит через сетку 0,001 см, и на косых
// рёбрах направление отличается от аналитического на ~3e-6
function expectArcsInside(angles: RoomAngle[], region: Point[], dirTol = 1e-6): void {
  for (const a of angles) {
    const i = region.findIndex((v) => near(v, a.at, 0.01))
    expect(i, `вершина ${JSON.stringify(a.at)}`).toBeGreaterThanOrEqual(0)
    const dirs = [unitTo(a.at, region[(i + 1) % region.length]), unitTo(a.at, region[(i + region.length - 1) % region.length])]
    const len = Math.hypot(a.startDir.x, a.startDir.y)
    expect(Math.abs(len - 1)).toBeLessThanOrEqual(1e-6)
    const startIdx = dirs.findIndex((d) => near(d, a.startDir, dirTol))
    expect(startIdx, `startDir вдоль ребра контура в ${JSON.stringify(a.at)}`).toBeGreaterThanOrEqual(0)
    // |sweepDeg| согласован с deg с точностью округления deg до сотых (design D4)
    expect(Math.abs(Math.abs(a.sweepDeg) - a.deg)).toBeLessThanOrEqual(0.005 + 1e-9)
    const end = rot(a.startDir, a.sweepDeg)
    expectPointNear(end, dirs[1 - startIdx], Math.max(dirTol, 1e-4))
    const mid = rot(a.startDir, a.sweepDeg / 2)
    const probe = { x: a.at.x + 2 * mid.x, y: a.at.y + 2 * mid.y }
    expect(insidePolygon(probe, region), `середина дуги в ${JSON.stringify(a.at)} внутри помещения`).toBe(true)
  }
}

const inForm = (p: Point, wall: Wall, walls: Wall[]): boolean => displayPolygons(wall, walls).some((poly) => pointInPolygon(p, poly))

const R_REGION = rectRegion(10, 10, 410, 310)

// R с перегородкой от верхней стены у x = 200 и свободным концом в комнате:
// 4 угла комнаты и 2 угла примыкания, углов торца нет
const STUB_ANGLES = [
  { at: { x: 10, y: 10 }, deg: 90 },
  { at: { x: 190, y: 10 }, deg: 90 },
  { at: { x: 210, y: 10 }, deg: 90 },
  { at: { x: 410, y: 10 }, deg: 90 },
  { at: { x: 410, y: 310 }, deg: 90 },
  { at: { x: 10, y: 310 }, deg: 90 },
]

// стык под почти прямым углом даёт в контуре помещения цепочки микрорёбер (до ~0,05 см,
// проверено на текущей геометрии стыков). Порядок их стягивания design D4 не фиксирует,
// и вершина излома может сместиться на ~0,15 см. Положение сравнивается грубее, угол — точно
const BEND_TOL_AT = 0.5
const BEND_TOL_DEG = 0.03

describe("замер стены по оси", () => {
  it("WALL-AXIS-1: курсор на оси — линия от начала до конца оси и её длина", () => {
    const walls = sceneR()
    const r = asWall(rulerReading({ x: 200, y: 0 }, walls))
    expect(r.wall).toBe(walls[0])
    expectPointNear(r.from, { x: 0, y: 0 }, TOL)
    expectPointNear(r.to, { x: 420, y: 0 }, TOL)
    expect(r.lengthCm).toBeCloseTo(420, 9)
  })

  it("WALL-AXIS-2: курсор у внешней грани — длина по оси, а не по грани", () => {
    const walls = sceneR()
    const r = asWall(rulerReading({ x: 200, y: -8 }, walls))
    expect(r.wall).toBe(walls[0])
    expect(r.lengthCm).toBeCloseTo(420, 9)
    expect(r.lengthCm).not.toBeCloseTo(400, 3)
    expect(r.lengthCm).not.toBeCloseTo(440, 3)
  })

  it("WALL-AXIS-3: угловой стык на грани — длина оси стены, а не видимой грани", () => {
    const walls = sceneF()
    const r = asWall(rulerReading({ x: 410, y: 160 }, walls))
    expect(r.wall).toBe(walls[1])
    expectPointNear(r.from, { x: 410, y: 10 }, TOL)
    expectPointNear(r.to, { x: 410, y: 310 }, TOL)
    expect(r.lengthCm).toBeCloseTo(300, 9)
  })

  it("WALL-OUT-1: в 1 см от внутренней грани — не стена (нет полосного допуска)", () => {
    expect(rulerReading({ x: 200, y: 11 }, sceneR()).kind).toBe("space")
  })

  it("WALL-OUT-2: в 1 см снаружи внешней грани — не стена", () => {
    expect(rulerReading({ x: 200, y: -11 }, sceneR()).kind).toBe("space")
  })

  it("WALL-OUT-3: тонкие стены — в 1 см от грани не стена (нет полосы допуска по оси)", () => {
    // толщина 1 см: тело верхней стены y ∈ [−0,5; 0,5]; до оси 1,5 см
    const thin = sceneThin()
    expect(rulerReading({ x: 200, y: 1.5 }, thin).kind).toBe("space")
    expect(rulerReading({ x: 200, y: -1.5 }, thin).kind).toBe("space")
    expect(asWall(rulerReading({ x: 200, y: 0.4 }, thin)).wall).toBe(thin[0])
    // короб толщиной 10 см: тело верхней стены y ∈ [295, 305]; до оси 6 см
    const box = sceneRbox()
    expect(rulerReading({ x: 500, y: 306 }, box).kind).toBe("space")
    expect(rulerReading({ x: 500, y: 294 }, box).kind).toBe("space")
    expect(asWall(rulerReading({ x: 500, y: 304 }, box)).wall).toBe(box[4])
  })

  it("WALL-PICK-3: расстояние — до отрезка оси, а не до её бесконечной прямой", () => {
    const walls = sceneR()
    const p = { x: 0, y: -5 }
    // предусловие: точка в форме A; до отрезка оси A и до отрезка оси D по 5 см,
    // до бесконечной прямой оси D — 0
    expect(inForm(p, walls[0], walls), "предусловие: точка в форме A").toBe(true)
    const r = asWall(rulerReading(p, walls))
    expect(r.wall).toBe(walls[0])
    expect(r.lengthCm).toBeCloseTo(420, 9)
  })

  it("курсор ровно на грани стены — замер стены (граница формы входит в форму)", () => {
    const walls = sceneR()
    expect(asWall(rulerReading({ x: 200, y: 10 }, walls)).wall).toBe(walls[0])
  })

  it("WALL-PICK-1: на общей границе при равных расстояниях до осей — стена, стоящая раньше", () => {
    const [w1, w2] = sceneCol()
    const p = { x: 200, y: 5 }
    expect(inForm(p, w1, [w1, w2]), "предусловие: точка в форме W1").toBe(true)
    expect(inForm(p, w2, [w1, w2]), "предусловие: точка в форме W2").toBe(true)
    const first = asWall(rulerReading(p, [w1, w2]))
    expect(first.wall).toBe(w1)
    expect(first.lengthCm).toBeCloseTo(200, 9)
    expect(inForm(p, w1, [w2, w1]), "предусловие: точка в форме W1").toBe(true)
    expect(inForm(p, w2, [w2, w1]), "предусловие: точка в форме W2").toBe(true)
    const second = asWall(rulerReading(p, [w2, w1]))
    expect(second.wall).toBe(w2)
    expect(second.lengthCm).toBeCloseTo(300, 9)
  })

  it("WALL-PICK-2: на общей границе — стена с ближайшей осью при любом порядке", () => {
    const [a, pWall] = sceneTee()
    const p = { x: 200, y: 10 }
    // при [A, P] точка лежит в формах обеих стен; при [P, A] ранняя P вычитается из A,
    // и точка остаётся только в форме P — ответ тот же
    expect(inForm(p, a, [a, pWall]), "предусловие: точка в форме A").toBe(true)
    expect(inForm(p, pWall, [a, pWall]), "предусловие: точка в форме P").toBe(true)
    for (const walls of [
      [a, pWall],
      [pWall, a],
    ]) {
      const r = asWall(rulerReading(p, walls))
      expect(r.wall).toBe(pWall)
      expect(r.lengthCm).toBeCloseTo(300, 9)
    }
  })

  it("WALL-JOINT-1: курсор в угловом куске стыка — стена, которой принадлежит кусок", () => {
    const walls = sceneR()
    const p = { x: -5, y: -5 }
    // предусловие: угловой квадрат у (0,0) принадлежит только форме D; вне прямоугольника оси D (x ∈ [−10,10], y ∈ [0,320])
    expect(walls.map((w) => inForm(p, w, walls))).toEqual([false, false, false, true])
    const r = asWall(rulerReading(p, walls))
    expect(r.wall).toBe(walls[3])
    expect(r.lengthCm).toBeCloseTo(320, 9)
    expectPointNear(r.from, { x: 0, y: 320 }, TOL)
    expectPointNear(r.to, { x: 0, y: 0 }, TOL)
  })

  it("WALL-JOINT-2: курсор в клине непрямого стыка — стена клина", () => {
    const walls = sceneQ()
    const p = { x: 405, y: 0 }
    // предусловие: точка в форме косой стены (400,0)→(c,300) и вне формы верхней стены
    expect(walls.map((w) => inForm(p, w, walls))).toEqual([false, true, false, false])
    const r = asWall(rulerReading(p, walls))
    expect(r.wall).toBe(walls[1])
    expect(r.lengthCm).toBeCloseTo(Math.hypot(Q_AXES[2].x - 400, 300), 9)
    expect(r.lengthCm).toBeCloseTo(324.71766, 4)
  })

  it("WALL-ONLY-1: над стеной нет пролётов и углов", () => {
    const r = rulerReading({ x: 200, y: 0 }, sceneR())
    expect(r.kind).toBe("wall")
    expect("angles" in r).toBe(false)
    expect("horizontal" in r).toBe(false)
    expect("vertical" in r).toBe(false)
  })

  it("WALL-DEGEN-1: вырожденная стена не даёт замера стены", () => {
    const walls = [...sceneR(), W(100, 100, 100, 100)]
    expect(rulerReading({ x: 100, y: 100 }, walls).kind).toBe("space")
  })

  it("WALL-EDIT-1: замер следует за правкой стены (нет кэша между вызовами)", () => {
    const walls = sceneR()
    expect(asWall(rulerReading({ x: 200, y: 0 }, walls)).lengthCm).toBeCloseTo(420, 9)
    moveEndpoint(walls, walls[0], "b", { x: 520, y: 0 })
    const r = asWall(rulerReading({ x: 200, y: 0 }, walls))
    expect(r.wall).toBe(walls[0])
    expect(r.lengthCm).toBeCloseTo(520, 9)
    expectPointNear(r.to, { x: 520, y: 0 }, TOL)
  })
})

describe("замер пролёта между гранями", () => {
  it("SPAN-RECT-1: ширина и высота комнаты от грани до грани", () => {
    const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneR()))
    expectSpan(r.horizontal, { x: 10, y: 100 }, { x: 410, y: 100 })
    expectSpan(r.vertical, { x: 100, y: 10 }, { x: 100, y: 310 })
    expect(r.horizontal?.lengthCm).toBeCloseTo(400, 9)
    expect(r.vertical?.lengthCm).toBeCloseTo(300, 9)
  })

  it("SPAN-MOVE-1: пролёт не зависит от положения курсора, линия проходит через курсор", () => {
    for (const p of [
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      { x: 409, y: 309 },
    ]) {
      const r = asSpace(rulerReading(p, sceneR()))
      expectSpan(r.horizontal, { x: 10, y: p.y }, { x: 410, y: p.y })
      expectSpan(r.vertical, { x: p.x, y: 10 }, { x: p.x, y: 310 })
    }
  })

  it("SPAN-COL-1: горизонтальный луч упирается в колонну", () => {
    const r = asSpace(rulerReading({ x: 100, y: 160 }, sceneRisland()))
    expectSpan(r.horizontal, { x: 10, y: 160 }, { x: 160, y: 160 })
    expectSpan(r.vertical, { x: 100, y: 10 }, { x: 100, y: 310 })
  })

  it("SPAN-COL-2: вертикальный луч упирается в колонну", () => {
    const r = asSpace(rulerReading({ x: 200, y: 100 }, sceneRisland()))
    expectSpan(r.vertical, { x: 200, y: 10 }, { x: 200, y: 150 })
  })

  it("SPAN-ONESIDE-1: стена только с одной стороны — пролёта нет", () => {
    const r = asSpace(rulerReading({ x: -100, y: 100 }, sceneR()))
    expect(r.horizontal).toBeNull()
    expect(r.vertical).toBeNull()
    expect(r.angles).toEqual([])
  })

  it("SPAN-OUT-1: между двумя зданиями — пролёт между внешними гранями, без углов", () => {
    const r = asSpace(rulerReading({ x: 700, y: 100 }, sceneTwin()))
    expectSpan(r.horizontal, { x: 430, y: 100 }, { x: 990, y: 100 })
    expect(r.vertical).toBeNull()
    expect(r.angles).toEqual([])
  })

  it("SPAN-EMPTY-1: пустой чертёж — ничего", () => {
    expect(rulerReading({ x: 0, y: 0 }, [])).toEqual({ kind: "space", horizontal: null, vertical: null, angles: [] })
  })

  it("SPAN-U-1: П-образный контур — горизонталь есть, вертикали и углов нет", () => {
    const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneU()))
    expectSpan(r.horizontal, { x: 10, y: 100 }, { x: 410, y: 100 })
    expect(r.vertical).toBeNull()
    expect(r.angles).toEqual([])
  })

  it("SPAN-GAP-1: луч проходит в разрыв стены — упора нет", () => {
    const below = asSpace(rulerReading({ x: 275, y: 400 }, sceneRopen()))
    expect(below.vertical).toBeNull()
    const inside = asSpace(rulerReading({ x: 275, y: 200 }, sceneRopen()))
    expect(inside.vertical).toBeNull()
    expectSpan(inside.horizontal, { x: 210, y: 200 }, { x: 410, y: 200 })
  })

  it("SPAN-GRAZE-1: луч вдоль линии внешних граней упирается в углы зданий", () => {
    const r = asSpace(rulerReading({ x: 700, y: -10 }, sceneTwin()))
    expectSpan(r.horizontal, { x: 430, y: -10 }, { x: 990, y: -10 })
  })

  it("SPAN-FAR-1: дальние координаты", () => {
    const shift = { x: 1e6, y: 1e6 }
    const r = asSpace(rulerReading({ x: shift.x + 100, y: shift.y + 100 }, shiftWalls(sceneR(), shift)))
    expect(Math.abs((r.horizontal?.lengthCm ?? NaN) - 400)).toBeLessThanOrEqual(1e-3)
    expect(Math.abs((r.vertical?.lengthCm ?? NaN) - 300)).toBeLessThanOrEqual(1e-3)
  })

  it("SPAN-THIN-1: тонкие стены", () => {
    const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneThin()))
    expect(r.horizontal?.lengthCm).toBeCloseTo(419, 9)
    expect(r.vertical?.lengthCm).toBeCloseTo(319, 9)
  })
})

describe("внутренние углы помещения", () => {
  it("ANG-RECT-1: прямоугольная комната — 4 угла по 90°", () => {
    const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneR()))
    expectAngles(r.angles, regionAngles(R_REGION))
    for (const a of r.angles) expect(a.deg).toBeCloseTo(90, 6)
  })

  it("ANG-F-1: контур с угловыми стыками на грани — без лишних вершин", () => {
    const r = asSpace(rulerReading({ x: 200, y: 160 }, sceneF()))
    expectAngles(r.angles, regionAngles(rectRegion(20, 10, 400, 310)))
  })

  it("ANG-T-1: T-стыки перегородки не дают лишних вершин", () => {
    const r = asSpace(rulerReading({ x: 100, y: 160 }, sceneRP()))
    expectAngles(r.angles, regionAngles(rectRegion(10, 10, 190, 310)))
  })

  it("ANG-L-1: Г-образная комната — 270° во входящей вершине", () => {
    const r = asSpace(rulerReading({ x: 20, y: 200 }, sceneL()))
    expectAngles(
      r.angles,
      L_REGION.map((at) => ({ at, deg: at.x === 40 && at.y === 40 ? 270 : 90 })),
    )
  })

  it("ANG-ARC-1: дуга идёт от ребра контура к соседнему через сторону помещения", () => {
    expectArcsInside(asSpace(rulerReading({ x: 100, y: 100 }, sceneR())).angles, R_REGION)
    expectArcsInside(asSpace(rulerReading({ x: 20, y: 200 }, sceneL())).angles, L_REGION)
    expectArcsInside(asSpace(rulerReading({ x: 100, y: 150 }, sceneQ())).angles, insetPolygon(Q_AXES, 10), 1e-4)
  })

  it("ANG-ARC-1: входящий угол Г-образной комнаты — сектор 270°, не 90°", () => {
    const r = asSpace(rulerReading({ x: 20, y: 200 }, sceneL()))
    const reflex = r.angles.find((a) => near(a.at, { x: 40, y: 40 }, 0.01))
    expect(reflex).toBeDefined()
    if (!reflex) return
    expect(Math.abs(reflex.sweepDeg)).toBeCloseTo(270, 6)
    const mid = rot(reflex.startDir, reflex.sweepDeg / 2)
    expect(mid.x).toBeLessThan(0)
    expect(mid.y).toBeLessThan(0)
  })

  it("ANG-Q-1: косые углы 67,5° и 112,5°", () => {
    const region = insetPolygon(Q_AXES, 10)
    const r = asSpace(rulerReading({ x: 100, y: 150 }, sceneQ()))
    const expected = regionAngles(region)
    expect(expected.map((e) => Math.round(e.deg * 10) / 10).sort((a, b) => a - b)).toEqual([67.5, 90, 90, 112.5])
    expectAngles(r.angles, expected)
  })

  it("ANG-ROT-1: повёрнутая комната — 4 угла по 90°", () => {
    const shift = { x: 1234.567, y: 891.011 }
    const tr = (p: Point): Point => transformWalls([{ id: "", a: p, b: p, thicknessCm: 1, type: "brick" }], 30, shift)[0].a
    const r = asSpace(rulerReading(tr({ x: 100, y: 100 }), transformWalls(sceneR(), 30, shift)))
    expectAngles(
      r.angles,
      R_REGION.map((at) => ({ at: tr(at), deg: 90 })),
    )
  })

  it("ANG-SEAM-1: шов на прямой стороне не подписывается", () => {
    const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneRseam()))
    expectAngles(r.angles, regionAngles(R_REGION))
  })

  it("ANG-BEND-1: вершина 180,4° и 179,6° не подписывается", () => {
    for (const theta of [180.4, 179.6]) {
      const region = insetPolygon(BEND_AXES(theta), 10)
      const expected = regionAngles(region).filter((e) => Math.abs(e.deg - 180) >= 0.5)
      expect(expected, "предусловие: отброшена только вершина излома").toHaveLength(4)
      const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneRbend(theta)))
      expectAngles(r.angles, expected, BEND_TOL_AT, BEND_TOL_DEG)
    }
  })

  it("ANG-BEND-2: вершина 180,6° и 179,4° подписывается", () => {
    for (const theta of [180.6, 179.4]) {
      const region = insetPolygon(BEND_AXES(theta), 10)
      const expected = regionAngles(region)
      expect(expected.some((e) => Math.abs(e.deg - theta) < 1e-9), "предусловие: угол излома").toBe(true)
      const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneRbend(theta)))
      expectAngles(r.angles, expected, BEND_TOL_AT, BEND_TOL_DEG)
    }
  })

  it("порог около 0,5°: 180,45° и 179,55° не подписываются, 180,55° и 179,45° подписываются", () => {
    for (const theta of [180.45, 179.55]) expect(asSpace(rulerReading({ x: 100, y: 100 }, sceneRbend(theta))).angles, `θ = ${theta}`).toHaveLength(4)
    for (const theta of [180.55, 179.45]) {
      const shown = asSpace(rulerReading({ x: 100, y: 100 }, sceneRbend(theta))).angles
      expect(shown, `θ = ${theta}`).toHaveLength(5)
      expect(shown.some((a) => Math.abs(a.deg - theta) <= BEND_TOL_DEG)).toBe(true)
    }
  })

  it("ANG-BEND-4: ровно 0,5° от прямой — подписывается (строгое «менее 0,5°», угол округлён до сотых)", () => {
    for (const theta of [180.5, 179.5]) {
      const shown = asSpace(rulerReading({ x: 100, y: 100 }, sceneRbend(theta))).angles
      expect(shown, `θ = ${theta}`).toHaveLength(5)
      expect(shown.filter((a) => Math.abs(a.deg - theta) <= 0.005 + 1e-9), `θ = ${theta}`).toHaveLength(1)
    }
  })

  it("ANG-SHORT-1: реальная ступенька 3 см — подписаны обе её вершины (90° и 270°)", () => {
    const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneStep()))
    expect(r.angles, JSON.stringify(r.angles.map((a) => [a.at, a.deg]))).toHaveLength(6)
    const degs = r.angles.map((a) => Math.round(a.deg)).sort((p, q) => p - q)
    expect(degs).toEqual([90, 90, 90, 90, 90, 270])
    expect(r.angles.reduce((s, a) => s + a.deg, 0)).toBeCloseTo(720, 3)
    // ступенька: входящий угол и соседний с ним угол 90° на одной горизонтали в 3 см друг от друга
    const reflex = r.angles.find((a) => Math.round(a.deg) === 270)
    expect(reflex).toBeDefined()
    if (!reflex) return
    expect(reflex.at.x).toBeCloseTo(410, 6)
    const partner = r.angles.filter((a) => a !== reflex && Math.abs(Math.hypot(a.at.x - reflex.at.x, a.at.y - reflex.at.y) - 3) <= 0.01)
    expect(partner).toHaveLength(1)
    expect(partner[0].at.x).toBeCloseTo(413, 6)
    expect(partner[0].at.y).toBeCloseTo(reflex.at.y, 6)
    expect(Math.round(partner[0].deg)).toBe(90)
  })

  it("ANG-SHORT-2: ступенька 0,5 см от стен разной толщины на одной оси — обе её вершины подписаны", () => {
    // верхняя стена: 20 см слева от x = 200 и 19 см справа; внутренняя грань — y = 10 и y = 9,5
    const region: Point[] = [
      { x: 10, y: 10 },
      { x: 200, y: 10 },
      { x: 200, y: 9.5 },
      { x: 410, y: 9.5 },
      { x: 410, y: 310 },
      { x: 10, y: 310 },
    ]
    const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneStepThin()))
    expectAngles(r.angles, regionAngles(region))
    expect(r.angles.find((a) => near(a.at, { x: 200, y: 10 }, 0.01))?.deg).toBeCloseTo(270, 6)
    expect(r.angles.find((a) => near(a.at, { x: 200, y: 9.5 }, 0.01))?.deg).toBeCloseTo(90, 6)
  })

  it("ANG-ACUTE-2: очень острый угол 5° подписывается", () => {
    const expected = regionAngles(insetPolygon(NEEDLE_AXES, 10))
    expect(expected.map((e) => Math.round(e.deg)).sort((p, q) => p - q), "предусловие").toEqual([5, 85, 90])
    const r = asSpace(rulerReading({ x: 100, y: 50 }, sceneNeedle()))
    expectAngles(r.angles, expected, BEND_TOL_AT, BEND_TOL_DEG)
  })

  it("ANG-ACUTE-1: острый угол 20° подписывается", () => {
    const region = insetPolygon(SHARP_AXES, 10)
    const expected = regionAngles(region)
    expect(expected.map((e) => Math.round(e.deg)).sort((p, q) => p - q), "предусловие").toEqual([20, 70, 90])
    const r = asSpace(rulerReading({ x: 100, y: 50 }, sceneSharp()))
    expectAngles(r.angles, expected, BEND_TOL_AT, BEND_TOL_DEG)
  })

  it("ANG-CAP-1: торец свободного конца перегородки не подписывается", () => {
    const r = asSpace(rulerReading({ x: 50, y: 250 }, sceneStub(200)))
    expectAngles(r.angles, STUB_ANGLES)
  })

  it("ANG-CAP-2: конец перегородки, не доходящий до стены, — свободный, торец не подписывается", () => {
    const r = asSpace(rulerReading({ x: 50, y: 250 }, sceneStub(250)))
    expectAngles(r.angles, STUB_ANGLES)
  })

  it("ANG-CAP-3: косая перегородка — углы торца не подписаны, углы примыкания подписаны", () => {
    const walls = sceneSlant()
    const p = walls[4]
    const len = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y)
    const u = { x: (p.b.x - p.a.x) / len, y: (p.b.y - p.a.y) / len }
    const n = { x: -u.y, y: u.x }
    const caps = [
      { x: SLANT_END.x + 10 * n.x, y: SLANT_END.y + 10 * n.y },
      { x: SLANT_END.x - 10 * n.x, y: SLANT_END.y - 10 * n.y },
    ]
    const r = asSpace(rulerReading({ x: 50, y: 250 }, walls))
    for (const c of caps) expect(r.angles.filter((a) => near(a.at, c, 0.5)), `угол торца ${JSON.stringify(c)}`).toEqual([])
    // примыкание к верхней стене: грани перегородки (ось ± 10 по нормали) пересекают её внутреннюю грань y = 10
    const face = (side: number): Point => intersectLines({ x: p.a.x + side * 10 * n.x, y: p.a.y + side * 10 * n.y }, u, { x: 0, y: 10 }, { x: 1, y: 0 })
    const slope = (Math.atan2(u.y, u.x) * 180) / Math.PI // 56,31°
    const [left, right] = [face(1), face(-1)].sort((a, b) => a.x - b.x)
    expectAngles(r.angles, [
      { at: { x: 10, y: 10 }, deg: 90 },
      { at: left, deg: 180 - slope },
      { at: right, deg: slope },
      { at: { x: 410, y: 10 }, deg: 90 },
      { at: { x: 410, y: 310 }, deg: 90 },
      { at: { x: 10, y: 310 }, deg: 90 },
    ])
  })

  it("ANG-CAP-5: конец в 1 см от стены — свободный (примыкание по форме, а не по близости)", () => {
    const r = asSpace(rulerReading({ x: 50, y: 250 }, sceneStub(309)))
    expectAngles(r.angles, STUB_ANGLES)
  })

  it("ANG-CAP-6: перегородка, примкнутая торцом к внутренней грани, — этот конец не свободный", () => {
    const r = asSpace(rulerReading({ x: 50, y: 250 }, [...sceneR(), W(200, 10, 200, 200)]))
    expectAngles(r.angles, STUB_ANGLES)
  })

  it("ANG-CAP-7: короткий выступ 2 см — углы примыкания подписаны, торец нет (допуск торца мал)", () => {
    const r = asSpace(rulerReading({ x: 50, y: 250 }, sceneStub(12)))
    expectAngles(r.angles, STUB_ANGLES)
  })

  it("ANG-CAP-8: перегородка нарисована от свободного конца к стене — свободным может быть и начало оси", () => {
    for (const stub of [W(200, 200, 200, 0), W(200, 200, 200, 10)]) {
      const r = asSpace(rulerReading({ x: 50, y: 250 }, [...sceneR(), stub]))
      expectAngles(r.angles, STUB_ANGLES)
    }
  })

  it("ANG-CAP-9: зазор 0,5 см до стены — конец свободный", () => {
    const r = asSpace(rulerReading({ x: 50, y: 250 }, sceneStub(309.5)))
    expectAngles(r.angles, STUB_ANGLES)
  })

  it("ANG-CAP-4: выступ из состыкованных стен — его входящие углы 270° подписаны", () => {
    const r = asSpace(rulerReading({ x: 50, y: 250 }, sceneLedge()))
    expectAngles(r.angles, [
      { at: { x: 10, y: 10 }, deg: 90 },
      { at: { x: 140, y: 10 }, deg: 90 },
      { at: { x: 140, y: 110 }, deg: 270 },
      { at: { x: 260, y: 110 }, deg: 270 },
      { at: { x: 260, y: 10 }, deg: 90 },
      { at: { x: 410, y: 10 }, deg: 90 },
      { at: { x: 410, y: 310 }, deg: 90 },
      { at: { x: 10, y: 310 }, deg: 90 },
    ])
  })

  it("ANG-ISLAND-1: вершины колонны не подписываются", () => {
    const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneRisland()))
    expectAngles(r.angles, regionAngles(R_REGION))
  })

  it("ANG-NEST-1: курсор во вложенном помещении — только его углы", () => {
    const r = asSpace(rulerReading({ x: 500, y: 400 }, sceneRbox()))
    expectAngles(r.angles, regionAngles(rectRegion(405, 305, 595, 495)))
  })

  it("ANG-NEST-2: курсор во внешнем помещении — без углов короба", () => {
    const r = asSpace(rulerReading({ x: 100, y: 100 }, sceneRbox()))
    expectAngles(r.angles, regionAngles(rectRegion(10, 10, 1010, 810)))
  })

  it("ANG-OUT-1: вне помещений углов нет", () => {
    expect(asSpace(rulerReading({ x: 700, y: 100 }, sceneTwin())).angles).toEqual([])
    expect(asSpace(rulerReading({ x: -100, y: 100 }, sceneR())).angles).toEqual([])
  })
})

describe("инварианты", () => {
  it("INV-PURE-1: вход не изменяется", () => {
    const walls = deepFreeze(sceneRisland())
    const before = JSON.stringify(walls)
    for (const p of [
      { x: 200, y: 0 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ])
      expect(() => rulerReading(p, walls)).not.toThrow()
    expect(JSON.stringify(walls)).toBe(before)
  })

  it("INV-DET-1: одинаковый вход — одинаковый результат", () => {
    const walls = sceneL()
    expect(rulerReading({ x: 20, y: 200 }, walls)).toEqual(rulerReading({ x: 20, y: 200 }, walls))
  })

  it("INV-ORDER-1: порядок стен не влияет на пролёты и углы", () => {
    const cases: [Wall[], Point][] = [
      [sceneRP(), { x: 100, y: 160 }],
      [sceneRisland(), { x: 100, y: 160 }],
      [sceneL(), { x: 20, y: 200 }],
      [sceneStub(200), { x: 50, y: 250 }],
      [sceneSlant(), { x: 50, y: 250 }],
    ]
    for (const [walls, p] of cases) {
      const ref = asSpace(rulerReading(p, walls))
      for (const order of orders(walls)) {
        const r = asSpace(rulerReading(p, order))
        expect(r.horizontal?.lengthCm).toBeCloseTo(ref.horizontal?.lengthCm ?? NaN, 6)
        expect(r.vertical?.lengthCm).toBeCloseTo(ref.vertical?.lengthCm ?? NaN, 6)
        expectAngles(
          r.angles,
          ref.angles.map((a) => ({ at: a.at, deg: a.deg })),
        )
      }
    }
  })

  it("INV-SHIFT-1: сдвиг сцены сдвигает замер, длины и углы не меняются", () => {
    const d = { x: 37.25, y: -81.5 }
    const sh = (p: Point): Point => ({ x: p.x + d.x, y: p.y + d.y })
    const ref = asSpace(rulerReading({ x: 100, y: 160 }, sceneRP()))
    const moved = asSpace(rulerReading(sh({ x: 100, y: 160 }), shiftWalls(sceneRP(), d)))
    expect(ref.horizontal).not.toBeNull()
    expect(ref.vertical).not.toBeNull()
    if (ref.horizontal) expectSpan(moved.horizontal, sh(ref.horizontal.from), sh(ref.horizontal.to), 1e-6)
    if (ref.vertical) expectSpan(moved.vertical, sh(ref.vertical.from), sh(ref.vertical.to), 1e-6)
    expectAngles(
      moved.angles,
      ref.angles.map((a) => ({ at: sh(a.at), deg: a.deg })),
    )
    const wallRef = asWall(rulerReading({ x: 200, y: 0 }, sceneRP()))
    const wallMoved = asWall(rulerReading(sh({ x: 200, y: 0 }), shiftWalls(sceneRP(), d)))
    expectPointNear(wallMoved.from, sh(wallRef.from), 1e-6)
    expectPointNear(wallMoved.to, sh(wallRef.to), 1e-6)
    expect(wallMoved.lengthCm).toBeCloseTo(wallRef.lengthCm, 6)
  })

  it("INV-SUM-1: сумма углов помещения равна (n − 2)·180°", () => {
    const cases: [Wall[], Point, number][] = [
      [sceneR(), { x: 100, y: 100 }, 360],
      [sceneL(), { x: 20, y: 200 }, 720],
      [sceneQ(), { x: 100, y: 150 }, 360],
    ]
    for (const [walls, p, sum] of cases) {
      const angles = asSpace(rulerReading(p, walls)).angles
      expect(angles.reduce((s, a) => s + a.deg, 0)).toBeCloseTo(sum, 3)
    }
  })

  it("INV-SPAN-1: длина пролёта равна расстоянию между концами, курсор на отрезке", () => {
    const cases: [Wall[], Point][] = [
      [sceneR(), { x: 100, y: 100 }],
      [sceneRisland(), { x: 100, y: 160 }],
      [sceneTwin(), { x: 700, y: 100 }],
      [sceneU(), { x: 300, y: 50 }],
      [rect(0, 0, 1020, 820), { x: 333, y: 444 }],
    ]
    for (const [walls, p] of cases) {
      const r = asSpace(rulerReading(p, walls))
      for (const span of [r.horizontal, r.vertical]) {
        if (!span) continue
        expect(span.lengthCm).toBeCloseTo(Math.hypot(span.to.x - span.from.x, span.to.y - span.from.y), 9)
        expect(span.from.x <= p.x + TOL && p.x <= span.to.x + TOL).toBe(true)
        expect(span.from.y <= p.y + TOL && p.y <= span.to.y + TOL).toBe(true)
      }
    }
  })
})
