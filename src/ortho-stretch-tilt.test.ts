import { describe, expect, it } from "vitest"
import { applyStretch, planOrthoStretch } from "./ortho-stretch"
import type { StretchSeed } from "./ortho-stretch"
import type { Point, Wall } from "./types"
import { RIGHT_SIN } from "./wall-geometry"

// change fix-ortho-tilted-stretch, wall-selection «Орто-растяжение связанных стен»: связанная стена,
// ось которой отклоняется от вектора смещения не более чем на 5°, растягивается своим концом;
// остальные смещаются целиком и передают правило дальше. Допуск прямого угла 0.5° не меняется.

const DEG = Math.PI / 180

const W = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

const P = (x: number, y: number): Point => ({ x, y })
const byId = (walls: Wall[], id: string): Wall => {
  const w = walls.find((x) => x.id === id)
  if (!w) throw new Error(`no wall ${id}`)
  return w
}
const ends = (w: Wall): [Point, Point] => [w.a, w.b]
const walls = (ws: Wall[], ids: string[]): StretchSeed => ({ kind: "walls", walls: ids.map((id) => byId(ws, id)) })

function expectEnds(w: Wall, a: Point, b: Point): void {
  expect(w.a.x).toBeCloseTo(a.x, 9)
  expect(w.a.y).toBeCloseTo(a.y, 9)
  expect(w.b.x).toBeCloseTo(b.x, 9)
  expect(w.b.y).toBeCloseTo(b.y, 9)
}

// сосед B от (200, 0) вниз длиной 300 с отклонением deg от вертикали
const tiltedB = (deg: number): Wall => W("B", 200, 0, 200 + 300 * Math.sin(deg * DEG), 300 * Math.cos(deg * DEG))

// сдвиг A вверх на 40; возвращает стены после применения
function liftA(ws: Wall[]): void {
  applyStretch(planOrthoStretch(ws, walls(ws, ["A"]), P(0, -40)), P(0, -40))
}

describe("Орто-растяжение: наклонный сосед", () => {
  it("TL-01: наклон 0.57° (3 см на 300 см) — сосед растягивается, стена за ним не сдвигается", () => {
    const ws = [W("A", 0, 0, 200, 0), W("B", 200, 0, 203, 300), W("C", 203, 300, 400, 300)]
    liftA(ws)
    expectEnds(byId(ws, "A"), P(0, -40), P(200, -40))
    expectEnds(byId(ws, "B"), P(200, -40), P(203, 300))
    expectEnds(byId(ws, "C"), P(203, 300), P(400, 300))
  })

  it("TL-02: наклон 3° — стыковой конец ровно на 40, дальний на месте, цепочка за соседом не тронута", () => {
    const b = tiltedB(3)
    const far = { ...b.b }
    const ws = [W("A", 0, 0, 200, 0), b, W("C", far.x, far.y, far.x + 200, far.y), W("D", far.x + 200, far.y, far.x + 200, far.y + 150)]
    liftA(ws)
    expectEnds(byId(ws, "B"), P(200, -40), far)
    expectEnds(byId(ws, "C"), far, P(far.x + 200, far.y))
    expectEnds(byId(ws, "D"), P(far.x + 200, far.y), P(far.x + 200, far.y + 150))
  })

  it("TL-03: присадка у наклонного соседа — стыковой конец смещён ровно на v, смещение осей сохранено", () => {
    const ws = [W("A", 0, 0, 200, 0), W("B", 195, 5, 195 + 195 * Math.tan(3 * DEG), 200)]
    const far = { ...byId(ws, "B").b }
    liftA(ws)
    expectEnds(byId(ws, "B"), P(195, -35), far)
  })
})

