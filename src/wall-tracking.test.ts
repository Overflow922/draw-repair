import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import type { ChainInput, ChainSegment } from "./wall-chain"
import { startRefOf } from "./wall-angle"
import { chainEndSquare, snapRadiusCm, snapVertex } from "./wall-snap"
import type { Point, Wall } from "./types"
import { W, deepFreeze, expectPoint, expectSameVertices, squareOnNormal } from "./wall-snap.test-utils"
import { expectTracks } from "./wall-tracking.test-utils"

// Тесты change wall-axis-tracking-snap: трекинг свободного конца по горизонтали и вертикали
// узлов чертежа (spec wall-drawing «Трекинг по узлам чертежа»). Наблюдаемый результат —
// сегмент построения chainSegment (единый для превью и фиксации) и его линии трекинга.
// Все узлы — вне узлов сетки, вторая координата курсора — не кратна шагу.

const GRID = 10
const R = snapRadiusCm(1) // 6 см
const START: Point = { x: 300, y: 300 } // свободное начало на сетке, вдали от стен

function seg(over: Partial<ChainInput> & Pick<ChainInput, "raw" | "walls">): ChainSegment {
  return chainSegment({
    start: START,
    ref: null,
    radiusCm: R,
    gridStepCm: GRID,
    thicknessCm: 20,
    ortho: false,
    typedAngleDeg: null,
    typedLengthCm: null,
    ...over,
  })
}

// стена A: свободный конец оси N = (103, 0) вне сетки
const wallA = (): Wall => W(0, 0, 103, 0)

describe("трекинг: направление не задано", () => {
  it("TRK-V-1: вертикаль узла — x = N.x, y по сетке, линия от узла до конца", () => {
    const s = seg({ raw: { x: 104, y: 207 }, walls: [wallA()] })
    expectPoint(s.end, 103, 210)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 210 } }])
  })

  it("TRK-H-1: горизонталь узла — y = N.y, x по сетке", () => {
    const s = seg({ raw: { x: 207, y: 98 }, walls: [W(0, 0, 0, 97)] })
    expectPoint(s.end, 210, 97)
    expectTracks(s.tracks, [{ from: { x: 0, y: 97 }, to: { x: 210, y: 97 } }])
  })

  it("TRK-XY-1: две оси по разным узлам — конец в пересечении, две линии", () => {
    const walls = [wallA(), W(400, 57, 500, 57)]
    const s = seg({ raw: { x: 105, y: 55 }, walls })
    expectPoint(s.end, 103, 57)
    expectTracks(s.tracks, [
      { from: { x: 103, y: 0 }, to: { x: 103, y: 57 } },
      { from: { x: 400, y: 57 }, to: { x: 103, y: 57 } },
    ])
  })

  it("TRK-RAD-1: расстояние до линии ровно радиус — срабатывает", () => {
    const s = seg({ raw: { x: 103 + R, y: 207 }, walls: [wallA()] })
    expectPoint(s.end, 103, 210)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 210 } }])
  })

  it("TRK-RAD-2: чуть дальше радиуса — сетка, линий нет", () => {
    const s = seg({ raw: { x: 103 + R + 0.01, y: 207 }, walls: [wallA()] })
    expectPoint(s.end, 110, 210)
    expectTracks(s.tracks, [])
  })

  it("TRK-NONE-1: вдали от линий узлов и стен — узел сетки, линий нет", () => {
    const s = seg({ raw: { x: 117, y: 207 }, walls: [wallA()] })
    expectPoint(s.end, 120, 210)
    expectTracks(s.tracks, [])
  })

  it("TRK-ZOOM-1: 10 px экрана от вертикали срабатывает при масштабах 0.25, 1, 4", () => {
    for (const zoom of [0.25, 1, 4]) {
      const offset = 10 / (2 * zoom) // 10 px экрана в см
      const s = seg({ raw: { x: 103 + offset, y: 207 }, walls: [wallA()], radiusCm: snapRadiusCm(zoom) })
      expect(s.end.x, `zoom ${zoom}`).toBeCloseTo(103, 6)
      expect(s.tracks, `zoom ${zoom}`).toHaveLength(1)
    }
  })

  it("TRK-ZOOM-2: 14 px экрана от вертикали не срабатывает при масштабах 0.25, 1, 4", () => {
    for (const zoom of [0.25, 1, 4]) {
      const offset = 14 / (2 * zoom)
      const s = seg({ raw: { x: 103 + offset, y: 207 }, walls: [wallA()], radiusCm: snapRadiusCm(zoom) })
      expect(s.end.x, `zoom ${zoom}`).toBeCloseTo(Math.round((103 + offset) / GRID) * GRID, 6)
      expect(s.tracks, `zoom ${zoom}`).toHaveLength(0)
    }
  })

  it("TRK-JOINT-1: совпадающие концы осей двух стен — не узел", () => {
    // стык старой модели J = (103, 0); остальные концы — далеко от курсора
    const walls = [W(0, 0, 103, 0), W(103, 0, 303, -200)]
    const s = seg({ raw: { x: 104, y: 207 }, walls })
    expectPoint(s.end, 100, 210)
    expectTracks(s.tracks, [])
  })

  it("TRK-START-1: узел, совпадающий с началом цепочки, — не узел", () => {
    const s = seg({ start: { x: 103, y: 0 }, raw: { x: 104, y: 207 }, walls: [wallA()] })
    expectPoint(s.end, 100, 210)
    expectTracks(s.tracks, [])
  })

  it("TRK-L-1: конец оси в примыкании квадратом (оси не совпадают) — узел", () => {
    // B приставлена к нижней грани A (толщина 26, грань y = 13); B.a = (10, 13)
    const walls = [W(0, 0, 300, 0, 26), W(10, 13, 10, 300)]
    const s = seg({ start: { x: 600, y: 300 }, raw: { x: 400, y: 14 }, walls })
    expect(s.snap.source).toBe("grid")
    expectPoint(s.end, 400, 13)
    expectTracks(s.tracks, [{ from: { x: 10, y: 13 }, to: { x: 400, y: 13 } }])
  })

  it("TRK-WALL-1: зона прилипания к грани — стена, трекинга нет", () => {
    // курсор в 1 см от вертикали N = (103, 0) и в 5 см от нижней грани W (y = 190)
    const walls = [wallA(), W(0, 200, 300, 200)]
    const s = seg({ raw: { x: 104, y: 185 }, walls })
    expect(s.snap.source).toBe("wall")
    expectPoint(s.end, s.snap.point.x, s.snap.point.y)
    expect(s.end.y).toBeCloseTo(190, 6)
    expect(s.end.x).not.toBeCloseTo(103, 3)
    expectTracks(s.tracks, [])
  })

  it("TRK-GRID-1: трекинг приоритетнее ближайшего узла сетки", () => {
    // узел сетки x = 100 в 0.1 см от курсора, вертикаль узла x = 98 — в 1.9 см
    const s = seg({ raw: { x: 99.9, y: 207 }, walls: [W(0, 0, 98, 0)] })
    expectPoint(s.end, 98, 210)
  })

  it("TRK-NEAR-1: из нескольких вертикалей — ближайшая к курсору, а не первая", () => {
    const walls = [wallA(), W(107, -300, 207, -300)]
    const s = seg({ raw: { x: 106, y: 207 }, walls })
    expectPoint(s.end, 107, 210)
    expectTracks(s.tracks, [{ from: { x: 107, y: -300 }, to: { x: 107, y: 210 } }])
  })

  it("TRK-TIE-1: равные расстояния — узел стены раньше в массиве; не зависит от истории указателя", () => {
    const walls = deepFreeze([wallA(), W(105, -300, 205, -300)])
    const input = { raw: { x: 104, y: 207 }, walls }
    const s = seg(input)
    expectPoint(s.end, 103, 210)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 210 } }])
    // промежуточная позиция выбирает узел второй стены; возврат в точку равенства — тот же результат
    const other = seg({ raw: { x: 106, y: 207 }, walls })
    expectPoint(other.end, 105, 210)
    expect(seg(input)).toEqual(s)
  })

  it("TRK-TIE-2: при равенстве решает порядок стен, а не значение координаты", () => {
    const walls = [W(105, -300, 205, -300), wallA()]
    const s = seg({ raw: { x: 104, y: 207 }, walls })
    expectPoint(s.end, 105, 210)
    expectTracks(s.tracks, [{ from: { x: 105, y: -300 }, to: { x: 105, y: 210 } }])
  })

  it("TRK-JOINT-2: почти совпадающие концы (0.5 см) остаются узлами — исключается только точное совпадение", () => {
    const walls = [W(0, 0, 103, 0), W(103.5, 0, 303, -200)]
    const s = seg({ raw: { x: 104, y: 207 }, walls })
    expectPoint(s.end, 103.5, 210)
    expectTracks(s.tracks, [{ from: { x: 103.5, y: 0 }, to: { x: 103.5, y: 210 } }])
  })

  it("TRK-TEE-1: конец оси на оси другой стены (T-примыкание, концы не совпадают) — узел", () => {
    const walls = [W(0, 0, 300, 0), W(103, 0, 303, -200)]
    const s = seg({ raw: { x: 104, y: 207 }, walls })
    expectPoint(s.end, 103, 210)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 210 } }])
  })

  it("TRK-START-2: узел в 0.5 см от начала цепочки (не совпадает) — остаётся узлом", () => {
    const s = seg({ start: { x: 103.5, y: 0 }, raw: { x: 104, y: 207 }, walls: [wallA()] })
    expectPoint(s.end, 103, 210)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 210 } }])
  })

  it("TRK-DEGEN-2: короткая стена ненулевой длины (0.5 см) даёт узлы", () => {
    const s = seg({ raw: { x: 104, y: 207 }, walls: [W(103, -300, 103.5, -300)] })
    expectPoint(s.end, 103.5, 210)
    expectTracks(s.tracks, [{ from: { x: 103.5, y: -300 }, to: { x: 103.5, y: 210 } }])
  })

  it("TRK-DEGEN-1: концы стены нулевой длины — не узлы", () => {
    const s = seg({ raw: { x: 104, y: 207 }, walls: [W(103, -300, 103, -300)] })
    expectPoint(s.end, 100, 210)
    expectTracks(s.tracks, [])
  })

  it("TRK-H-RAD-1: горизонталь на расстоянии ровно радиус — срабатывает", () => {
    const s = seg({ raw: { x: 207, y: 97 + R }, walls: [W(0, 0, 0, 97)] })
    expectPoint(s.end, 210, 97)
    expectTracks(s.tracks, [{ from: { x: 0, y: 97 }, to: { x: 210, y: 97 } }])
  })

  it("TRK-H-NEAR-1: из нескольких горизонталей — ближайшая к курсору, а не первая", () => {
    const walls = [W(0, 0, 0, 97), W(-300, 102, -200, 102)]
    const s = seg({ raw: { x: 207, y: 101 }, walls })
    expectPoint(s.end, 210, 102)
    expectTracks(s.tracks, [{ from: { x: -300, y: 102 }, to: { x: 210, y: 102 } }])
  })

  it("TRK-ANGLE-1: угол к стене примыкания считается по направлению к концу трекинга", () => {
    // начало на грани A (300,10); конец трекинга (345,50): направление (45,40) — угол ≈ 41.63°, а не 45°
    const walls = [W(0, 0, 600, 0), W(345, -300, 445, -300)]
    const snap = snapVertex({ x: 300, y: 14 }, walls, R, GRID, 20)
    expectPoint(snap.point, 300, 10)
    const s = seg({ start: snap.point, ref: startRefOf(snap), raw: { x: 344, y: 49 }, walls })
    expectPoint(s.end, 345, 50)
    expect(s.angleDeg).toBeCloseTo((Math.atan2(40, 45) * 180) / Math.PI, 6)
    expectTracks(s.tracks, [{ from: { x: 345, y: -300 }, to: { x: 345, y: 50 } }])
  })

  it("TRK-FREE-ORTHO-1: орто включено, но направление не притянуто — трекинг в свободном режиме работает", () => {
    // отклонение ≈25° от горизонтали — больше допуска орто 15°
    const s = seg({ raw: { x: 104, y: 207 }, walls: [wallA()], ortho: true })
    expectPoint(s.end, 103, 210)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 210 } }])
  })

  it("TRK-FREE-TYPED-1: введённый угол без опоры не задаёт направление — трекинг в свободном режиме работает", () => {
    const s = seg({ raw: { x: 104, y: 207 }, walls: [wallA()], typedAngleDeg: 45 })
    expectPoint(s.end, 103, 210)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 210 } }])
  })

  it("TRK-TIE-3: равенство с погрешностью вычислений — узел стены раньше в массиве (допуск design D1)", () => {
    // |256 − 252.1| и |259.9 − 256| в плавающей точке: 3.9000000000000057 и 3.8999999999999773
    const walls = [W(252.1, -300, 152.1, -300), W(259.9, -300, 359.9, -300)]
    const s = seg({ raw: { x: 256, y: 207 }, walls })
    expectPoint(s.end, 252.1, 210)
    expectTracks(s.tracks, [{ from: { x: 252.1, y: -300 }, to: { x: 252.1, y: 210 } }])
  })

  it("TRK-SAME-1: два конца одной стены на одной вертикали — линия от начала оси", () => {
    const fwd = seg({ raw: { x: 104, y: 207 }, walls: [W(103, -300, 103, -100)] })
    expectPoint(fwd.end, 103, 210)
    expectTracks(fwd.tracks, [{ from: { x: 103, y: -300 }, to: { x: 103, y: 210 } }])
    const rev = seg({ raw: { x: 104, y: 207 }, walls: [W(103, -100, 103, -300)] })
    expectPoint(rev.end, 103, 210)
    expectTracks(rev.tracks, [{ from: { x: 103, y: -100 }, to: { x: 103, y: 210 } }])
  })
})