describe("Орто-растяжение: граница допуска 5°", () => {
  it("TL-04: 4.999° растягивается, 5.001° смещается целиком", () => {
    for (const [deg, stretched] of [
      [4.999, true],
      [5.001, false],
    ] as const) {
      const b = tiltedB(deg)
      const far = { ...b.b }
      const ws = [W("A", 0, 0, 200, 0), b]
      liftA(ws)
      expect(byId(ws, "B").a.y, `a.y при ${deg}°`).toBeCloseTo(-40, 9)
      expect(byId(ws, "B").b.y, `b.y при ${deg}°`).toBeCloseTo(stretched ? far.y : far.y - 40, 9)
    }
  })

  it("TL-05: 6° от вертикали, сдвиг вверх — сосед смещается целиком и передаёт правило стене за ним", () => {
    const b = tiltedB(6)
    const far = { ...b.b }
    const ws = [W("A", 0, 0, 200, 0), b, W("C", far.x, far.y, far.x + 200, far.y)]
    liftA(ws)
    expectEnds(byId(ws, "B"), P(200, -40), P(far.x, far.y - 40))
    expectEnds(byId(ws, "C"), P(far.x, far.y - 40), P(far.x + 200, far.y - 40))
  })

  it("TL-05b: 6° от вертикали, сдвиг A вправо вдоль себя — сосед смещается целиком", () => {
    const b = tiltedB(6)
    const far = { ...b.b }
    const ws = [W("A", 0, 0, 200, 0), b]
    applyStretch(planOrthoStretch(ws, walls(ws, ["A"]), P(40, 0)), P(40, 0))
    expectEnds(byId(ws, "B"), P(240, 0), P(far.x + 40, far.y))
  })

  it("TL-06: знак наклона и направление v не влияют на классификацию", () => {
    const dirs: Point[] = [P(0, -1), P(0, 1), P(1, 0), P(-1, 0)]
    for (const d of dirs)
      for (const deg of [3, -3, 6, -6]) {
        // S перпендикулярна v и кончается в стыке (200, 200); сосед N уходит от стыка против v с отклонением deg
        const joint = P(200, 200)
        const perp = P(-d.y, d.x)
        const s = W("S", joint.x - perp.x * 200, joint.y - perp.y * 200, joint.x, joint.y)
        const c = Math.cos(deg * DEG)
        const sn = Math.sin(deg * DEG)
        const back = P(-d.x, -d.y)
        const dirN = P(back.x * c - back.y * sn, back.x * sn + back.y * c)
        const n = W("N", joint.x, joint.y, joint.x + dirN.x * 300, joint.y + dirN.y * 300)
        const far = { ...n.b }
        const ws = [s, n]
        const v = P(d.x * 40, d.y * 40)
        applyStretch(planOrthoStretch(ws, walls(ws, ["S"]), v), v)
        const stretched = Math.abs(deg) <= 5
        const label = `d=${JSON.stringify(d)} deg=${deg}`
        expect(n.a.x, label).toBeCloseTo(joint.x + v.x, 9)
        expect(n.a.y, label).toBeCloseTo(joint.y + v.y, 9)
        expect(n.b.x, label).toBeCloseTo(stretched ? far.x : far.x + v.x, 9)
        expect(n.b.y, label).toBeCloseTo(stretched ? far.y : far.y + v.y, 9)
      }
  })
})

describe("Орто-растяжение: допуск прямого угла не затронут", () => {
  it("TL-10: RIGHT_SIN остаётся синусом 0.5°", () => {
    expect(RIGHT_SIN).toBeCloseTo(Math.sin(0.5 * DEG), 12)
  })
})

describe("Орто-растяжение: прежние границы сохранены", () => {
  it("TL-13: сосед 30° и 45° смещаются целиком", () => {
    for (const deg of [30, 45]) {
      const ws = [W("A", 0, 0, 100, 0), W("D", 100, 0, 100 + 50 * Math.cos(deg * DEG), 50 * Math.sin(deg * DEG))]
      const far = { ...byId(ws, "D").b }
      applyStretch(planOrthoStretch(ws, walls(ws, ["A"]), P(0, -20)), P(0, -20))
      expect(ends(byId(ws, "D"))[1].y, `${deg}°`).toBeCloseTo(far.y - 20, 9)
    }
  })
})

describe("Орто-растяжение: наклонная ножка T и обратное направление стены", () => {
  // ножка (100, 0)–(100 + 100·tan deg, 100) примкнута торцом к оси стены S, сдвигаемой вверх на 40
  const leg = (deg: number): Wall[] => [W("S", 0, 0, 200, 0), W("L", 100, 0, 100 + 100 * Math.tan(deg * DEG), 100)]

  it("TL-14: ножка T с наклоном 3° растягивается — примкнутый конец на v, дальний на месте", () => {
    const ws = leg(3)
    const far = { ...byId(ws, "L").b }
    applyStretch(planOrthoStretch(ws, walls(ws, ["S"]), P(0, -40)), P(0, -40))
    expectEnds(byId(ws, "L"), P(100, -40), far)
  })

  it("TL-15: ножка T с наклоном 6° смещается целиком", () => {
    const ws = leg(6)
    const far = { ...byId(ws, "L").b }
    applyStretch(planOrthoStretch(ws, walls(ws, ["S"]), P(0, -40)), P(0, -40))
    expectEnds(byId(ws, "L"), P(100, -40), P(far.x, far.y - 40))
  })

  it("TL-16: стык на конце b наклонного соседа (стена нарисована снизу вверх) — растягивается конец b", () => {
    const ws = [W("A", 0, 0, 200, 0), W("B", 203, 300, 200, 0)]
    liftA(ws)
    expectEnds(byId(ws, "B"), P(203, 300), P(200, -40))
  })
})