describe("трекинг: направление задано", () => {
  it("TRK-RAY-1: орто-луч — длина по вертикали узла, направление строго горизонтальное", () => {
    const s = seg({ raw: { x: 104, y: 302 }, walls: [wallA()], ortho: true })
    expectPoint(s.end, 103, 300)
    expect(s.dir).not.toBeNull()
    expectPoint(s.dir ?? { x: NaN, y: NaN }, -1, 0)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 300 } }])
  })

  it("TRK-RAY-PAR-1: горизонталь узла параллельна горизонтальному лучу — не участвует", () => {
    const s = seg({ raw: { x: 157, y: 301 }, walls: [W(-500, 303, -400, 303)], ortho: true })
    expectPoint(s.end, 160, 300)
    expectTracks(s.tracks, [])
  })

  // начало на верхней грани стены A0, введён угол 45°: луч (300,10) + t·(1,1)/√2
  function slantInput(raw: Point, walls: Wall[]): Partial<ChainInput> & Pick<ChainInput, "raw" | "walls"> {
    const all = [W(0, 0, 600, 0), ...walls]
    const snap = snapVertex({ x: 300, y: 14 }, all, R, GRID, 20)
    expectPoint(snap.point, 300, 10)
    return { start: snap.point, ref: startRefOf(snap), raw, walls: all, typedAngleDeg: 45 }
  }

  it("TRK-RAY-SLANT-1: наклонный луч — ближайшее к курсору пересечение (вертикаль)", () => {
    // вертикаль x = 400 (узел (400,600)) и горизонталь y = 117 (узел (-400,117)) в радиусе
    const s = seg(slantInput({ x: 403, y: 113 }, [W(400, 600, 500, 600), W(-400, 117, -300, 117)]))
    expectPoint(s.end, 400, 110)
    expect(s.angleDeg).toBeCloseTo(45, 9)
    expectTracks(s.tracks, [{ from: { x: 400, y: 600 }, to: { x: 400, y: 110 } }])
  })

  it("TRK-RAY-SLANT-2: наклонный луч — горизонталь ближе, вертикаль на границе радиуса", () => {
    const s = seg(slantInput({ x: 406, y: 116 }, [W(400, 600, 500, 600), W(-400, 117, -300, 117)]))
    expectPoint(s.end, 407, 117)
    expect(s.angleDeg).toBeCloseTo(45, 9)
    expectTracks(s.tracks, [{ from: { x: -400, y: 117 }, to: { x: 407, y: 117 } }])
  })

  it("TRK-RAY-SLANT-3: наклонный луч — ближайшее пересечение, а не ближайшая к курсору линия", () => {
    // вертикаль x = 400 в 0.5 см от курсора, горизонталь y = 117 — в 3 см, но пересечение
    // луча с горизонталью (407,117) ближе к курсору (≈7.16), чем с вертикалью (400,110) (≈10.01)
    const s = seg(slantInput({ x: 400.5, y: 120 }, [W(400, 600, 500, 600), W(-400, 117, -300, 117)]))
    expectPoint(s.end, 407, 117)
    expect(s.angleDeg).toBeCloseTo(45, 9)
    expectTracks(s.tracks, [{ from: { x: -400, y: 117 }, to: { x: 407, y: 117 } }])
  })

  it("TRK-RAY-TIE-1: вертикаль и горизонталь разных стен пересекают луч в одной точке — узел стены раньше в массиве", () => {
    // x = 400 (стена E) и y = 110 (стена F) пересекают луч в (400,110); расстояния равны с точностью вычислений
    const E = W(400, 600, 500, 600)
    const F = W(-400, 110, -300, 110)
    const ef = seg(slantInput({ x: 403, y: 113 }, [E, F]))
    expectPoint(ef.end, 400, 110)
    expectTracks(ef.tracks, [{ from: { x: 400, y: 600 }, to: { x: 400, y: 110 } }])
    const fe = seg(slantInput({ x: 403, y: 113 }, [F, E]))
    expectPoint(fe.end, 400, 110)
    expectTracks(fe.tracks, [{ from: { x: -400, y: 110 }, to: { x: 400, y: 110 } }])
  })

  it("TRK-RAY-GATE-1: на луче срабатывает линия в радиусе от курсора, даже если пересечение дальше радиуса", () => {
    // вертикаль x = 103 в 1 см от курсора; пересечение (103,300) — в ≈8.06 см > R
    const s = seg({ raw: { x: 104, y: 308 }, walls: [wallA()], ortho: true })
    expectPoint(s.end, 103, 300)
    expectPoint(s.dir ?? { x: NaN, y: NaN }, -1, 0)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 300 } }])
  })

  it("TRK-RAY-GATE-2: наклонный луч — срабатывание по расстоянию от курсора до линии, а не от его проекции на луч", () => {
    // курсор в 5.9 см от вертикали x = 400; проекция курсора на луч — в ≈10.45 см от неё
    const s = seg(slantInput({ x: 405.9, y: 125 }, [W(400, 600, 500, 600)]))
    expectPoint(s.end, 400, 110)
    expect(s.angleDeg).toBeCloseTo(45, 9)
    expectTracks(s.tracks, [{ from: { x: 400, y: 600 }, to: { x: 400, y: 110 } }])
  })

  it("TRK-RAY-V-1: вертикальный орто-луч — длина по горизонтали узла", () => {
    const s = seg({ raw: { x: 301.5, y: 101 }, walls: [W(0, 0, 0, 97)], ortho: true })
    expectPoint(s.end, 300, 97)
    expectPoint(s.dir ?? { x: NaN, y: NaN }, 0, -1)
    expectTracks(s.tracks, [{ from: { x: 0, y: 97 }, to: { x: 300, y: 97 } }])
  })

  it("TRK-RAY-H-RAD-1: вертикальный орто-луч, горизонталь узла ровно на радиусе — срабатывает", () => {
    const s = seg({ raw: { x: 301, y: 97 + R }, walls: [W(0, 0, 0, 97)], ortho: true })
    expectPoint(s.end, 300, 97)
    expectTracks(s.tracks, [{ from: { x: 0, y: 97 }, to: { x: 300, y: 97 } }])
  })

  it("TRK-RAY-RAD-1: на луче линия на расстоянии ровно радиус — срабатывает", () => {
    const s = seg({ raw: { x: 103 + R, y: 301 }, walls: [wallA()], ortho: true })
    expectPoint(s.end, 103, 300)
    expectTracks(s.tracks, [{ from: { x: 103, y: 0 }, to: { x: 103, y: 300 } }])
  })

  it("TRK-RAY-PAR-2: введённый угол 90° у торца — луч почти вертикален, вертикаль узла параллельна и не участвует", () => {
    // направление из введённого угла вычисляется с погрешностью (dir.x ≈ 1e-16), но луч параллелен вертикали
    const walls = [W(0, 0, 300, 0), W(298, 600, 398, 600)]
    const snap = snapVertex({ x: 306, y: 0 }, walls, R, GRID, 20)
    expectPoint(snap.point, 310, 0) // центр квадрата у торца (change cap-snap-vertex-at-square-center)
    const s = seg({ start: snap.point, ref: startRefOf(snap), raw: { x: 300.5, y: 203 }, walls, typedAngleDeg: 90 })
    expectPoint(s.end, 310, 200)
    expectTracks(s.tracks, [])
  })

  it("TRK-RAY-OUT-1: на луче линия дальше радиуса не срабатывает, даже в пределах половины толщины стены", () => {
    // вертикаль x = 108 в 6.01 см от курсора: > R = 6, но < 10 (полтолщины новой стены)
    const s = seg({ raw: { x: 101.99, y: 302 }, walls: [W(108, -300, 208, -300)], ortho: true })
    expectPoint(s.end, 100, 300)
    expectTracks(s.tracks, [])
  })

  it("TRK-RAY-ZOOM-1: на луче 14 px экрана от вертикали не срабатывает при масштабах 0.25, 1, 4", () => {
    for (const zoom of [0.25, 1, 4]) {
      const offset = 14 / (2 * zoom)
      const s = seg({ raw: { x: 103 + offset, y: 301 }, walls: [wallA()], ortho: true, radiusCm: snapRadiusCm(zoom) })
      expect(s.end.x, `zoom ${zoom}`).toBeCloseTo(Math.round((103 + offset) / GRID) * GRID, 6)
      expect(s.end.y, `zoom ${zoom}`).toBeCloseTo(300, 6)
      expect(s.tracks, `zoom ${zoom}`).toHaveLength(0)
    }
  })

  it("TRK-RAY-NEAR-START-1: пересечение чуть впереди начала принимается", () => {
    // луч влево от (300,300); вертикаль x = 299 пересекает его в 1 см впереди начала
    const s = seg({ raw: { x: 297, y: 300.5 }, walls: [W(299, -300, 399, -300)], ortho: true })
    expectPoint(s.end, 299, 300)
    expectTracks(s.tracks, [{ from: { x: 299, y: -300 }, to: { x: 299, y: 300 } }])
  })

  it("TRK-RAY-BACK-1: пересечение позади начала не принимается", () => {
    // луч влево от (300,300); вертикаль x = 302 пересекает прямую луча позади начала
    const s = seg({ raw: { x: 297, y: 300.5 }, walls: [W(302, -300, 402, -300)], ortho: true })
    expectPoint(s.end, 300, 300)
    expectTracks(s.tracks, [])
  })

  it("TRK-RAY-BACK-2: пересечение в самом начале не принимается", () => {
    const s = seg({ raw: { x: 296, y: 300.5 }, walls: [W(300, -300, 400, -300)], ortho: true })
    expectPoint(s.end, 300, 300)
    expectTracks(s.tracks, [])
  })

  it("TRK-RAY-WALL-1: пересечение луча со стеной приоритетнее трекинга", () => {
    // луч вверх от (300,300) упирается в нижнюю грань W (y = 110); горизонталь узла y = 114 рядом
    const walls = [W(0, 100, 600, 100), W(-500, 114, -400, 114)]
    const s = seg({ raw: { x: 302, y: 113 }, walls, ortho: true })
    expect(s.snap.source).toBe("wall")
    expectPoint(s.end, 300, 110)
    expectTracks(s.tracks, [])
  })
})

describe("трекинг: точная длина, квадрат, фиксация, до первого клика", () => {
  it("TRK-LEN-1: точная длина отменяет трекинг — ни длина, ни направление не меняются", () => {
    // без трекинга направление — к узлу сетки (100,210); с трекингом было бы к (103,210)
    const s = seg({ raw: { x: 104, y: 207 }, walls: [wallA()], typedLengthCm: 150 })
    const v = { x: 100 - START.x, y: 210 - START.y }
    const l = Math.hypot(v.x, v.y)
    expectPoint(s.end, START.x + (v.x / l) * 150, START.y + (v.y / l) * 150)
    expectTracks(s.tracks, [])
  })

  it("TRK-LEN-2: точная длина при заданном направлении — длина введённая, линий нет", () => {
    const s = seg({ raw: { x: 104, y: 302 }, walls: [wallA()], ortho: true, typedLengthCm: 150 })
    expectPoint(s.end, 150, 300)
    expectTracks(s.tracks, [])
  })

  it("TRK-SQ-1: квадрат на конце трекинга — последний блок вдоль сегмента", () => {
    const s = seg({ raw: { x: 104, y: 207 }, walls: [wallA()] })
    // направление сегмента — от начала к концу трекинга (103,210), а не к узлу сетки
    const v = { x: 103 - START.x, y: 210 - START.y }
    const l = Math.hypot(v.x, v.y)
    const dir = { x: v.x / l, y: v.y / l }
    expectPoint(s.dir ?? { x: NaN, y: NaN }, dir.x, dir.y)
    const square = chainEndSquare(s.end, dir, s.snap, 20)
    expectSameVertices(square, squareOnNormal({ x: 103, y: 210 }, { x: -dir.x, y: -dir.y }, 20))
  })

  it("TRK-COMMIT-1: превью и фиксация — один и тот же результат, конец = конец линии", () => {
    const input = deepFreeze({ raw: { x: 105, y: 55 }, walls: [wallA(), W(400, 57, 500, 57)] })
    const preview = seg(input)
    const commit = seg(input)
    expect(commit).toEqual(preview)
    for (const t of commit.tracks) expectPoint(t.to, commit.end.x, commit.end.y)
    for (const t of commit.tracks) expect(t.from.x === t.to.x || t.from.y === t.to.y).toBe(true)
  })

  it("TRK-PRE-1: до первого клика трекинга нет — квадрат на сетке", () => {
    const snap = snapVertex({ x: 104, y: 207 }, [wallA()], R, GRID, 20)
    expect(snap.source).toBe("grid")
    expectPoint(snap.point, 100, 210)
  })
})
